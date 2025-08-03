# backend/models/payroll_operation.py - ИСПРАВЛЕННАЯ ВЕРСИЯ

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base

class PayrollOperationType(str, enum.Enum):
    BONUS = "bonus"
    PENALTY = "penalty"
    OVERTIME = "overtime"
    ALLOWANCE = "allowance"
    DEDUCTION = "deduction"
    COMMISSION = "commission"
    HOLIDAY_PAY = "holiday_pay"
    SICK_LEAVE = "sick_leave"
    VACATION_PAY = "vacation_pay"
    ADVANCE = "advance"
    CORRECTION = "correction"

class PayrollOperation(Base):
    __tablename__ = "payroll_operations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    payroll_id = Column(UUID(as_uuid=True), ForeignKey("payrolls.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Тип операции
    operation_type = Column(Enum(PayrollOperationType), nullable=False)
    
    # Сумма
    amount = Column(Float, nullable=False)
    
    # Описание
    title = Column(String(255), nullable=False)
    description = Column(Text)
    reason = Column(Text)
    
    # Период применения
    apply_to_period_start = Column(DateTime, nullable=False)
    apply_to_period_end = Column(DateTime, nullable=False)
    
    # Настройки применения
    is_recurring = Column(Boolean, default=False)
    recurrence_months = Column(Integer, default=1)
    
    # Статус
    is_applied = Column(Boolean, default=False)
    applied_at = Column(DateTime)
    
    # Метаданные
    operation_metadata = Column(JSONB, default=dict)
    
    # Даты
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # ИСПРАВЛЕННЫЕ ОТНОШЕНИЯ
    organization = relationship("Organization")
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
    
    # Правильная связь с зарплатой
    payroll = relationship("Payroll", back_populates="operations")