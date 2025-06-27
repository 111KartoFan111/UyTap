from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime
import uuid
from models.models import UserRole, UserStatus, OrganizationStatus


# Схемы для организаций в админке
class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r'^[a-z0-9_-]+')
    description: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    postal_code: Optional[str] = Field(None, max_length=20)
    subscription_plan: str = Field(default="basic", max_length=50)
    max_users: int = Field(default=10, ge=1, le=1000)
    max_properties: int = Field(default=50, ge=1, le=10000)
    status: str = Field(default="trial")

    @validator('status')
    def validate_status(cls, v):
        valid_statuses = [status.value for status in OrganizationStatus]
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    postal_code: Optional[str] = Field(None, max_length=20)
    subscription_plan: Optional[str] = Field(None, max_length=50)
    max_users: Optional[int] = Field(None, ge=1, le=1000)
    max_properties: Optional[int] = Field(None, ge=1, le=10000)
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [status.value for status in OrganizationStatus]
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    country: Optional[str]
    city: Optional[str]
    address: Optional[str]
    postal_code: Optional[str]
    status: str
    subscription_plan: str
    max_users: int
    max_properties: int
    trial_ends_at: Optional[datetime]
    subscription_ends_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    settings: Dict[str, Any]
    user_count: Optional[int] = 0  # Добавляем счетчик пользователей

    @validator('id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


# Схемы для пользователей в админке
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    role: str = Field(default="admin")
    status: str = Field(default="active")

    @validator('role')
    def validate_role(cls, v):
        # Исключаем system_owner - его может создать только система
        valid_roles = [role.value for role in UserRole if role != UserRole.SYSTEM_OWNER]
        if v not in valid_roles:
            raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
        return v

    @validator('status')
    def validate_status(cls, v):
        valid_statuses = [status.value for status in UserStatus]
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

    @validator('password')
    def validate_password(cls, v):
        import re
        errors = []
        
        if len(v) < 8:
            errors.append("Password must be at least 8 characters long")
        
        if len(v) > 128:
            errors.append("Password must be no more than 128 characters")
        
        if not re.search(r'[A-Z]', v):
            errors.append("Password must contain at least one uppercase letter")
        
        if not re.search(r'[a-z]', v):
            errors.append("Password must contain at least one lowercase letter")
        
        if not re.search(r'\d', v):
            errors.append("Password must contain at least one digit")
        
        if errors:
            raise ValueError("; ".join(errors))
        
        return v


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    role: Optional[str] = None
    status: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None

    @validator('role')
    def validate_role(cls, v):
        if v is not None:
            valid_roles = [role.value for role in UserRole if role != UserRole.SYSTEM_OWNER]
            if v not in valid_roles:
                raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
        return v

    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [status.value for status in UserStatus]
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v


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


# Схема для статистики системы
class SystemStatsResponse(BaseModel):
    organizations: Dict[str, int]
    users: Dict[str, int]
    roles: Dict[str, int]

    class Config:
        from_attributes = True


# Схема для списков с пагинацией
class OrganizationListResponse(BaseModel):
    items: list[OrganizationResponse]
    total: int
    page: int
    size: int
    pages: int


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    size: int
    pages: int