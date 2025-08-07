# backend/routers/order_payments.py - ИСПРАВЛЕННЫЕ API РОУТЫ ДЛЯ ПЛАТЕЖЕЙ ЗАКАЗОВ
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
import uuid

from models.database import get_db
from models.order_payment_models import OrderPayment, OrderPaymentStatus
from models.extended_models import RoomOrder
from models.models import User, UserRole
from services.order_payment_service import OrderPaymentService
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/orders", tags=["Order Payments"])

# Схемы для API
class OrderPaymentCreate(BaseModel):
    amount: float = Field(..., gt=0)
    payment_method: str = Field(..., max_length=50)
    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None
    reference_number: Optional[str] = None
    card_last4: Optional[str] = Field(None, max_length=4, min_length=4)
    bank_name: Optional[str] = None
    notes: Optional[str] = None
    auto_complete: bool = Field(default=True)

class SalePaymentRequest(BaseModel):
    amount: Optional[float] = None  # Если не указано - берем сумму заказа
    method: str = Field(default="cash")
    payer_name: str
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None
    reference_number: Optional[str] = None
    card_last4: Optional[str] = None
    bank_name: Optional[str] = None

class OrderPaymentResponse(BaseModel):
    id: str
    order_id: str
    amount: float
    currency: str
    status: str
    payment_method: str
    payer_name: Optional[str]
    payer_phone: Optional[str]
    description: Optional[str]
    reference_number: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class PaymentStatusResponse(BaseModel):
    order_id: str
    order_number: str
    total_amount: float
    paid_amount: float
    outstanding_amount: float
    is_fully_paid: bool
    is_paid: bool
    payment_count: int
    completed_payments: int
    last_payment_date: Optional[datetime]
    payment_methods_used: List[str]

@router.post("/{order_id}/payment", response_model=OrderPaymentResponse)
async def create_order_payment(
    order_id: str,
    payment_data: OrderPaymentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать платеж для заказа"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to process payments"
        )
    
    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format"
        )
    
    try:
        payment = OrderPaymentService.create_order_payment(
            db=db,
            order_id=order_uuid,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            payer_name=payment_data.payer_name,
            payer_phone=payment_data.payer_phone,
            description=f"Платеж по заказу",
            auto_complete=payment_data.auto_complete,
            organization_id=current_user.organization_id
        )
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="order_payment_created",
            organization_id=current_user.organization_id,
            resource_type="order_payment",
            resource_id=payment.id,
            details={
                "order_id": order_id,
                "amount": payment_data.amount,
                "method": payment_data.payment_method
            }
        )
        
        return OrderPaymentResponse.from_orm(payment)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/{order_id}/sale-payment", response_model=OrderPaymentResponse)
async def process_sale_payment(
    order_id: str,
    payment_data: SalePaymentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обработать платеж за продажу товаров"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to process sale payments"
        )
    
    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format"
        )
    
    try:
        payment_dict = {
            "amount": payment_data.amount,
            "method": payment_data.method,
            "payer_name": payment_data.payer_name,
            "payer_phone": payment_data.payer_phone,
            "payer_email": payment_data.payer_email,
            "reference_number": payment_data.reference_number,
            "card_last4": payment_data.card_last4,
            "bank_name": payment_data.bank_name
        }
        
        payment = OrderPaymentService.process_sale_payment(
            db=db,
            order_id=order_uuid,
            payment_data=payment_dict,
            organization_id=current_user.organization_id
        )
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="sale_payment_processed",
            organization_id=current_user.organization_id,
            resource_type="order_payment",
            resource_id=payment.id,
            details={
                "order_id": order_id,
                "amount": payment.amount,
                "method": payment_data.method,
                "payer": payment_data.payer_name
            }
        )
        
        return OrderPaymentResponse.from_orm(payment)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/{order_id}/payments", response_model=List[OrderPaymentResponse])
