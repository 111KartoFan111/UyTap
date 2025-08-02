# schemas/payroll_template.py
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime
import uuid
from models.payroll_template import PayrollTemplateStatus
from models.extended_models import PayrollType

class PayrollTemplateCreate(BaseModel):
    user_id: str
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    payroll_type: PayrollType
    base_rate: float = Field(..., gt=0)
    
    # Автоматические надбавки
    automatic_allowances: Dict[str, float] = Field(default_factory=dict)
    
    # Настройки сверхурочных
    calculate_overtime: bool = False
    overtime_rate_multiplier: float = Field(1.5, gt=1.0, le=3.0)
    
    # Задачи
    include_task_payments: bool = True
    task_payment_rate: float = Field(0, ge=0)
    
    # Автоматические вычеты
    automatic_deductions: Dict[str, float] = Field(default_factory=dict)
    
    # Налоги
    tax_rate: float = Field(0.1, ge=0, le=0.5)
    social_rate: float = Field(0.1, ge=0, le=0.5)
    
    auto_apply_monthly: bool = True
    effective_from: datetime
    effective_until: Optional[datetime] = None
    
    @validator('automatic_allowances', 'automatic_deductions')
    def validate_amounts(cls, v):
        """Проверяем, что все суммы положительные"""
        for key, amount in v.items():
            if amount < 0:
                raise ValueError(f"Amount for {key} must be positive")
        return v
    
    @validator('effective_until')
    def validate_dates(cls, v, values):
        """Проверяем корректность дат"""
        if v and 'effective_from' in values:
            if v <= values['effective_from']:
                raise ValueError('effective_until must be after effective_from')
        return v

class PayrollTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    base_rate: Optional[float] = Field(None, gt=0)
    status: Optional[PayrollTemplateStatus] = None
    
    # Автоматические надбавки
    automatic_allowances: Optional[Dict[str, float]] = None
    
    # Настройки сверхурочных
    calculate_overtime: Optional[bool] = None
    overtime_rate_multiplier: Optional[float] = Field(None, gt=1.0, le=3.0)
    
    # Задачи
    include_task_payments: Optional[bool] = None
    task_payment_rate: Optional[float] = Field(None, ge=0)
    
    # Автоматические вычеты
    automatic_deductions: Optional[Dict[str, float]] = None
    
    # Налоги
    tax_rate: Optional[float] = Field(None, ge=0, le=0.5)
    social_rate: Optional[float] = Field(None, ge=0, le=0.5)
    
    auto_apply_monthly: Optional[bool] = None
    effective_until: Optional[datetime] = None

class PayrollTemplateResponse(PayrollTemplateCreate):
    id: str
    organization_id: str
    status: PayrollTemplateStatus
    created_at: datetime
    updated_at: datetime
    
    @validator('id', 'organization_id', 'user_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True

class PayrollTemplateListResponse(BaseModel):
    """Упрощенная схема для списка шаблонов"""
    id: str
    user_id: str
    name: str
    payroll_type: PayrollType
    base_rate: float
    status: PayrollTemplateStatus
    auto_apply_monthly: bool
    effective_from: datetime
    effective_until: Optional[datetime]
    
    # Информация о пользователе
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    
    @validator('id', 'user_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True