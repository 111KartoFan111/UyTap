# services/payment_service.py
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
import uuid
import json

from models.payment_models import Payment, PaymentStatus, PaymentType
from models.extended_models import Rental
from schemas.payment import (
    PaymentCreate, PaymentUpdate, ProcessPaymentRequest,
    PaymentStatusResponse, PaymentHistoryResponse
)

class PaymentService:
    """Сервис для управления платежами"""
    
    @staticmethod
    def create_payment(
        db: Session,
        rental_id: uuid.UUID,
        payment_data: PaymentCreate,
        organization_id: uuid.UUID
    ) -> Payment:
        """Создать новый платеж"""
        
        # Проверяем существование аренды
        rental = db.query(Rental).filter(
            and_(
                Rental.id == rental_id,
                Rental.organization_id == organization_id
            )
        ).first()
        
        if not rental:
            raise ValueError("Rental not found")
        
        # Создаем платеж
        payment = Payment(
            id=uuid.uuid4(),
            organization_id=organization_id,
            rental_id=rental_id,
            **payment_data.dict(),
            status=PaymentStatus.PENDING
        )
        
        db.add(payment)
        db.commit()
        db.refresh(payment)
        
        return payment
    
    @staticmethod
    def process_payment(
        db: Session,
        rental_id: uuid.UUID,
        payment_request: ProcessPaymentRequest,
        organization_id: uuid.UUID
    ) -> Payment:
        """Обработать платеж"""
        
        # Создаем платеж
        payment_data = PaymentCreate(
            payment_type=payment_request.payment_type,
            amount=payment_request.payment_amount,
            payment_method=payment_request.payment_method,
            description=payment_request.description,
            payer_name=payment_request.payer_name,
            payer_phone=payment_request.payer_phone,
            payer_email=payment_request.payer_email,
            reference_number=payment_request.reference_number,
            card_last4=payment_request.card_last4,
            bank_name=payment_request.bank_name
        )
        
        payment = PaymentService.create_payment(
            db, rental_id, payment_data, organization_id
        )
        
        # Обновляем статус платежа
        if payment_request.external_transaction_id:
            payment.external_transaction_id = payment_request.external_transaction_id
        
        payment.status = PaymentStatus.PROCESSING
        payment.processed_at = datetime.now(timezone.utc)
        
        # Если указано автозавершение
        if payment_request.auto_complete:
            payment = PaymentService.complete_payment(db, payment.id)
        
        db.commit()
        db.refresh(payment)
        
        return payment
    
    @staticmethod
    def complete_payment(db: Session, payment_id: uuid.UUID) -> Payment:
        """Завершить платеж"""
        
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            raise ValueError("Payment not found")
        
        if payment.status not in [PaymentStatus.PENDING, PaymentStatus.PROCESSING]:
            raise ValueError(f"Cannot complete payment with status {payment.status}")
        
        # Обновляем статус платежа
        payment.status = PaymentStatus.COMPLETED
        payment.completed_at = datetime.now(timezone.utc)
        
        # Обновляем оплаченную сумму в аренде
        rental = payment.rental
        if rental:
            if payment.payment_type == PaymentType.REFUND:
                # Для возврата вычитаем сумму
                rental.paid_amount = max(0, rental.paid_amount - payment.amount)
            else:
                # Для всех остальных типов добавляем сумму
                rental.paid_amount += payment.amount
            
            # Обновляем статистику клиента
            if rental.client:
                if payment.payment_type == PaymentType.REFUND:
                    rental.client.total_spent = max(0, rental.client.total_spent - payment.amount)
                else:
                    rental.client.total_spent += payment.amount
        
        db.commit()
        return payment
    
    @staticmethod
    def get_payment_status(
        db: Session,
        rental_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> PaymentStatusResponse:
        """Получить статус оплаты аренды"""
        
        rental = db.query(Rental).filter(
            and_(
                Rental.id == rental_id,
                Rental.organization_id == organization_id
            )
        ).first()
        
        if not rental:
            raise ValueError("Rental not found")
        
        # Получаем все платежи по аренде
        payments = db.query(Payment).filter(
            and_(
                Payment.rental_id == rental_id,
                Payment.status == PaymentStatus.COMPLETED
            )
        ).all()
        
        # Считаем залог отдельно
        deposit_payments = [p for p in payments if p.payment_type == PaymentType.DEPOSIT]
        deposit_amount = sum(p.amount for p in deposit_payments)
        
        # Основные платежи (исключая возвраты)
        main_payments = [p for p in payments if p.payment_type != PaymentType.REFUND]
        refund_payments = [p for p in payments if p.payment_type == PaymentType.REFUND]
        
        total_paid = sum(p.amount for p in main_payments) - sum(p.amount for p in refund_payments)
        outstanding_amount = max(0, rental.total_amount - total_paid)
        
        # Последний платеж
        last_payment = db.query(Payment).filter(
            and_(
                Payment.rental_id == rental_id,
                Payment.status == PaymentStatus.COMPLETED
            )
        ).order_by(desc(Payment.completed_at)).first()
        
        # Методы оплаты
        payment_methods = list(set(p.payment_method for p in payments if p.payment_method))
        
        # Проверяем просрочку (упрощенно - если прошло более 3 дней после заселения без полной оплаты)
        is_overdue = False
        if rental.check_in_time and outstanding_amount > 0:
            days_since_checkin = (datetime.now(timezone.utc) - rental.check_in_time).days
            is_overdue = days_since_checkin > 3
        
        return PaymentStatusResponse(
            rental_id=str(rental_id),
            total_amount=rental.total_amount,
            paid_amount=total_paid,
            outstanding_amount=outstanding_amount,
            deposit_amount=deposit_amount,
            payment_completion_percentage=round((total_paid / rental.total_amount) * 100, 2) if rental.total_amount > 0 else 0,
            last_payment_date=last_payment.completed_at if last_payment else None,
            payment_count=len(payments),
            payment_methods_used=payment_methods,
            is_fully_paid=outstanding_amount <= 0,
            is_overdue=is_overdue
        )
    
    @staticmethod
    def get_payment_history(
        db: Session,
        rental_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> PaymentHistoryResponse:
        """Получить историю платежей по аренде"""
        
        # Проверяем существование аренды
        rental = db.query(Rental).filter(
            and_(
                Rental.id == rental_id,
                Rental.organization_id == organization_id
            )
        ).first()
        
        if not rental:
            raise ValueError("Rental not found")
        
        # Получаем все платежи
        payments = db.query(Payment).filter(
            Payment.rental_id == rental_id
        ).order_by(desc(Payment.created_at)).all()
        
        # Группируем по типам
        type_summary = {}
        for payment_type in PaymentType:
            type_payments = [p for p in payments if p.payment_type == payment_type and p.status == PaymentStatus.COMPLETED]
            if type_payments:
                type_summary[payment_type.value] = sum(p.amount for p in type_payments)
        
        # Группируем по методам
        method_summary = {}
        for payment in payments:
            if payment.status == PaymentStatus.COMPLETED and payment.payment_method:
                if payment.payment_method not in method_summary:
                    method_summary[payment.payment_method] = 0
                method_summary[payment.payment_method] += payment.amount
        
        # Общая сумма оплаченного
        completed_payments = [p for p in payments if p.status == PaymentStatus.COMPLETED]
        total_paid = sum(p.amount for p in completed_payments if p.payment_type != PaymentType.REFUND)
        total_refunded = sum(p.amount for p in completed_payments if p.payment_type == PaymentType.REFUND)
        net_paid = total_paid - total_refunded
        
        return PaymentHistoryResponse(
            rental_id=str(rental_id),
            payments=[PaymentResponse.from_orm(p) for p in payments],
            total_payments=len(payments),
            total_paid_amount=net_paid,
            payment_summary_by_type=type_summary,
            payment_summary_by_method=method_summary
        )
    
    @staticmethod
    def cancel_payment(db: Session, payment_id: uuid.UUID, reason: str = None) -> Payment:
        """Отменить платеж"""
        
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            raise ValueError("Payment not found")
        
        if payment.status == PaymentStatus.COMPLETED:
            raise ValueError("Cannot cancel completed payment")
        
        payment.status = PaymentStatus.CANCELLED
        if reason:
            payment.notes = (payment.notes or "") + f"\nОтменен: {reason}"
        
        db.commit()
        return payment
    
    @staticmethod
    def create_refund(
        db: Session,
        rental_id: uuid.UUID,
        refund_amount: float,
        reason: str,
        organization_id: uuid.UUID,
        original_payment_id: Optional[uuid.UUID] = None
    ) -> Payment:
        """Создать возврат"""
        
        refund_data = PaymentCreate(
            payment_type=PaymentType.REFUND,
            amount=refund_amount,
            payment_method="refund",
            description=f"Возврат: {reason}"
        )
        
        refund = PaymentService.create_payment(
            db, rental_id, refund_data, organization_id
        )
        
        # Сразу завершаем возврат
        refund = PaymentService.complete_payment(db, refund.id)
        
        return refund
    
    @staticmethod
    def get_payments_by_rental(
        db: Session,
        rental_id: uuid.UUID,
        status: Optional[PaymentStatus] = None
    ) -> List[Payment]:
        """Получить платежи по аренде"""
        
        query = db.query(Payment).filter(Payment.rental_id == rental_id)
        
        if status:
            query = query.filter(Payment.status == status)
        
        return query.order_by(desc(Payment.created_at)).all()