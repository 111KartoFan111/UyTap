from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base
from .models import Organization

class AcquiringProvider(str, enum.Enum):
    KASPI = "kaspi"
    HALYK = "halyk"
    JUSAN = "jusan"
    SBERBANK = "sberbank"
    FORTE = "forte"
    EPAY = "epay"
    OTHER = "other"

class AcquiringSettings(Base):
    __tablename__ = "acquiring_settings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # Основные настройки
    is_enabled = Column(Boolean, default=False)
    default_provider = Column(String(50))  # Основной провайдер
    
    # Настройки провайдеров
    providers_config = Column(JSONB, default=dict)  # Конфигурация для каждого провайдера
    
    # Общие настройки
    auto_capture = Column(Boolean, default=True)  # Автоматическое списание
    payment_description_template = Column(String(255), default="Оплата аренды #{rental_id}")
    success_redirect_url = Column(String(500))
    failure_redirect_url = Column(String(500))
    
    # Webhooks
    webhook_url = Column(String(500))
    webhook_secret = Column(String(255))
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization", back_populates="acquiring_settings")

# Добавляем в models/models.py связь с Organization
# Organization.acquiring_settings = relationship("AcquiringSettings", back_populates="organization", uselist=False, cascade="all, delete-orphan")

Organization.acquiring_settings = relationship("AcquiringSettings", back_populates="organization")