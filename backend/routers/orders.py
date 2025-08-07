# backend/routers/orders.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, and_
import uuid

from models.database import get_db
from models.extended_models import RoomOrder, OrderStatus, Property, Client, Rental
from schemas.order import RoomOrderCreate, RoomOrderUpdate, RoomOrderResponse
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
from models.extended_models import Task, TaskStatus, TaskType, TaskPriority, Property, User
from services.order_service import OrderService
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/orders", tags=["Room Orders"])


@router.get("", response_model=List[RoomOrderResponse])
async def get_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[OrderStatus] = None,
    order_type: Optional[str] = None,
    property_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список заказов в номер"""
    
    query = db.query(RoomOrder).filter(RoomOrder.organization_id == current_user.organization_id)
    
    # Фильтры
    if status:
        query = query.filter(RoomOrder.status == status)
    if order_type:
        query = query.filter(RoomOrder.order_type == order_type)
    if property_id:
        query = query.filter(RoomOrder.property_id == uuid.UUID(property_id))
    
    # Для сотрудников показываем только их заказы
    if current_user.role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF, UserRole.STOREKEEPER]:
        query = query.filter(RoomOrder.assigned_to == current_user.id)
    
    # Подгружаем связанные объекты
    query = query.options(
        selectinload(RoomOrder.property),
        selectinload(RoomOrder.client)
    )
    
    orders = query.order_by(desc(RoomOrder.requested_at)).offset(skip).limit(limit).all()
    
    return orders


@router.post("", response_model=RoomOrderResponse)
async def create_order(
    order_data: RoomOrderCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать заказ с проверкой наличия на складе"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create orders"
        )
    
    try:
        # Use enhanced order creation with inventory checking
        order = OrderService.create_order_with_inventory_check(
            db=db,
            order_data=order_data,
            organization_id=current_user.organization_id
        )
        
        # Log action
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="order_created_with_inventory",
            organization_id=current_user.organization_id,
            resource_type="order",
            resource_id=order.id,
            details={
                "property_id": order_data.property_id,
                "order_type": order_data.order_type,
                "total_amount": order_data.total_amount,
                "inventory_items": [
                    item.inventory_id for item in order_data.items 
                    if item.is_inventory_item and item.inventory_id
                ]
            }
        )
        
        return order
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{order_id}", response_model=RoomOrderResponse)
async def get_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о заказе"""
    
    try:
        order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Проверяем права доступа
    if (current_user.role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF, UserRole.STOREKEEPER] 
        and order.assigned_to != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return order


@router.put("/{order_id}", response_model=RoomOrderResponse)
async def update_order(
    order_id: uuid.UUID,
    order_data: RoomOrderUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить заказ"""
    
    try:
        order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Проверяем права на обновление
    can_update = (
        current_user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER] or
        (order.assigned_to == current_user.id and 
         order_data.status in [OrderStatus.IN_PROGRESS, OrderStatus.DELIVERED])
    )
    
    if not can_update:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update this order"
        )
    
    # Обновляем заказ
    try:
        updated_order = OrderService.update_order(db, order, order_data, current_user.id)
        return updated_order
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{order_id}/assign")
async def assign_order(
    order_id: uuid.UUID,
    assigned_to: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Назначить заказ исполнителю"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to assign orders"
        )
    
    try:
        order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    try:
        OrderService.assign_order(
            db=db,
            order=order,
            assigned_to=uuid.UUID(assigned_to),
            assigned_by=current_user.id
        )
        
        return {"message": "Order assigned successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{order_id}/complete")
async def complete_order_with_inventory(
    order_id: uuid.UUID,
    completion_notes: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Complete order with automatic inventory deduction"""
    
    try:
        order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check permissions
    can_complete = (
        current_user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER] or
        order.assigned_to == current_user.id
    )
    
    if not can_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to complete this order"
        )
    
    try:
        # ИСПРАВЛЕНО: Используем правильный метод с workflow статусов
        completed_order = OrderService.complete_order_with_inventory_deduction(
            db=db,
            order=order,
            completed_by=current_user.id,
            completion_notes=completion_notes
        )
        
        # Log action
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="order_completed_with_inventory",
            organization_id=current_user.organization_id,
            resource_type="order",
            resource_id=order.id,
            details={
                "completed_at": completed_order.completed_at.isoformat(),
                "inventory_deducted": True
            }
        )
        
        return {
            "message": "Order completed successfully with inventory deduction",
            "completed_at": completed_order.completed_at,
            "order_id": str(order_id),
            "status": completed_order.status.value
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/statistics/overview")
async def get_orders_statistics(
    period_days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по заказам"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view statistics"
        )
    
    try:
        from datetime import timedelta
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Get orders in period
        orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.organization_id == current_user.organization_id,
                RoomOrder.created_at >= start_date
            )
        ).all()
        
        # Calculate stats
        total_orders = len(orders)
        completed_orders = [o for o in orders if o.status == OrderStatus.DELIVERED]
        revenue = sum(o.total_amount for o in completed_orders)
        
        # Group by status
        status_counts = {}
        for status in OrderStatus:
            count = len([o for o in orders if o.status == status])
            status_counts[status.value] = count
        
        # Group by type
        type_counts = {}
        order_types = list(set(o.order_type for o in orders))
        for order_type in order_types:
            count = len([o for o in orders if o.order_type == order_type])
            type_counts[order_type] = count
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": period_days
            },
            "totals": {
                "total_orders": total_orders,
                "completed_orders": len(completed_orders),
                "completion_rate": (len(completed_orders) / total_orders * 100) if total_orders > 0 else 0,
                "total_revenue": revenue
            },
            "by_status": status_counts,
            "by_type": type_counts,
            "average_order_value": revenue / len(completed_orders) if completed_orders else 0
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate statistics: {str(e)}"
        )

