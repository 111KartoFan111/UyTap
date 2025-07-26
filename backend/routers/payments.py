# routers/payments.py
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from models.database import get_db
from models.extended_models import Rental
from models.payment_models import Payment, PaymentStatus, PaymentType
from models.models import User, UserRole
from schemas.payment import (
    PaymentCreate, PaymentResponse, PaymentStatusResponse, 
    PaymentHistoryResponse, ProcessPaymentRequest, CheckInPaymentRequest,
    CheckInWithPaymentRequest
)
from services.payment_service import PaymentService
from services.rental_service import RentalService
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user

router = APIRouter(prefix="/api/rentals", tags=["Rental Payments"])

@router.post("/{rental_id}/payment-checkin", response_model=PaymentResponse)
async def process_checkin_payment(
    rental_id: str,
    payment_data: CheckInPaymentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обработка платежа при заселении"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to process payments"
        )
    
    try:
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rental ID format"
        )
    
    # Проверяем существование аренды
    rental = db.query(Rental).filter(
        and_(
            Rental.id == rental_uuid,
            Rental.organization_id == current_user.organization_id
        )
    ).first()
    
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    # Проверяем, что аренда еще не заселена
    if rental.checked_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rental is already checked in"
        )
    
    try:
        # Создаем платеж
        payment_request = ProcessPaymentRequest(
            payment_amount=payment_data.payment_amount,
            payment_method=payment_data.payment_method,
            payment_type=payment_data.payment_type,
            description=f"Платеж при заселении - {rental.property.name if rental.property else 'помещение'}",
            payer_name=payment_data.payer_name,
            payer_phone=payment_data.payer_phone,
            reference_number=payment_data.reference_number,
            card_last4=payment_data.card_last4,
            auto_complete=True
        )
        
        payment = PaymentService.process_payment(
            db=db,
            rental_id=rental_uuid,
            payment_request=payment_request,
            organization_id=current_user.organization_id
        )
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="checkin_payment_processed",
            organization_id=current_user.organization_id,
            resource_type="payment",
            resource_id=payment.id,
            details={
                "rental_id": rental_id,
                "amount": payment_data.payment_amount,
                "method": payment_data.payment_method
            }
        )
        
        return PaymentResponse.from_orm(payment)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment processing failed: {str(e)}"
        )

@router.post("/{rental_id}/payment", response_model=PaymentResponse)
async def add_payment_to_rental(
    rental_id: str,
    payment_request: ProcessPaymentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Добавление платежа к аренде"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to add payments"
        )
    
    try:
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rental ID format"
        )
    
    try:
        payment = PaymentService.process_payment(
            db=db,
            rental_id=rental_uuid,
            payment_request=payment_request,
            organization_id=current_user.organization_id
        )
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="payment_added",
            organization_id=current_user.organization_id,
            resource_type="payment",
            resource_id=payment.id,
            details={
                "rental_id": rental_id,
                "amount": payment_request.payment_amount,
                "type": payment_request.payment_type.value,
                "method": payment_request.payment_method
            }
        )
        
        return PaymentResponse.from_orm(payment)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment processing failed: {str(e)}"
        )

@router.post("/{rental_id}/check-in-with-payment")
async def check_in_with_payment(
    rental_id: str,
    checkin_data: CheckInWithPaymentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Заселение с поддержкой платежа"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to check in rentals"
        )
    
    try:
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rental ID format"
        )
    
    # Получаем аренду
    rental = db.query(Rental).filter(
        and_(
            Rental.id == rental_uuid,
            Rental.organization_id == current_user.organization_id
        )
    ).first()
    
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    if rental.checked_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rental is already checked in"
        )
    
    try:
        payment = None
        
        # Обрабатываем платеж если требуется
        if checkin_data.payment_required and checkin_data.payment_amount:
            if not checkin_data.payment_method:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payment method is required when payment_required is true"
                )
            
            payment_request = ProcessPaymentRequest(
                payment_amount=checkin_data.payment_amount,
                payment_method=checkin_data.payment_method,
                payment_type=checkin_data.payment_type,
                description=f"Платеж при заселении - {rental.property.name if rental.property else 'помещение'}",
                payer_name=checkin_data.payer_name,
                reference_number=checkin_data.reference_number,
                auto_complete=True
            )
            
            payment = PaymentService.process_payment(
                db=db,
                rental_id=rental_uuid,
                payment_request=payment_request,
                organization_id=current_user.organization_id
            )
        
        # Выполняем заселение
        checked_in_rental = RentalService.check_in(db, rental, current_user.id)
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="checkin_with_payment",
            organization_id=current_user.organization_id,
            resource_type="rental",
            resource_id=rental.id,
            details={
                "rental_id": rental_id,
                "payment_processed": payment is not None,
                "payment_amount": checkin_data.payment_amount if payment else 0,
                "check_in_time": checked_in_rental.check_in_time.isoformat()
            }
        )
        
        return {
            "message": "Check-in completed successfully",
            "check_in_time": checked_in_rental.check_in_time,
            "payment_processed": payment is not None,
            "payment": PaymentResponse.from_orm(payment) if payment else None,
            "rental_id": rental_id
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Check-in with payment failed: {str(e)}"
        )

