# models/payment_models.py
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base

# Enums для платежей
class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class PaymentType(str, enum.Enum):
    DEPOSIT = "deposit"          # Залог
    RENT_PAYMENT = "rent_payment"  # Основная оплата аренды
    ADDITIONAL = "additional"     # Дополнительная оплата
    PENALTY = "penalty"          # Штраф
    REFUND = "refund"           # Возврат

# Модель платежа
class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    rental_id = Column(UUID(as_uuid=True), ForeignKey("rentals.id", ondelete="CASCADE"), nullable=False)
    
    # Основная информация о платеже
    payment_type = Column(Enum(PaymentType), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="KZT")
    
    # Статус и метод
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_method = Column(String(50))  # cash, card, transfer, qr_code
    
    # Детали платежа
    description = Column(Text)
    reference_number = Column(String(100))  # Номер транзакции/чека
    external_transaction_id = Column(String(255))  # ID во внешней платежной системе
    
    # Данные о плательщике (для карт/переводов)
    payer_name = Column(String(255))
    payer_phone = Column(String(50))
    payer_email = Column(String(255))
    
    # Платежные данные
    card_last4 = Column(String(4))  # Последние 4 цифры карты
    bank_name = Column(String(255))
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), default=func.now())
    processed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Дополнительные данные
    metadata = Column(Text)  # JSON строка с дополнительными данными
    notes = Column(Text)
    
    # Отношения
    organization = relationship("Organization")
    rental = relationship("Rental", back_populates="payments")

# Добавляем связь в модель Rental
# В extended_models.py нужно добавить:
# payments = relationship("Payment", back_populates="rental", cascade="all, delete-orphan")