from models.extended_models import PayrollType
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator

class PayrollBase(BaseModel):
    user_id: str
    period_start: datetime
    period_end: datetime
    payroll_type: PayrollType
    base_rate: Optional[float] = Field(None, ge=0)
    hours_worked: float = Field(0, ge=0)
    tasks_completed: int = Field(0, ge=0)
    tasks_payment: float = Field(0, ge=0)
    bonus: float = Field(0, ge=0)
    tips: float = Field(0, ge=0)
    other_income: float = Field(0, ge=0)
    deductions: float = Field(0, ge=0)
    taxes: float = Field(0, ge=0)
    notes: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    organization_id: Optional[str]
    email: str
    first_name: str
    last_name: str
    middle_name: Optional[str]
    phone: Optional[str]
    role: str
    status: str
    email_verified: bool
    phone_verified: bool
    two_factor_enabled: bool
    last_login_at: Optional[datetime]
    last_activity_at: Optional[datetime]
    password_changed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    preferences: Dict[str, Any]

    @validator('id', 'organization_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True

class PayrollCreate(PayrollBase):
    @validator('period_end')
    def validate_period(cls, v, values):
        if 'period_start' in values and v <= values['period_start']:
            raise ValueError('Period end must be after period start')
        return v


class PayrollUpdate(BaseModel):
    base_rate: Optional[float] = Field(None, ge=0)
    hours_worked: Optional[float] = Field(None, ge=0)
    tasks_completed: Optional[int] = Field(None, ge=0)
    tasks_payment: Optional[float] = Field(None, ge=0)
    bonus: Optional[float] = Field(None, ge=0)
    tips: Optional[float] = Field(None, ge=0)
    other_income: Optional[float] = Field(None, ge=0)
    deductions: Optional[float] = Field(None, ge=0)
    taxes: Optional[float] = Field(None, ge=0)
    is_paid: Optional[bool] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class PayrollResponse(PayrollBase):
    id: str
    organization_id: str
    gross_amount: float
    net_amount: float
    is_paid: bool
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    user: Optional[UserResponse] = None

    @validator('id', 'organization_id', 'user_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        orm_mode = True