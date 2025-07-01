import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class InventoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    unit: str = Field(..., max_length=50)
    min_stock: float = Field(0, ge=0)
    max_stock: Optional[float] = Field(None, ge=0)
    cost_per_unit: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = Field(None, max_length=255)
    supplier_contact: Optional[str] = Field(None, max_length=255)


class InventoryCreate(InventoryBase):
    current_stock: float = Field(0, ge=0)


class InventoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=50)
    min_stock: Optional[float] = Field(None, ge=0)
    max_stock: Optional[float] = Field(None, ge=0)
    cost_per_unit: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = Field(None, max_length=255)
    supplier_contact: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class InventoryResponse(InventoryBase):
    id: str
    organization_id: str
    current_stock: float
    total_value: float
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_restock_date: Optional[datetime]

    @validator('id', 'organization_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class InventoryMovementBase(BaseModel):
    inventory_id: str
    movement_type: str = Field(..., regex="^(in|out|adjustment|writeoff)$")
    quantity: float = Field(..., ne=0)
    unit_cost: Optional[float] = Field(None, ge=0)
    reason: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None


class InventoryMovementCreate(InventoryMovementBase):
    task_id: Optional[str] = None


class InventoryMovementResponse(InventoryMovementBase):
    id: str
    organization_id: str
    user_id: Optional[str]
    task_id: Optional[str]
    total_cost: Optional[float]
    stock_after: float
    created_at: datetime

    @validator('id', 'organization_id', 'inventory_id', 'user_id', 'task_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True
