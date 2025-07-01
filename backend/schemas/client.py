import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator



class ClientBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    document_issued_by: Optional[str] = None
    document_issued_date: Optional[datetime] = None
    country: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    postal_code: Optional[str] = Field(None, max_length=20)
    source: Optional[str] = Field(None, max_length=100)
    preferences: Optional[Dict[str, Any]] = {}
    notes: Optional[str] = None
    date_of_birth: Optional[datetime] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    document_issued_by: Optional[str] = None
    document_issued_date: Optional[datetime] = None
    country: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    postal_code: Optional[str] = Field(None, max_length=20)
    source: Optional[str] = Field(None, max_length=100)
    preferences: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    date_of_birth: Optional[datetime] = None


class ClientResponse(ClientBase):
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime
    last_visit: Optional[datetime]
    total_rentals: int
    total_spent: float

    @validator('id', 'organization_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)