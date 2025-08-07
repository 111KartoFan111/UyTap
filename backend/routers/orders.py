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
from services.order_service import OrderService

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