@router.post("/{order_id}/payment")
async def add_order_payment(
    order_id: uuid.UUID,
    payment_data: dict,  # {"amount": float, "method": str, "payer_name": str}
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Добавить платеж за заказ"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to process payments"
        )
    
    try:
        order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    try:
        # Если заказ связан с арендой - создаем платеж через rental
        if order.rental_id:
            from services.payment_service import PaymentService
            from schemas.payment import ProcessPaymentRequest
            
            payment_request = ProcessPaymentRequest(
                payment_amount=payment_data["amount"],
                payment_method=payment_data["method"],
                payment_type="additional",  # Дополнительная услуга
                description=f"Оплата заказа #{order.order_number}: {order.title}",
                payer_name=payment_data.get("payer_name", ""),
                auto_complete=True
            )
            
            payment = PaymentService.process_payment(
                db=db,
                rental_id=order.rental_id,
                payment_request=payment_request,
                organization_id=current_user.organization_id
            )
            
            # Обновляем заказ
            order.is_paid = True
            order.updated_at = datetime.now(timezone.utc)
            db.commit()
            
            return {
                "message": "Payment processed successfully",
                "payment_id": str(payment.id),
                "order_updated": True
            }
        else:
            # Прямая оплата без связи с арендой
            # Можно создать отдельную таблицу order_payments или 
            # использовать существующий механизм платежей
            
            return {
                "message": "Direct order payment not implemented yet",
                "suggestion": "Link order to rental for payment processing"
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment processing failed: {str(e)}"
        )

