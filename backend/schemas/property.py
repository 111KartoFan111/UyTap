from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from models.extended_models import PropertyStatus, PropertyType


class PropertyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    number: str = Field(..., min_length=1, max_length=50)
    floor: Optional[int] = Field(None, ge=1)
    building: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    property_type: PropertyType
    area: Optional[float] = Field(None, gt=0)
    rooms_count: Optional[int] = Field(None, ge=1)
    max_occupancy: Optional[int] = Field(None, ge=1)
    description: Optional[str] = None
    amenities: Optional[List[str]] = []
    photos: Optional[List[str]] = []


class PropertyCreate(PropertyBase):
    hourly_rate: Optional[float] = Field(None, ge=0)
    daily_rate: Optional[float] = Field(None, ge=0)
    weekly_rate: Optional[float] = Field(None, ge=0)
    monthly_rate: Optional[float] = Field(None, ge=0)
    yearly_rate: Optional[float] = Field(None, ge=0)


class PropertyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    number: Optional[str] = Field(None, min_length=1, max_length=50)
    floor: Optional[int] = Field(None, ge=1)
    building: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    property_type: Optional[PropertyType] = None
    area: Optional[float] = Field(None, gt=0)
    rooms_count: Optional[int] = Field(None, ge=1)
    max_occupancy: Optional[int] = Field(None, ge=1)
    status: Optional[PropertyStatus] = None
    is_active: Optional[bool] = None
    hourly_rate: Optional[float] = Field(None, ge=0)
    daily_rate: Optional[float] = Field(None, ge=0)
    weekly_rate: Optional[float] = Field(None, ge=0)
    monthly_rate: Optional[float] = Field(None, ge=0)
    yearly_rate: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    amenities: Optional[List[str]] = None
    photos: Optional[List[str]] = None


class PropertyResponse(PropertyBase):
    id: str
    organization_id: str
    status: PropertyStatus
    is_active: bool
    hourly_rate: Optional[float]
    daily_rate: Optional[float]
    weekly_rate: Optional[float]
    monthly_rate: Optional[float]
    yearly_rate: Optional[float]
    created_at: datetime
    updated_at: datetime

    @validator('id', 'organization_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True