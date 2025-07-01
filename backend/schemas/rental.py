from models.extended_models import RentalType, PaymentMethod
import uuid
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, validator
from schemas.property import PropertyResponse
from schemas.client import ClientResponse

class RentalBase(BaseModel):
    property_id: str
    client_id: str
    rental_type: RentalType
    start_date: datetime
    end_date: datetime
    rate: float = Field(..., gt=0)
    total_amount: float = Field(..., gt=0)
    deposit: Optional[float] = Field(0, ge=0)
    payment_method: Optional[PaymentMethod] = None
    guest_count: int = Field(1, ge=1)
    additional_guests: Optional[List[Dict[str, str]]] = []
    notes: Optional[str] = None
    special_requests: Optional[str] = None


class RentalCreate(RentalBase):
    @validator('end_date')
    def validate_dates(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('End date must be after start date')
        return v


class RentalUpdate(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    rate: Optional[float] = Field(None, gt=0)
    total_amount: Optional[float] = Field(None, gt=0)
    deposit: Optional[float] = Field(None, ge=0)
    paid_amount: Optional[float] = Field(None, ge=0)
    payment_method: Optional[PaymentMethod] = None
    guest_count: Optional[int] = Field(None, ge=1)
    additional_guests: Optional[List[Dict[str, str]]] = None
    notes: Optional[str] = None
    special_requests: Optional[str] = None
    checked_in: Optional[bool] = None
    checked_out: Optional[bool] = None


class RentalResponse(RentalBase):
    id: str
    organization_id: str
    is_active: bool
    checked_in: bool
    checked_out: bool
    check_in_time: Optional[datetime]
    check_out_time: Optional[datetime]
    paid_amount: float
    created_at: datetime
    updated_at: datetime
    
    # Связанные объекты
    property: Optional[PropertyResponse] = None
    client: Optional[ClientResponse] = None

    @validator('id', 'organization_id', 'property_id', 'client_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True