@router.get("/{order_id}/payment-status")
async def get_order_payment_status(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить статус оплаты заказа"""
    
    try:
        order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    payment_status = {
        "order_id": str(order_id),
        "total_amount": order.total_amount,
        "is_paid": order.is_paid,
        "payment_method": "unknown",
        "payment_date": None
    }
    
    # Если заказ связан с арендой, получаем информацию о платежах
    if order.rental_id:
        try:
            from services.payment_service import PaymentService
            
            payments = PaymentService.get_payments_by_rental(db, order.rental_id)
            
            # Ищем платежи, связанные с этим заказом
            order_payments = [
                p for p in payments 
                if order.order_number in (p.description or "")
                and p.status == "completed"
            ]
            
            if order_payments:
                latest_payment = max(order_payments, key=lambda p: p.completed_at or p.created_at)
                payment_status.update({
                    "payment_method": latest_payment.payment_method,
                    "payment_date": latest_payment.completed_at,
                    "payment_count": len(order_payments),
                    "total_paid": sum(p.amount for p in order_payments)
                })
        except Exception as e:
            print(f"Warning: Could not fetch payment info: {e}")
    
    return payment_status

@router.get("/executors/workload")
async def get_executor_workload(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить загруженность исполнителей заказов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view executor workload"
        )
    
    try:
        workload_summary = OrderService.get_executor_workload_summary(
            db=db,
            organization_id=current_user.organization_id
        )
        
        return workload_summary
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get executor workload: {str(e)}"
        )
    
# backend/routers/orders.py - ДОБАВЛЯЕМ НОВЫЕ ЭНДПОИНТЫ

# Добавьте эти новые роуты в существующий файл backend/routers/orders.py

@router.get("/executors/workload-detailed")
async def get_detailed_executor_workload(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить детальную информацию о загруженности исполнителей"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view executor workload"
        )
    
    try:
        workload_summary = OrderService.get_executor_workload_summary(
            db=db,
            organization_id=current_user.organization_id
        )
        
        return workload_summary
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get detailed executor workload: {str(e)}"
        )

@router.post("/{order_id}/auto-reassign")
async def auto_reassign_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Автоматически переназначить заказ оптимальному исполнителю"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to reassign orders"
        )
    
    try:
        order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    try:
        # Find the best executor for this order
        best_executor = OrderService._auto_assign_best_executor(
            db, current_user.organization_id, order.order_type
        )
        
        if not best_executor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No suitable executor available for reassignment"
            )
        
        # Get current executor info for logging
        old_executor = None
        if order.assigned_to:
            old_executor = db.query(User).filter(User.id == order.assigned_to).first()
        
        # Reassign the order
        order.assigned_to = best_executor.id
        order.status = OrderStatus.CONFIRMED
        order.updated_at = datetime.now(timezone.utc)
        
        # Update any related delivery tasks
        delivery_tasks = db.query(Task).filter(
            and_(
                Task.property_id == order.property_id,
                Task.task_type == TaskType.DELIVERY,
                Task.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED]),
                Task.description.like(f"%{order.order_number}%")
            )
        ).all()
        
        for task in delivery_tasks:
            task.assigned_to = best_executor.id
            task.status = TaskStatus.ASSIGNED
            task.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        
        # Send notification to new executor
        OrderService._notify_executor_about_assignment(db, order, best_executor)
        
        # Log the reassignment
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="order_auto_reassigned",
            organization_id=current_user.organization_id,
            resource_type="order",
            resource_id=order.id,
            details={
                "order_number": order.order_number,
                "old_executor": f"{old_executor.first_name} {old_executor.last_name}" if old_executor else None,
                "new_executor": f"{best_executor.first_name} {best_executor.last_name}",
                "new_executor_id": str(best_executor.id),
                "related_tasks_updated": len(delivery_tasks)
            }
        )
        
        return {
            "message": "Order successfully reassigned",
            "old_executor": {
                "id": str(old_executor.id) if old_executor else None,
                "name": f"{old_executor.first_name} {old_executor.last_name}" if old_executor else None
            } if old_executor else None,
            "new_executor": {
                "id": str(best_executor.id),
                "name": f"{best_executor.first_name} {best_executor.last_name}",
                "role": best_executor.role.value
            },
            "related_tasks_updated": len(delivery_tasks),
            "order_id": str(order_id)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Auto-reassignment failed: {str(e)}"
        )

@router.post("/bulk-auto-assign")
async def bulk_auto_assign_orders(
    filter_criteria: dict = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Массовое автоназначение заказов оптимальным исполнителям"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to bulk assign orders"
        )
    
    try:
        # Find unassigned orders based on criteria
        query = db.query(RoomOrder).filter(
            and_(
                RoomOrder.organization_id == current_user.organization_id,
                RoomOrder.assigned_to.is_(None),
                RoomOrder.status.in_([OrderStatus.PENDING, OrderStatus.CONFIRMED])
            )
        )
        
        # Apply filters if provided
        if filter_criteria:
            if filter_criteria.get('order_type'):
                query = query.filter(RoomOrder.order_type == filter_criteria['order_type'])
            if filter_criteria.get('property_id'):
                query = query.filter(RoomOrder.property_id == uuid.UUID(filter_criteria['property_id']))
            if filter_criteria.get('created_after'):
                query = query.filter(RoomOrder.created_at >= filter_criteria['created_after'])
        
        unassigned_orders = query.order_by(RoomOrder.created_at).all()
        
        if not unassigned_orders:
            return {
                "message": "No unassigned orders found",
                "assigned_count": 0,
                "failed_count": 0,
                "assignments": []
            }
        
        assignments = []
        failed_assignments = []
        
        for order in unassigned_orders:
            try:
                # Find best executor for this order
                best_executor = OrderService._auto_assign_best_executor(
                    db, current_user.organization_id, order.order_type
                )
                
                if best_executor:
                    # Assign the order
                    order.assigned_to = best_executor.id
                    order.status = OrderStatus.CONFIRMED
                    order.updated_at = datetime.now(timezone.utc)
                    
                    # Create or update delivery task
                    delivery_task = OrderService._create_delivery_task_with_assignment(
                        db, order, best_executor
                    )
                    
                    # Send notification
                    OrderService._notify_executor_about_assignment(db, order, best_executor)
                    
                    assignments.append({
                        "order_id": str(order.id),
                        "order_number": order.order_number,
                        "executor": {
                            "id": str(best_executor.id),
                            "name": f"{best_executor.first_name} {best_executor.last_name}",
                            "role": best_executor.role.value
                        },
                        "delivery_task_id": str(delivery_task.id) if delivery_task else None
                    })
                else:
                    failed_assignments.append({
                        "order_id": str(order.id),
                        "order_number": order.order_number,
                        "reason": "No suitable executor available"
                    })
                    
            except Exception as e:
                failed_assignments.append({
                    "order_id": str(order.id),
                    "order_number": order.order_number,
                    "reason": str(e)
                })
        
        # Commit all successful assignments
        if assignments:
            db.commit()
        
        # Log the bulk operation
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="bulk_auto_assign_orders",
            organization_id=current_user.organization_id,
            details={
                "total_orders": len(unassigned_orders),
                "assigned_count": len(assignments),
                "failed_count": len(failed_assignments),
                "filter_criteria": filter_criteria
            }
        )
        
        return {
            "message": f"Bulk assignment completed: {len(assignments)} assigned, {len(failed_assignments)} failed",
            "assigned_count": len(assignments),
            "failed_count": len(failed_assignments),
            "assignments": assignments,
            "failed_assignments": failed_assignments
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk assignment failed: {str(e)}"
        )

@router.get("/assignment-analytics")
async def get_assignment_analytics(
    period_days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить аналитику по назначениям заказов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view assignment analytics"
        )
    
    try:
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Get orders in the period
        orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.organization_id == current_user.organization_id,
                RoomOrder.created_at >= start_date
            )
        ).all()
        
        # Calculate assignment metrics
        total_orders = len(orders)
        auto_assigned = len([o for o in orders if o.assigned_to is not None])
        unassigned = total_orders - auto_assigned
        
        # Assignment time analysis
        assigned_orders = [o for o in orders if o.assigned_to is not None]
        assignment_times = []
        
        for order in assigned_orders:
            # Find related delivery tasks to estimate assignment time
            delivery_tasks = db.query(Task).filter(
                and_(
                    Task.property_id == order.property_id,
                    Task.task_type == TaskType.DELIVERY,
                    Task.created_at >= order.created_at,
                    Task.created_at <= order.created_at + timedelta(hours=1)
                )
            ).first()
            
            if delivery_tasks:
                assignment_time = (delivery_tasks.created_at - order.created_at).total_seconds() / 60
                assignment_times.append(assignment_time)
        
        avg_assignment_time = sum(assignment_times) / len(assignment_times) if assignment_times else 0
        
        # Executor performance analysis
        executor_stats = {}
        for order in assigned_orders:
            if order.assigned_to:
                executor_id = str(order.assigned_to)
                if executor_id not in executor_stats:
                    executor = db.query(User).filter(User.id == order.assigned_to).first()
                    executor_stats[executor_id] = {
                        "name": f"{executor.first_name} {executor.last_name}" if executor else "Unknown",
                        "role": executor.role.value if executor else "Unknown",
                        "assigned_count": 0,
                        "completed_count": 0,
                        "total_value": 0,
                        "avg_completion_time": 0
                    }
                
                executor_stats[executor_id]["assigned_count"] += 1
                executor_stats[executor_id]["total_value"] += order.total_amount
                
                if order.status == OrderStatus.DELIVERED:
                    executor_stats[executor_id]["completed_count"] += 1
        
        # Order type distribution
        order_type_stats = {}
        for order in orders:
            order_type = order.order_type
            if order_type not in order_type_stats:
                order_type_stats[order_type] = {
                    "total": 0,
                    "assigned": 0,
                    "completed": 0,
                    "avg_value": 0
                }
            
            order_type_stats[order_type]["total"] += 1
            order_type_stats[order_type]["avg_value"] += order.total_amount
            
            if order.assigned_to:
                order_type_stats[order_type]["assigned"] += 1
            
            if order.status == OrderStatus.DELIVERED:
                order_type_stats[order_type]["completed"] += 1
        
        # Calculate averages
        for stats in order_type_stats.values():
            if stats["total"] > 0:
                stats["avg_value"] /= stats["total"]
        
        # Daily assignment trends
        daily_stats = {}
        for order in orders:
            date_key = order.created_at.date().isoformat()
            if date_key not in daily_stats:
                daily_stats[date_key] = {
                    "date": date_key,
                    "total_orders": 0,
                    "assigned_orders": 0,
                    "completed_orders": 0
                }
            
            daily_stats[date_key]["total_orders"] += 1
            
            if order.assigned_to:
                daily_stats[date_key]["assigned_orders"] += 1
            
            if order.status == OrderStatus.DELIVERED:
                daily_stats[date_key]["completed_orders"] += 1
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": period_days
            },
            "summary": {
                "total_orders": total_orders,
                "auto_assigned": auto_assigned,
                "unassigned": unassigned,
                "assignment_rate": round((auto_assigned / total_orders * 100), 2) if total_orders > 0 else 0,
                "avg_assignment_time_minutes": round(avg_assignment_time, 2)
            },
            "executor_performance": list(executor_stats.values()),
            "order_type_distribution": order_type_stats,
            "daily_trends": list(daily_stats.values())
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get assignment analytics: {str(e)}"
        )

@router.post("/optimize-assignments")
async def optimize_current_assignments(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Оптимизировать текущие назначения заказов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can optimize assignments"
        )
    
    try:
        # Get current active orders
        active_orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.organization_id == current_user.organization_id,
                RoomOrder.status.in_([OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS]),
                RoomOrder.assigned_to.isnot(None)
            )
        ).all()
        
        if not active_orders:
            return {
                "message": "No active assigned orders to optimize",
                "optimizations": []
            }
        
        optimizations = []
        
        for order in active_orders:
            # Find potentially better executor
            current_executor = db.query(User).filter(User.id == order.assigned_to).first()
            if not current_executor:
                continue
            
            # Calculate current executor score
            current_score = OrderService._calculate_executor_score(
                db, current_executor, order.order_type, 
                [UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.TECHNICAL_STAFF]
            )
            
            # Find best available executor
            best_executor = OrderService._auto_assign_best_executor(
                db, current_user.organization_id, order.order_type
            )
            
            if best_executor and best_executor.id != current_executor.id:
                best_score = OrderService._calculate_executor_score(
                    db, best_executor, order.order_type,
                    [UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.TECHNICAL_STAFF]
                )
                
                # Only suggest if improvement is significant (>20% better)
                improvement = ((best_score - current_score) / current_score * 100) if current_score > 0 else 0
                
                if improvement > 20:
                    optimizations.append({
                        "order_id": str(order.id),
                        "order_number": order.order_number,
                        "current_executor": {
                            "id": str(current_executor.id),
                            "name": f"{current_executor.first_name} {current_executor.last_name}",
                            "score": round(current_score, 2)
                        },
                        "suggested_executor": {
                            "id": str(best_executor.id),
                            "name": f"{best_executor.first_name} {best_executor.last_name}",
                            "score": round(best_score, 2)
                        },
                        "improvement_percentage": round(improvement, 2),
                        "recommendation": "Consider reassigning for better efficiency"
                    })
        
        return {
            "message": f"Found {len(optimizations)} optimization opportunities",
            "total_active_orders": len(active_orders),
            "optimization_count": len(optimizations),
            "optimizations": sorted(optimizations, key=lambda x: x["improvement_percentage"], reverse=True)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assignment optimization failed: {str(e)}"
        )