from models.extended_models import OrderStatus, PaymentMethod
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, validator
import uuid
from schemas.property import PropertyResponse
from schemas.client import ClientResponse


from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid


class OrderItemBase(BaseModel):
    """Enhanced order item with inventory integration"""
    inventory_id: Optional[str] = None  # ✅ NEW: Link to inventory
    name: str
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    total_price: float = Field(..., ge=0)
    notes: Optional[str] = None
    
    # ✅ NEW: Service vs inventory item distinction
    is_inventory_item: bool = True
    
    @validator('inventory_id')
    def validate_inventory_link(cls, v, values):
        """Validate inventory ID is required for inventory items"""
        if values.get('is_inventory_item', True) and not v:
            raise ValueError('inventory_id is required for inventory items')
        return v



class RoomOrderBase(BaseModel):
    property_id: str
    order_type: str = Field(..., max_length=50)  # "food", "service", "delivery"
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    items: List[OrderItemBase] = []
    total_amount: float = Field(..., ge=0)
    payment_method: Optional[PaymentMethod] = None
    scheduled_for: Optional[datetime] = None
    special_instructions: Optional[str] = None
    executor_type: Optional[str] = None  # ✅ fix
    payment_to_executor: float = Field(0, ge=0)
    payment_type: Optional[str] = None  # ✅ fix


class RoomOrderCreate(BaseModel):
    """Enhanced order creation with inventory validation"""
    property_id: str
    order_type: str = Field(..., max_length=50)
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    items: List[OrderItemBase] = []
    total_amount: float = Field(..., ge=0)
    special_instructions: Optional[str] = None
    
    # Enhanced fields
    client_id: Optional[str] = None
    rental_id: Optional[str] = None
    assigned_to: Optional[str] = None


class RoomOrderUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[OrderStatus] = None
    assigned_to: Optional[str] = None
    items: Optional[List[OrderItemBase]] = None
    total_amount: Optional[float] = Field(None, ge=0)
    payment_method: Optional[PaymentMethod] = None
    is_paid: Optional[bool] = None
    scheduled_for: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    special_instructions: Optional[str] = None
    payment_to_executor: Optional[float] = Field(None, ge=0)
    payment_type: Optional[str] = None


class RoomOrderResponse(RoomOrderBase):
    id: str
    organization_id: str
    order_number: str
    client_id: Optional[str]
    rental_id: Optional[str]
    assigned_to: Optional[str]
    status: OrderStatus
    is_paid: bool
    requested_at: datetime
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Связанные объекты
    property: Optional[PropertyResponse] = None
    client: Optional[ClientResponse] = None

    @validator('id', 'organization_id', 'property_id', 'client_id', 'rental_id', 'assigned_to', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True