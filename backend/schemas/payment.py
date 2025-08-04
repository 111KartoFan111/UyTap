# schemas/payment.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, Union
from datetime import datetime
import uuid

# Определяем enum значения как константы (проще для отладки)
class PaymentType:
    DEPOSIT = "deposit"
    RENT_PAYMENT = "rent_payment"  
    ADDITIONAL = "additional"
    PENALTY = "penalty"
    REFUND = "refund"

class PaymentStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class PaymentBase(BaseModel):
    payment_type: str  # Используем str вместо enum
    amount: float = Field(..., gt=0, description="Сумма платежа")
    currency: str = Field(default="KZT", max_length=3)
    payment_method: str = Field(..., max_length=50)
    description: Optional[str] = None
    payer_name: Optional[str] = Field(None, max_length=255)
    payer_phone: Optional[str] = Field(None, max_length=50)
    payer_email: Optional[str] = None
    
    @validator('payment_type')
    def validate_payment_type(cls, v):
        valid_types = [
            PaymentType.DEPOSIT,
            PaymentType.RENT_PAYMENT,
            PaymentType.ADDITIONAL,
            PaymentType.PENALTY,
            PaymentType.REFUND
        ]
        if v not in valid_types:
            raise ValueError(f'payment_type must be one of: {valid_types}')
        return v

class PaymentCreate(PaymentBase):
    reference_number: Optional[str] = Field(None, max_length=100)
    card_last4: Optional[str] = Field(None, max_length=4, min_length=4)
    bank_name: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None

class PaymentUpdate(BaseModel):
    status: Optional[str] = None
    external_transaction_id: Optional[str] = Field(None, max_length=255)
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    processed_at: Optional[datetime] = None

class PaymentResponse(PaymentBase):
    id: str
    organization_id: str
    rental_id: str
    status: str
    reference_number: Optional[str]
    external_transaction_id: Optional[str]
    card_last4: Optional[str]
    bank_name: Optional[str]
    created_at: datetime
    processed_at: Optional[datetime]
    completed_at: Optional[datetime]
    notes: Optional[str]

    @validator('id', 'organization_id', 'rental_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True

# Специальные схемы для роутов
class CheckInPaymentRequest(BaseModel):
    payment_amount: float = Field(..., gt=0)
    payment_method: str = Field(..., max_length=50)
    payment_type: str = Field(default=PaymentType.RENT_PAYMENT)
    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    reference_number: Optional[str] = None
    card_last4: Optional[str] = None
    notes: Optional[str] = None
    
    @validator('payment_type')
    def validate_payment_type(cls, v):
        valid_types = [
            PaymentType.DEPOSIT,
            PaymentType.RENT_PAYMENT,
            PaymentType.ADDITIONAL,
            PaymentType.PENALTY,
            PaymentType.REFUND
        ]
        if v not in valid_types:
            raise ValueError(f'payment_type must be one of: {valid_types}')
        return v

class ProcessPaymentRequest(BaseModel):
    payment_amount: float = Field(..., gt=0)
    payment_method: str = Field(..., max_length=50)
    payment_type: str = Field(default=PaymentType.RENT_PAYMENT)
    description: Optional[str] = None
    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None
    reference_number: Optional[str] = None
    card_last4: Optional[str] = None
    bank_name: Optional[str] = None
    external_transaction_id: Optional[str] = None
    auto_complete: bool = Field(default=True, description="Автоматически завершить платеж")
    notes: Optional[str] = None  # Добавляем поле notes
    
    @validator('payment_type')
    def validate_payment_type(cls, v):
        valid_types = [
            PaymentType.DEPOSIT,
            PaymentType.RENT_PAYMENT,
            PaymentType.ADDITIONAL,
            PaymentType.PENALTY,
            PaymentType.REFUND
        ]
        if v not in valid_types:
            raise ValueError(f'payment_type must be one of: {valid_types}')
        return v

class PaymentStatusResponse(BaseModel):
    rental_id: str
    total_amount: float
    paid_amount: float
    outstanding_amount: float
    deposit_amount: float
    payment_completion_percentage: float
    last_payment_date: Optional[datetime]
    payment_count: int
    payment_methods_used: list[str]
    is_fully_paid: bool
    is_overdue: bool

class PaymentHistoryResponse(BaseModel):
    rental_id: str
    payments: list[PaymentResponse]
    total_payments: int
    total_paid_amount: float
    payment_summary_by_type: Dict[str, float]
    payment_summary_by_method: Dict[str, float]

class CheckInWithPaymentRequest(BaseModel):
    payment_required: bool = Field(default=True)
    payment_amount: Optional[float] = Field(None, gt=0)
    payment_method: Optional[str] = None
    payment_type: str = Field(default=PaymentType.RENT_PAYMENT)
    payer_name: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None