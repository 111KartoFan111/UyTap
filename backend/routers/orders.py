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
    """Создать заказ в номер"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create orders"
        )
    
    # Проверяем существование помещения
    property_obj = db.query(Property).filter(
        and_(
            Property.id == uuid.UUID(order_data.property_id),
            Property.organization_id == current_user.organization_id
        )
    ).first()
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Создаем заказ
    order = OrderService.create_order(
        db=db,
        order_data=order_data,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="order_created",
        organization_id=current_user.organization_id,
        resource_type="order",
        resource_id=order.id,
        details={
            "property_id": order_data.property_id,
            "order_type": order_data.order_type,
            "total_amount": order_data.total_amount
        }
    )
    
    return order


@router.get("/{order_id}", response_model=RoomOrderResponse)
async def get_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о заказе"""
    
    order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    if not order:
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
    
    order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Проверяем права на обновление
    can_update = (
        current_user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER] or
        (order.assigned_to == current_user.id and order_data.status in [OrderStatus.IN_PROGRESS, OrderStatus.DELIVERED])
    )
    
    if not can_update:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update this order"
        )
    
    # Обновляем заказ
    updated_order = OrderService.update_order(db, order, order_data, current_user.id)
    
    return updated_order


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
    
    order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Проверяем исполнителя
    assignee = db.query(User).filter(
        and_(
            User.id == uuid.UUID(assigned_to),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not assignee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignee not found"
        )
    
    # Назначаем заказ
    OrderService.assign_order(db, order, assignee.id, current_user.id)
    
    return {"message": "Order assigned successfully"}


@router.post("/{order_id}/complete")
async def complete_order(
    order_id: uuid.UUID,
    completion_notes: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Завершить заказ"""
    
    order = OrderService.get_order_by_id(db, order_id, current_user.organization_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Проверяем права на завершение
    can_complete = (
        current_user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER] or
        order.assigned_to == current_user.id
    )
    
    if not can_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to complete this order"
        )
    
    if order.status != OrderStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must be in progress to complete"
        )
    
    # Завершаем заказ
    completed_order = OrderService.complete_order(db, order, current_user.id, completion_notes)
    
    return {"message": "Order completed successfully", "completed_at": completed_order.completed_at}


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
    
    stats = OrderService.get_orders_statistics(
        db=db,
        organization_id=current_user.organization_id,
        period_days=period_days
    )
    
    return stats