# backend/services/rental_service.py
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import uuid

from models.extended_models import (
    Rental, Property, Client, PropertyStatus, Task, TaskType, TaskStatus, RentalType
)
from schemas.rental import RentalCreate, RentalUpdate
from services.task_service import TaskService
from schemas.payment import (
    PaymentResponse, ProcessPaymentRequest,
)
from models.payment_models import Payment, PaymentStatus, PaymentType


class RentalService:

    """Сервис для управления арендой"""
    
    @staticmethod
    def get_rental_by_id(db: Session, rental_id: uuid.UUID, organization_id: uuid.UUID) -> Optional[Rental]:
        """Получить аренду по ID с проверкой принадлежности к организации"""
        return db.query(Rental).filter(
            and_(
                Rental.id == rental_id,
                Rental.organization_id == organization_id
            )
        ).first()
    
    @staticmethod
    def create_rental(
        db: Session,
        rental_data: RentalCreate,
        organization_id: uuid.UUID
    ) -> Rental:
        """Создать новую аренду"""
        
        rental = Rental(
            id=uuid.uuid4(),
            organization_id=organization_id,
            property_id=uuid.UUID(rental_data.property_id),
            client_id=uuid.UUID(rental_data.client_id),
            **rental_data.dict(exclude={'property_id', 'client_id'})
        )
        
        db.add(rental)
        
        # Обновляем статус помещения
        property_obj = db.query(Property).filter(Property.id == rental.property_id).first()
        if property_obj:
            property_obj.status = PropertyStatus.OCCUPIED
            property_obj.updated_at = datetime.now(timezone.utc)
        
        # Обновляем статистику клиента
        client = db.query(Client).filter(Client.id == rental.client_id).first()
        if client:
            client.total_rentals += 1
            client.total_spent += rental.total_amount
            client.last_visit = datetime.now(timezone.utc)
            client.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(rental)
        
        return rental
    
    @staticmethod
    def update_rental(
        db: Session,
        rental: Rental,
        rental_data: RentalUpdate
    ) -> Rental:
        """Обновить аренду"""
        
        # Сохраняем старые значения для сравнения
        old_total = rental.total_amount
        
        # Обновляем поля
        update_data = rental_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(rental, field, value)
        
        rental.updated_at = datetime.now(timezone.utc)
        
        # Если изменилась сумма, обновляем статистику клиента
        if 'total_amount' in update_data and rental.client:
            difference = rental.total_amount - old_total
            rental.client.total_spent += difference
        
        db.commit()
        db.refresh(rental)
        
        return rental
    
    @staticmethod
    def check_in(db: Session, rental: Rental, user_id: uuid.UUID) -> Rental:
        """Заселить клиента"""
        
        rental.checked_in = True
        rental.check_in_time = datetime.now(timezone.utc)
        rental.updated_at = datetime.now(timezone.utc)
        
        # Создаем задачу на проверку заселения
        if rental.property:
            task_data = {
                'title': f'Проверка заселения в {rental.property.name}',
                'description': f'Проверить заселение клиента {rental.client.first_name} {rental.client.last_name}',
                'task_type': TaskType.CHECK_IN,
                'priority': 'medium',
                'estimated_duration': 15,
                'payment_amount': 0,
                'payment_type': 'none'
            }
            
            TaskService.create_task(
                db=db,
                task_data=task_data,
                property_id=rental.property_id,
                created_by=user_id,
                organization_id=rental.organization_id
            )
        
        db.commit()
        db.refresh(rental)
        
        return rental
    
    @staticmethod
    def check_out(db: Session, rental: Rental, user_id: uuid.UUID) -> Rental:
        """Выселить клиента"""
        
        rental.checked_out = True
        rental.check_out_time = datetime.now(timezone.utc)
        rental.is_active = False
        rental.updated_at = datetime.now(timezone.utc)
        
        # Обновляем статус помещения на уборку
        if rental.property:
            rental.property.status = PropertyStatus.CLEANING
            rental.property.updated_at = datetime.now(timezone.utc)
            
            # Создаем задачу на уборку после выезда
            TaskService.create_cleaning_task(
                db=db,
                property_id=rental.property_id,
                created_by=user_id,
                organization_id=rental.organization_id,
                priority='high'
            )
        
        db.commit()
        db.refresh(rental)
        
        return rental
    
    @staticmethod
    def extend_rental_with_payment(
        db: Session,
        rental: Rental,
        new_end_date: datetime,
        additional_amount: float,
        payment_method: str = "cash",
        payment_notes: str = None
    ) -> Rental:
        """Продлить аренду с созданием платежа и уведомлением"""
        
        if new_end_date <= rental.end_date:
            raise ValueError("New end date must be after current end date")
        
        # Создаем платеж за продление КАК НЕОПЛАЧЕННЫЙ
        from models.payment_models import Payment, PaymentType, PaymentStatus
        
        extension_payment = Payment(
            id=uuid.uuid4(),
            organization_id=rental.organization_id,
            rental_id=rental.id,
            payment_type=PaymentType.ADDITIONAL,
            amount=additional_amount,
            currency="KZT",
            status=PaymentStatus.PENDING,  # ВАЖНО: ставим как неоплаченный!
            payment_method=payment_method,
            description=f"Доплата за продление аренды до {new_end_date.strftime('%d.%m.%Y')}",
            payer_name=f"{rental.client.first_name} {rental.client.last_name}" if rental.client else None,
            created_at=datetime.now(timezone.utc),
            notes=payment_notes
        )
        
        db.add(extension_payment)
        db.flush()  # Получаем ID платежа, но не коммитим пока
        
        # Обновляем аренду
        rental.end_date = new_end_date
        rental.total_amount += additional_amount
        rental.updated_at = datetime.now(timezone.utc)
        
        # НЕ обновляем paid_amount - платеж еще не оплачен!
        # rental.paid_amount += additional_amount  # <-- Убираем эту строку!
        
        # Обновляем статистику клиента (добавляем к общим тратам, но не к оплаченным)
        if rental.client:
            rental.client.total_spent += additional_amount
            rental.client.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(rental)
        
        # Отправляем уведомление о продлении и необходимости доплаты
        RentalService._send_extension_notification_with_payment(
            rental, new_end_date, additional_amount, extension_payment.id
        )
        
        return rental

    @staticmethod
    def _send_extension_notification_with_payment(rental: Rental, new_end_date: datetime, amount: float, payment_id: uuid.UUID):
        """Отправка уведомления о продлении аренды с требованием доплаты"""
        try:
            message = (
                f"🏠 Аренда продлена до {new_end_date.strftime('%d.%m.%Y %H:%M')}!\n\n"
                f"💰 Требуется доплата: {amount:,.0f} ₸\n"
                f"🏢 Помещение: {rental.property.name if rental.property else 'N/A'}\n\n"
                f"⚠️ ВАЖНО: Обратитесь к администратору для оплаты продления.\n"
                f"ID платежа: {str(payment_id)[:8]}..."
            )
            
            # Логируем уведомление
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Extension notification with payment sent to {rental.client.phone}: {message}")
            
            # TODO: Интегрировать с реальным SMS/Email сервисом
            # sms_service.send_sms(rental.client.phone, message)
            # email_service.send_email(rental.client.email, "Продление аренды - требуется доплата", message)
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send extension notification with payment: {e}")

    @staticmethod
    def complete_extension_payment(db: Session, payment_id: uuid.UUID) -> Payment:
        """Завершить оплату продления аренды"""
        
        payment = db.query(Payment).filter(
            and_(
                Payment.id == payment_id,
                Payment.payment_type == PaymentType.ADDITIONAL,
                Payment.status == PaymentStatus.PENDING
            )
        ).first()
        
        if not payment:
            raise ValueError("Extension payment not found or already completed")
        
        # Завершаем платеж
        payment.status = PaymentStatus.COMPLETED
        payment.completed_at = datetime.now(timezone.utc)
        
        # Обновляем оплаченную сумму в аренде
        if payment.rental:
            payment.rental.paid_amount += payment.amount
        
        db.commit()
        return payment

    @staticmethod
    def cancel_rental(
        db: Session,
        rental: Rental,
        reason: str,
        user_id: uuid.UUID
    ):
        """Отменить аренду"""
        
        rental.is_active = False
        rental.notes = f"Отменено: {reason}. " + (rental.notes or "")
        rental.updated_at = datetime.now(timezone.utc)
        
        # Освобождаем помещение
        if rental.property and not rental.checked_in:
            rental.property.status = PropertyStatus.AVAILABLE
            rental.property.updated_at = datetime.now(timezone.utc)
        
        # Обновляем статистику клиента (вычитаем сумму)
        if rental.client:
            rental.client.total_spent -= rental.total_amount
            rental.client.total_rentals -= 1
        
        db.commit()
    
    @staticmethod
    def _send_extension_notification(rental: Rental, new_end_date: datetime, amount: float):
        """Отправка уведомления о продлении аренды"""
        try:
            # Здесь можно интегрировать с SMS/Email сервисом
            message = (
                f"Аренда продлена до {new_end_date.strftime('%d.%m.%Y %H:%M')}. "
                f"Доплата: {amount:,.0f} ₸. "
                f"Помещение: {rental.property.name if rental.property else 'N/A'}. "
                f"Спасибо за выбор наших услуг!"
            )
            
            # Логируем уведомление
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Extension notification sent to {rental.client.phone}: {message}")
            
            # TODO: Интегрировать с реальным SMS/Email сервисом
            # sms_service.send_sms(rental.client.phone, message)
            # email_service.send_email(rental.client.email, "Продление аренды", message)
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send extension notification: {e}")
        
    
    
    
    @staticmethod
    def extend_rental(
        db: Session,
        rental: Rental,
        new_end_date: datetime,
        additional_amount: float
    ) -> Rental:
        """Продлить аренду (старый метод для обратной совместимости)"""
        return RentalService.extend_rental_with_payment(
            db, rental, new_end_date, additional_amount
        )
    
    @staticmethod
    def get_rental_statistics(
        db: Session,
        organization_id: uuid.UUID,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """Получить статистику по аренде"""
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Аренды за период
        rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.created_at >= start_date
            )
        ).all()
        
        # Активные аренды
        active_rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.is_active == True
            )
        ).all()
        
        # Группируем по типам аренды
        rental_types = {}
        for rental_type in RentalType:
            count = len([r for r in rentals if r.rental_type == rental_type])
            revenue = sum(r.total_amount for r in rentals if r.rental_type == rental_type)
            rental_types[rental_type.value] = {
                "count": count,
                "revenue": revenue,
                "avg_amount": revenue / count if count > 0 else 0
            }
        
        # Финансовые метрики
        total_revenue = sum(r.total_amount for r in rentals)
        paid_amount = sum(r.paid_amount for r in rentals)
        
        # Средняя продолжительность аренды
        completed_rentals = [r for r in rentals if r.checked_out]
        avg_duration = 0
        if completed_rentals:
            total_duration = sum(
                (r.check_out_time - r.check_in_time).days
                for r in completed_rentals
                if r.check_in_time and r.check_out_time
            )
            avg_duration = total_duration / len(completed_rentals)
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": period_days
            },
            "totals": {
                "total_rentals": len(rentals),
                "active_rentals": len(active_rentals),
                "completed_rentals": len(completed_rentals)
            },
            "financial": {
                "total_revenue": total_revenue,
                "paid_amount": paid_amount,
                "outstanding_amount": total_revenue - paid_amount,
                "avg_rental_value": total_revenue / len(rentals) if rentals else 0
            },
            "by_type": rental_types,
            "performance": {
                "avg_duration_days": avg_duration,
                "occupancy_rate": RentalService._calculate_occupancy_rate(db, organization_id, start_date, end_date)
            }
        }
    
    @staticmethod
    def _calculate_occupancy_rate(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """Вычислить коэффициент загруженности"""
        
        # Получаем все помещения организации
        total_properties = db.query(Property).filter(
            Property.organization_id == organization_id
        ).count()
        
        if total_properties == 0:
            return 0
        
        # Всего дней в периоде
        total_days = (end_date - start_date).days
        
        # Занятые дни
        occupied_days = 0
        
        rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                or_(
                    and_(Rental.start_date <= start_date, Rental.end_date > start_date),
                    and_(Rental.start_date < end_date, Rental.end_date >= end_date),
                    and_(Rental.start_date >= start_date, Rental.end_date <= end_date)
                )
            )
        ).all()
        
        for rental in rentals:
            overlap_start = max(rental.start_date, start_date)
            overlap_end = min(rental.end_date, end_date)
            if overlap_end > overlap_start:
                occupied_days += (overlap_end - overlap_start).days
        
        # Коэффициент загруженности в процентах
        return (occupied_days / (total_days * total_properties)) * 100 if total_days > 0 else 0