# models/payroll_operation.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base

class PayrollOperationType(str, enum.Enum):
    BONUS = "bonus"                    # Премия
    PENALTY = "penalty"                # Штраф
    OVERTIME = "overtime"              # Сверхурочные
    ALLOWANCE = "allowance"            # Надбавка
    DEDUCTION = "deduction"            # Удержание
    COMMISSION = "commission"          # Комиссионные
    HOLIDAY_PAY = "holiday_pay"        # Праздничная доплата
    SICK_LEAVE = "sick_leave"          # Больничные
    VACATION_PAY = "vacation_pay"      # Отпускные
    ADVANCE = "advance"                # Аванс
    CORRECTION = "correction"          # Корректировка

class PayrollOperation(Base):
    __tablename__ = "payroll_operations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    payroll_id = Column(UUID(as_uuid=True), ForeignKey("payrolls.id"))  # Может быть NULL для будущих операций
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Тип операции
    operation_type = Column(Enum(PayrollOperationType), nullable=False)
    
    # Сумма (положительная для доходов, отрицательная для вычетов)
    amount = Column(Float, nullable=False)
    
    # Описание
    title = Column(String(255), nullable=False)
    description = Column(Text)
    reason = Column(Text)  # Причина штрафа/премии
    
    # Период применения
    apply_to_period_start = Column(DateTime, nullable=False)
    apply_to_period_end = Column(DateTime, nullable=False)
    
    # Настройки применения
    is_recurring = Column(Boolean, default=False)  # Повторяющаяся операция
    recurrence_months = Column(Integer, default=1)  # Каждые N месяцев
    
    # Статус
    is_applied = Column(Boolean, default=False)
    applied_at = Column(DateTime)
    
    # Метаданные - ИСПРАВЛЕНО НАЗВАНИЕ ПОЛЯ
    operation_metadata = Column(JSONB, default=dict)  # Дополнительная информация
    
    # Даты
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization")
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
    payroll = relationship("Payroll", back_populates="operations")