@router.get("/{rental_id}/payments", response_model=PaymentHistoryResponse)
async def get_rental_payment_history(
    rental_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получение истории платежей по аренде"""
    
    try:
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rental ID format"
        )
    
    try:
        history = PaymentService.get_payment_history(
            db=db,
            rental_id=rental_uuid,
            organization_id=current_user.organization_id
        )
        
        return history
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get payment history: {str(e)}"
        )

@router.get("/{rental_id}/payment-status", response_model=PaymentStatusResponse)
async def get_rental_payment_status(
    rental_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получение статуса оплаты аренды"""
    
    try:
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rental ID format"
        )
    
    try:
        status_info = PaymentService.get_payment_status(
            db=db,
            rental_id=rental_uuid,
            organization_id=current_user.organization_id
        )
        
        return status_info
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get payment status: {str(e)}"
        )

# Дополнительные роуты для управления платежами

@router.put("/{rental_id}/payments/{payment_id}/complete", response_model=PaymentResponse)
async def complete_payment(
    rental_id: str,
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
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Проверяем что платеж принадлежит указанной аренде
    payment = db.query(Payment).filter(
        and_(
            Payment.id == payment_uuid,
            Payment.rental_id == rental_uuid,
            Payment.organization_id == current_user.organization_id
        )
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    try:
        completed_payment = PaymentService.complete_payment(db, payment_uuid)
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="payment_completed",
            organization_id=current_user.organization_id,
            resource_type="payment",
            resource_id=payment.id,
            details={
                "rental_id": rental_id,
                "payment_id": payment_id,
                "amount": payment.amount
            }
        )
        
        return PaymentResponse.from_orm(completed_payment)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{rental_id}/payments/{payment_id}/cancel")
async def cancel_payment(
    rental_id: str,
    payment_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отменить платеж"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to cancel payments"
        )
    
    try:
        payment_uuid = uuid.UUID(payment_id)
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Проверяем что платеж принадлежит указанной аренде
    payment = db.query(Payment).filter(
        and_(
            Payment.id == payment_uuid,
            Payment.rental_id == rental_uuid,
            Payment.organization_id == current_user.organization_id
        )
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    try:
        cancelled_payment = PaymentService.cancel_payment(db, payment_uuid, reason)
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="payment_cancelled",
            organization_id=current_user.organization_id,
            resource_type="payment",
            resource_id=payment.id,
            details={
                "rental_id": rental_id,
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

@router.post("/{rental_id}/refund", response_model=PaymentResponse)
async def create_refund(
    rental_id: str,
    refund_amount: float,
    reason: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать возврат средств"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create refunds"
        )
    
    if refund_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refund amount must be positive"
        )
    
    try:
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rental ID format"
        )
    
    try:
        refund = PaymentService.create_refund(
            db=db,
            rental_id=rental_uuid,
            refund_amount=refund_amount,
            reason=reason,
            organization_id=current_user.organization_id
        )
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="refund_created",
            organization_id=current_user.organization_id,
            resource_type="payment",
            resource_id=refund.id,
            details={
                "rental_id": rental_id,
                "refund_amount": refund_amount,
                "reason": reason
            }
        )
        
        return PaymentResponse.from_orm(refund)
        
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

# Дополнительные роуты для отчетности по платежам

@router.get("/{rental_id}/payments/summary")
async def get_payment_summary(
    rental_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить краткую сводку по платежам"""
    
    try:
        rental_uuid = uuid.UUID(rental_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rental ID format"
        )
    
    # Получаем платежи
    payments = PaymentService.get_payments_by_rental(db, rental_uuid)
    completed_payments = [p for p in payments if p.status == PaymentStatus.COMPLETED]
    
    # Группировка по статусам
    status_summary = {}
    for status in PaymentStatus:
        count = len([p for p in payments if p.status == status])
        if count > 0:
            status_summary[status.value] = count
    
    # Группировка по типам (только завершенные)
    type_summary = {}
    for payment_type in PaymentType:
        type_payments = [p for p in completed_payments if p.payment_type == payment_type]
        if type_payments:
            type_summary[payment_type.value] = {
                "count": len(type_payments),
                "total_amount": sum(p.amount for p in type_payments)
            }
    
    return {
        "rental_id": rental_id,
        "total_payments": len(payments),
        "completed_payments": len(completed_payments),
        "total_amount_paid": sum(p.amount for p in completed_payments if p.payment_type != PaymentType.REFUND),
        "total_refunded": sum(p.amount for p in completed_payments if p.payment_type == PaymentType.REFUND),
        "by_status": status_summary,
        "by_type": type_summary,
        "last_payment_date": max((p.completed_at for p in completed_payments if p.completed_at), default=None)
    }