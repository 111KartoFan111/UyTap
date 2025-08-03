# models/payroll_template.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base
from .extended_models import PayrollType

class PayrollTemplateStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"

class PayrollTemplate(Base):
    __tablename__ = "payroll_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Основные настройки
    name = Column(String(255), nullable=False)  # "Стандартный оклад менеджера"
    description = Column(Text)
    status = Column(Enum(PayrollTemplateStatus), default=PayrollTemplateStatus.ACTIVE)
    
    # Базовые параметры зарплаты
    payroll_type = Column(Enum(PayrollType), nullable=False)
    base_rate = Column(Float, nullable=False)
    
    # Автоматические надбавки
    automatic_allowances = Column(JSONB, default=dict)  # {"transport": 15000, "food": 10000}
    
    # Настройки расчета
    calculate_overtime = Column(Boolean, default=False)
    overtime_rate_multiplier = Column(Float, default=1.5)  # Коэффициент сверхурочных
    
    include_task_payments = Column(Boolean, default=True)
    task_payment_rate = Column(Float, default=0)  # Доплата за задачу
    
    # Автоматические вычеты
    automatic_deductions = Column(JSONB, default=dict)  # {"uniform": 5000}
    
    # Налогообложение
    tax_rate = Column(Float, default=0.1)      # 10%
    social_rate = Column(Float, default=0.1)   # 10%
    
    # Периодичность применения
    auto_apply_monthly = Column(Boolean, default=True)
    
    # Даты
    effective_from = Column(DateTime, default=func.now())
    effective_until = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization")
    user = relationship("User", back_populates="payroll_templates")
    payroll_entries = relationship("Payroll", back_populates="template")
    
    def __repr__(self):
        return f"<PayrollTemplate(name='{self.name}', user_id='{self.user_id}', status='{self.status}')>"