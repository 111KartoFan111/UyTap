# models/payment_models.py - ОКОНЧАТЕЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base

# Enum классы для использования в схемах Pydantic
class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class PaymentType(str, enum.Enum):
    DEPOSIT = "deposit"
    RENT_PAYMENT = "rent_payment"
    ADDITIONAL = "additional"
    PENALTY = "penalty"
    REFUND = "refund"

# Модель платежа - ИСПОЛЬЗУЕМ ТОЛЬКО STRING ТИПЫ ДЛЯ ENUM ПОЛЕЙ
class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    rental_id = Column(UUID(as_uuid=True), ForeignKey("rentals.id", ondelete="CASCADE"), nullable=False)
    
    # ИСПРАВЛЕНО: Используем String вместо Enum в модели SQLAlchemy
    payment_type = Column(String(50), nullable=False)  # Вместо Enum(PaymentType)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="KZT")
    
    # ИСПРАВЛЕНО: Используем String вместо Enum в модели SQLAlchemy
    status = Column(String(50), default="pending")  # Вместо Enum(PaymentStatus)
    payment_method = Column(String(50))
    
    # Детали платежа
    description = Column(Text)
    reference_number = Column(String(100))
    external_transaction_id = Column(String(255))
    
    # Данные о плательщике
    payer_name = Column(String(255))
    payer_phone = Column(String(50))
    payer_email = Column(String(255))
    
    # Платежные данные
    card_last4 = Column(String(4))
    bank_name = Column(String(255))
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), default=func.now())
    processed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Дополнительные данные
    payment_metadata = Column("payment_metadata", Text)  # Переименовываем колонку
    notes = Column(Text)
    
    # Отношения
    organization = relationship("Organization")
    rental = relationship("Rental", back_populates="payments")