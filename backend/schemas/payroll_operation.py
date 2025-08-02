# schemas/payroll_operation.py
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime
import uuid
from models.payroll_operation import PayrollOperationType

class PayrollOperationCreate(BaseModel):
    user_id: str
    operation_type: PayrollOperationType
    amount: float = Field(..., ne=0)  # Не может быть 0
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    reason: Optional[str] = None
    
    apply_to_period_start: datetime
    apply_to_period_end: datetime
    
    is_recurring: bool = False
    recurrence_months: int = Field(1, ge=1, le=12)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    @validator('amount')
    def validate_amount_by_type(cls, v, values):
        """Автоматически корректируем знак суммы в зависимости от типа операции"""
        operation_type = values.get('operation_type')
        if operation_type in [PayrollOperationType.PENALTY, PayrollOperationType.DEDUCTION]:
            if v > 0:
                v = -v  # Автоматически делаем отрицательным для штрафов и вычетов
        elif operation_type in [
            PayrollOperationType.BONUS, 
            PayrollOperationType.ALLOWANCE, 
            PayrollOperationType.COMMISSION,
            PayrollOperationType.OVERTIME,
            PayrollOperationType.HOLIDAY_PAY
        ]:
            if v < 0:
                raise ValueError(f'{operation_type.value} amount must be positive')
        return v
    
    @validator('apply_to_period_end')
    def validate_period(cls, v, values):
        """Проверяем корректность периода"""
        if 'apply_to_period_start' in values and v <= values['apply_to_period_start']:
            raise ValueError('Period end must be after period start')
        return v

class PayrollOperationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    reason: Optional[str] = None
    amount: Optional[float] = Field(None, ne=0)
    is_recurring: Optional[bool] = None
    recurrence_months: Optional[int] = Field(None, ge=1, le=12)
    metadata: Optional[Dict[str, Any]] = None

class PayrollOperationResponse(PayrollOperationCreate):
    id: str
    organization_id: str
    payroll_id: Optional[str]
    created_by: str
    is_applied: bool
    applied_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Дополнительная информация
    creator_name: Optional[str] = None
    user_name: Optional[str] = None
    
    @validator('id', 'organization_id', 'user_id', 'payroll_id', 'created_by', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True

# Схемы для быстрых операций
class QuickBonusRequest(BaseModel):
    amount: float = Field(..., gt=0)
    reason: str = Field(..., min_length=1)
    apply_to_current_month: bool = True

class QuickPenaltyRequest(BaseModel):
    amount: float = Field(..., gt=0)
    reason: str = Field(..., min_length=1)
    apply_to_current_month: bool = True

class QuickOvertimeRequest(BaseModel):
    hours: float = Field(..., gt=0, le=100)
    hourly_rate: Optional[float] = Field(None, gt=0)
    description: str = Field("Сверхурочная работа")

class PayrollOperationSummary(BaseModel):
    """Сводка по операциям"""
    operation_type: PayrollOperationType
    count: int
    total_amount: float
    operations: list[PayrollOperationResponse]

class PayrollOperationStats(BaseModel):
    """Статистика по операциям"""
    total_operations: int
    total_amount: float
    by_type: Dict[str, PayrollOperationSummary]
    pending_operations: int
    applied_operations: int