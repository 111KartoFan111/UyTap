# backend/services/order_payment_service.py - НОВЫЙ СЕРВИС ДЛЯ ПЛАТЕЖЕЙ ЗАКАЗОВ
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
import uuid
import json

from models.order_payment_models import OrderPayment, OrderPaymentStatus, OrderPaymentMethod
from models.extended_models import RoomOrder, OrderStatus

class OrderPaymentService:
    """Сервис для обработки платежей по заказам"""
    
    @staticmethod
    def create_order_payment(
        db: Session,
        order_id: uuid.UUID,
        amount: float,
        payment_method: str,
        payer_name: str = None,
        payer_phone: str = None,
        description: str = None,
        auto_complete: bool = True,
        organization_id: uuid.UUID = None
    ) -> OrderPayment:
        """Создать платеж для заказа"""
        
        # Проверяем существование заказа
        order = db.query(RoomOrder).filter(
            and_(
                RoomOrder.id == order_id,
                RoomOrder.organization_id == organization_id if organization_id else True
            )
        ).first()
        
        if not order:
            raise ValueError("Order not found")
        
        # Создаем платеж
        payment = OrderPayment(
            id=uuid.uuid4(),
            organization_id=order.organization_id,
            order_id=order_id,
            amount=amount,
            payment_method=OrderPaymentMethod(payment_method),
            payer_name=payer_name,
            payer_phone=payer_phone,
            description=description or f"Оплата заказа {order.order_number}",
            status=OrderPaymentStatus.PENDING
        )
        
        db.add(payment)
        db.flush()  # Получаем ID
        
        # Автоматически завершаем если требуется
        if auto_complete:
            payment = OrderPaymentService.complete_payment(db, payment.id)
        
        db.commit()
        db.refresh(payment)
        
        return payment
    
    @staticmethod
    def complete_payment(db: Session, payment_id: uuid.UUID) -> OrderPayment:
        """Завершить платеж"""
        
        payment = db.query(OrderPayment).filter(OrderPayment.id == payment_id).first()
        if not payment:
            raise ValueError("Payment not found")
        
        if payment.status != OrderPaymentStatus.PENDING:
            raise ValueError(f"Cannot complete payment with status {payment.status}")
        
        # Обновляем статус платежа
        payment.status = OrderPaymentStatus.COMPLETED
        payment.completed_at = datetime.now(timezone.utc)
        payment.processed_at = datetime.now(timezone.utc)
        
        # Обновляем заказ как оплаченный
        order = payment.order
        if order:
            order.is_paid = True
            order.updated_at = datetime.now(timezone.utc)
        
        return payment
    
    @staticmethod
    def process_sale_payment(
        db: Session,
        order_id: uuid.UUID,
        payment_data: Dict[str, Any],
        organization_id: uuid.UUID
    ) -> OrderPayment:
        """Обработать платеж за продажу товаров"""
        
        # Получаем заказ
        order = db.query(RoomOrder).filter(
            and_(
                RoomOrder.id == order_id,
                RoomOrder.organization_id == organization_id
            )
        ).first()
        
        if not order:
            raise ValueError("Order not found")
        
        if order.is_paid:
            raise ValueError("Order is already paid")
        
        # Создаем платеж
        payment = OrderPayment(
            id=uuid.uuid4(),
            organization_id=organization_id,
            order_id=order_id,
            amount=payment_data.get('amount', order.total_amount),
            payment_method=OrderPaymentMethod(payment_data.get('method', 'cash')),
            payer_name=payment_data.get('payer_name'),
            payer_phone=payment_data.get('payer_phone'),
            payer_email=payment_data.get('payer_email'),
            description=f"Продажа товаров - заказ {order.order_number}",
            reference_number=payment_data.get('reference_number'),
            card_last4=payment_data.get('card_last4'),
            bank_name=payment_data.get('bank_name'),
            status=OrderPaymentStatus.PROCESSING
        )
        
        db.add(payment)
        db.flush()
        
        # Завершаем платеж
        payment.status = OrderPaymentStatus.COMPLETED
        payment.completed_at = datetime.now(timezone.utc)
        payment.processed_at = datetime.now(timezone.utc)
        
        # Обновляем заказ
        order.is_paid = True
        order.updated_at = datetime.now(timezone.utc)
        
        # Если заказ еще не завершен - завершаем его
        if order.status != OrderStatus.DELIVERED:
            order.status = OrderStatus.DELIVERED
            order.completed_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(payment)
        
        return payment
    
    @staticmethod
    def get_order_payments(
        db: Session,
        order_id: uuid.UUID,
        organization_id: uuid.UUID = None
    ) -> List[OrderPayment]:
        """Получить все платежи по заказу"""
        
        query = db.query(OrderPayment).filter(OrderPayment.order_id == order_id)
        
        if organization_id:
            query = query.filter(OrderPayment.organization_id == organization_id)
        
        return query.order_by(desc(OrderPayment.created_at)).all()
    
    @staticmethod
    def get_payment_status(
        db: Session,
        order_id: uuid.UUID,
        organization_id: uuid.UUID = None
    ) -> Dict[str, Any]:
        """Получить статус оплаты заказа"""
        
        # Получаем заказ
        order = db.query(RoomOrder).filter(
            and_(
                RoomOrder.id == order_id,
                RoomOrder.organization_id == organization_id if organization_id else True
            )
        ).first()
        
        if not order:
            raise ValueError("Order not found")
        
        # Получаем платежи
        payments = OrderPaymentService.get_order_payments(db, order_id, organization_id)
        
        completed_payments = [p for p in payments if p.status == OrderPaymentStatus.COMPLETED]
        total_paid = sum(p.amount for p in completed_payments)
        
        return {
            "order_id": str(order_id),
            "order_number": order.order_number,
            "total_amount": order.total_amount,
            "paid_amount": total_paid,
            "outstanding_amount": max(0, order.total_amount - total_paid),
            "is_fully_paid": total_paid >= order.total_amount,
            "is_paid": order.is_paid,
            "payment_count": len(payments),
            "completed_payments": len(completed_payments),
            "last_payment_date": max(
                (p.completed_at for p in completed_payments if p.completed_at), 
                default=None
            ),
            "payment_methods_used": list(set(p.payment_method.value for p in completed_payments))
        }
    
    @staticmethod
    def cancel_payment(
        db: Session,
        payment_id: uuid.UUID,
        reason: str = None
    ) -> OrderPayment:
        """Отменить платеж"""
        
        payment = db.query(OrderPayment).filter(OrderPayment.id == payment_id).first()
        if not payment:
            raise ValueError("Payment not found")
        
        if payment.status == OrderPaymentStatus.COMPLETED:
            raise ValueError("Cannot cancel completed payment")
        
        payment.status = OrderPaymentStatus.CANCELLED
        payment.failure_reason = reason
        payment.failed_at = datetime.now(timezone.utc)
        
        if reason:
            payment.notes = (payment.notes or "") + f"\nОтменен: {reason}"
        
        db.commit()
        return payment
    
    @staticmethod
    def create_refund(
        db: Session,
        order_id: uuid.UUID,
        refund_amount: float,
        reason: str,
        organization_id: uuid.UUID,
        refund_method: str = "cash"
    ) -> OrderPayment:
        """Создать возврат"""
        
        order = db.query(RoomOrder).filter(
            and_(
                RoomOrder.id == order_id,
                RoomOrder.organization_id == organization_id
            )
        ).first()
        
        if not order:
            raise ValueError("Order not found")
        
        # Создаем возврат как отрицательный платеж
        refund = OrderPayment(
            id=uuid.uuid4(),
            organization_id=organization_id,
            order_id=order_id,
            amount=-abs(refund_amount),  # Отрицательная сумма для возврата
            payment_method=OrderPaymentMethod(refund_method),
            description=f"Возврат по заказу {order.order_number}: {reason}",
            status=OrderPaymentStatus.COMPLETED,
            processed_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            notes=f"Возврат: {reason}"
        )
        
        db.add(refund)
        db.commit()
        db.refresh(refund)
        
        return refund
    
    @staticmethod
    def get_payment_summary(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Dict[str, Any]:
        """Получить сводку по платежам организации"""
        
        query = db.query(OrderPayment).filter(
            OrderPayment.organization_id == organization_id
        )
        
        if start_date:
            query = query.filter(OrderPayment.created_at >= start_date)
        if end_date:
            query = query.filter(OrderPayment.created_at <= end_date)
        
        payments = query.all()
        completed_payments = [p for p in payments if p.status == OrderPaymentStatus.COMPLETED]
        
        # Группировка по методам оплаты
        payment_methods = {}
        for method in OrderPaymentMethod:
            method_payments = [p for p in completed_payments if p.payment_method == method]
            if method_payments:
                payment_methods[method.value] = {
                    "count": len(method_payments),
                    "total_amount": sum(p.amount for p in method_payments)
                }
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "totals": {
                "total_payments": len(payments),
                "completed_payments": len(completed_payments),
                "total_amount": sum(p.amount for p in completed_payments),
                "average_payment": sum(p.amount for p in completed_payments) / len(completed_payments) if completed_payments else 0
            },
            "by_method": payment_methods,
            "by_status": {
                status.value: len([p for p in payments if p.status == status])
                for status in OrderPaymentStatus
            }
        }