from models.extended_models import TaskType, TaskPriority, TaskStatus
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator
import uuid
from schemas.property import PropertyResponse

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: TaskType
    priority: TaskPriority = TaskPriority.MEDIUM
    property_id: Optional[str] = None
    estimated_duration: Optional[int] = Field(None, gt=0)  # в минутах
    due_date: Optional[datetime] = None
    payment_amount: Optional[float] = Field(0, ge=0)
    payment_type: Optional[str] = Field("none")  # "fixed", "percentage", "none"


class TaskCreate(TaskBase):
    assigned_to: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: Optional[TaskType] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    assigned_to: Optional[str] = None
    property_id: Optional[str] = None
    estimated_duration: Optional[int] = Field(None, gt=0)
    actual_duration: Optional[int] = Field(None, gt=0)
    due_date: Optional[datetime] = None
    payment_amount: Optional[float] = Field(None, ge=0)
    payment_type: Optional[str] = None
    completion_notes: Optional[str] = None
    quality_rating: Optional[int] = Field(None, ge=1, le=5)


# Добавляем отдельную схему для пользователя
class UserBasicInfo(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    role: str
    
    @validator('id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


class TaskResponse(TaskBase):
    id: str
    organization_id: str
    status: TaskStatus
    assigned_to: Optional[str]
    created_by: Optional[str]
    actual_duration: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    is_paid: bool
    completion_notes: Optional[str]
    quality_rating: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    # Связанные объекты
    property: Optional[PropertyResponse] = None
    assignee: Optional[UserBasicInfo] = None
    creator: Optional[UserBasicInfo] = None

    @validator('id', 'organization_id', 'assigned_to', 'created_by', 'property_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True