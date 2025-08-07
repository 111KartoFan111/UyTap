# backend/models/order_payment_models.py - НОВАЯ МОДЕЛЬ ДЛЯ ПЛАТЕЖЕЙ ЗАКАЗОВ
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base

class OrderPaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class OrderPaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    QR_CODE = "qr_code"
    MOBILE_MONEY = "mobile_money"

class OrderPayment(Base):
    """Модель для платежей по заказам (отдельно от rental payments)"""
    __tablename__ = "order_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    order_id = Column(UUID(as_uuid=True), ForeignKey("room_orders.id", ondelete="CASCADE"), nullable=False)
    
    # Финансовые данные
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="KZT")
    status = Column(Enum(OrderPaymentStatus), default=OrderPaymentStatus.PENDING)
    payment_method = Column(Enum(OrderPaymentMethod), nullable=False)
    
    # Детали платежа
    description = Column(Text)
    reference_number = Column(String(100))
    transaction_id = Column(String(255))
    
    # Данные о плательщике
    payer_name = Column(String(255))
    payer_phone = Column(String(50))
    payer_email = Column(String(255))
    
    # Платежные данные
    card_last4 = Column(String(4))
    bank_name = Column(String(255))
    receipt_url = Column(String(500))
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), default=func.now())
    processed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    failed_at = Column(DateTime(timezone=True))
    
    # Дополнительные данные
    payment_metadata = Column(Text)  # JSON строка
    notes = Column(Text)
    failure_reason = Column(String(255))
    
    # Отношения
    organization = relationship("Organization")
    order = relationship("RoomOrder", back_populates="payments")

# Обновляем модель RoomOrder для добавления связи с платежами
# Добавить в extended_models.py в класс RoomOrder:
"""
# В RoomOrder добавить:
payments = relationship("OrderPayment", back_populates="order", cascade="all, delete-orphan")
"""