async def get_order_payments(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить все платежи по заказу"""
    
    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format"
        )
    
    try:
        payments = OrderPaymentService.get_order_payments(
            db=db,
            order_id=order_uuid,
            organization_id=current_user.organization_id
        )
        
        return [OrderPaymentResponse.from_orm(payment) for payment in payments]
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.get("/{order_id}/payment-status", response_model=PaymentStatusResponse)
async def get_order_payment_status(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить статус оплаты заказа"""
    
    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format"
        )
    
    try:
        payment_status = OrderPaymentService.get_payment_status(
            db=db,
            order_id=order_uuid,
            organization_id=current_user.organization_id
        )
        
        return PaymentStatusResponse(**payment_status)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.post("/{order_id}/payments/{payment_id}/complete", response_model=OrderPaymentResponse)
async def complete_order_payment(
    order_id: str,
    payment_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Завершить платеж вручную"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to complete payments"
        )
    
    try:
        payment_uuid = uuid.UUID(payment_id)
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Проверяем что платеж принадлежит указанному заказу
    payment = db.query(OrderPayment).filter(
        and_(
            OrderPayment.id == payment_uuid,
            OrderPayment.order_id == order_uuid,
            OrderPayment.organization_id == current_user.organization_id
        )
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    try:
        completed_payment = OrderPaymentService.complete_payment(db, payment_uuid)
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="order_payment_completed",
            organization_id=current_user.organization_id,
            resource_type="order_payment",
            resource_id=payment.id,
            details={
                "order_id": order_id,
                "payment_id": payment_id,
                "amount": payment.amount
            }
        )
        
        return OrderPaymentResponse.from_orm(completed_payment)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{order_id}/payments/{payment_id}/cancel")
async def cancel_order_payment(
    order_id: str,
    payment_id: str,
    reason: Optional[str] = Query(None, min_length=1),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отменить платеж"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to cancel payments"
        )
    
    try:
        payment_uuid = uuid.UUID(payment_id)
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Проверяем что платеж принадлежит указанному заказу
    payment = db.query(OrderPayment).filter(
        and_(
            OrderPayment.id == payment_uuid,
            OrderPayment.order_id == order_uuid,
            OrderPayment.organization_id == current_user.organization_id
        )
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    try:
        cancelled_payment = OrderPaymentService.cancel_payment(db, payment_uuid, reason)
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="order_payment_cancelled",
            organization_id=current_user.organization_id,
            resource_type="order_payment",
            resource_id=payment.id,
            details={
                "order_id": order_id,
                "payment_id": payment_id,
                "amount": payment.amount,
                "reason": reason
            }
        )
        
        return {"message": "Payment cancelled successfully", "payment_id": payment_id}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/{order_id}/refund", response_model=OrderPaymentResponse)
async def create_order_refund(
    order_id: str,
    refund_amount: float = Query(..., gt=0),
    reason: str = Query(..., min_length=1),
    refund_method: str = Query(default="cash"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать возврат по заказу"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create refunds"
        )
    
    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format"
        )
    
    try:
        refund = OrderPaymentService.create_refund(
            db=db,
            order_id=order_uuid,
            refund_amount=refund_amount,
            reason=reason,
            organization_id=current_user.organization_id,
            refund_method=refund_method
        )
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="order_refund_created",
            organization_id=current_user.organization_id,
            resource_type="order_payment",
            resource_id=refund.id,
            details={
                "order_id": order_id,
                "refund_amount": refund_amount,
                "reason": reason,
                "method": refund_method
            }
        )
        
        return OrderPaymentResponse.from_orm(refund)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Refund creation failed: {str(e)}"
        )

@router.get("/payments/summary")
async def get_payments_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить сводку по платежам организации"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view payment summary"
        )
    
    try:
        # Парсим даты если указаны
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        summary = OrderPaymentService.get_payment_summary(
            db=db,
            organization_id=current_user.organization_id,
            start_date=start_dt,
            end_date=end_dt
        )
        
        return summary
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get payment summary: {str(e)}"
        )