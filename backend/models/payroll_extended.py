# models/payroll_extended.py
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
from .database import Base
from .extended_models import PayrollType

# Обновляем существующую модель Payroll с новыми полями
class PayrollExtended(Base):
    __tablename__ = "payrolls"
    
    # Существующие поля из models/extended_models.py
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Период
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # Тип оплаты
    payroll_type = Column(Enum(PayrollType), nullable=False)
    
    # Базовая ставка
    base_rate = Column(Float)
    
    # Отработанное время (для почасовиков)
    hours_worked = Column(Float, default=0)
    
    # Выполненные задачи (для сдельщиков)
    tasks_completed = Column(Integer, default=0)
    tasks_payment = Column(Float, default=0)
    
    # Дополнительные доходы
    bonus = Column(Float, default=0)
    tips = Column(Float, default=0)
    other_income = Column(Float, default=0)
    
    # Вычеты
    deductions = Column(Float, default=0)
    taxes = Column(Float, default=0)
    
    # Итого
    gross_amount = Column(Float, nullable=False)
    net_amount = Column(Float, nullable=False)
    
    # Статус выплаты
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime)
    payment_method = Column(String(50))
    
    # Заметки
    notes = Column(Text)
    
    # Даты
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # НОВЫЕ ПОЛЯ ДЛЯ УЛУЧШЕННОЙ СИСТЕМЫ
    template_id = Column(UUID(as_uuid=True), ForeignKey("payroll_templates.id"))
    generated_from_template = Column(Boolean, default=False)
    
    # Детализация операций
    operations_summary = Column(JSONB, default=dict)  # Сводка по типам операций
    
    # Дополнительные поля
    overtime_hours = Column(Float, default=0)
    overtime_payment = Column(Float, default=0)
    allowances_total = Column(Float, default=0)
    penalties_total = Column(Float, default=0)
    
    # Отношения
    organization = relationship("Organization")
    user = relationship("User")
    template = relationship("PayrollTemplate", back_populates="payroll_entries")
    operations = relationship("PayrollOperation", back_populates="payroll")

# История изменений зарплат
class PayrollHistory(Base):
    __tablename__ = "payroll_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_id = Column(UUID(as_uuid=True), ForeignKey("payrolls.id"), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Что изменилось
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    change_reason = Column(Text)
    
    created_at = Column(DateTime, default=func.now())
    
    # Отношения
    payroll = relationship("PayrollExtended")
    user = relationship("User")