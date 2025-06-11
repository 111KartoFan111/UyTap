from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
import re
from models.models import UserRole, UserStatus, OrganizationStatus


# Базовые схемы для организации
class OrganizationBase(BaseModel):
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


class OrganizationCreate(OrganizationBase):
    # Дополнительные поля для создания
    subscription_plan: str = Field(default="basic", max_length=50)
    max_users: int = Field(default=10, ge=1, le=1000)
    max_properties: int = Field(default=50, ge=1, le=10000)


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
    settings: Optional[Dict[str, Any]] = None


class OrganizationResponse(OrganizationBase):
    id: str
    status: OrganizationStatus
    subscription_plan: str
    max_users: int
    max_properties: int
    trial_ends_at: Optional[datetime]
    subscription_ends_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    settings: Dict[str, Any]

    class Config:
        from_attributes = True


# Базовые схемы для пользователя
class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    role: UserRole

    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^\+?[\d\s\-\(\)]+, v'):
            raise ValueError('Invalid phone number format')
        return v


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    organization_id: Optional[str] = None  # Для system_owner не требуется

    @validator('password')
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    avatar_url: Optional[str] = Field(None, max_length=500)
    preferences: Optional[Dict[str, Any]] = None

    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^\+?[\d\s\-\(\)]+, v'):
            raise ValueError('Invalid phone number format')
        return v


class UserResponse(UserBase):
    id: str
    organization_id: Optional[str]
    status: UserStatus
    email_verified: bool
    phone_verified: bool
    two_factor_enabled: bool
    last_login_at: Optional[datetime]
    last_activity_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    avatar_url: Optional[str]
    preferences: Dict[str, Any]
    organization: Optional[OrganizationResponse]

    class Config:
        from_attributes = True


# Схемы для авторизации
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    organization_slug: Optional[str] = Field(None, pattern=r'^[a-z0-9_-]+$')
    remember_me: bool = False
    device_info: Optional[Dict[str, Any]] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None
    logout_all_devices: bool = False


# Схемы для смены пароля
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @validator('new_password')
    def validate_new_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    organization_slug: Optional[str] = Field(None, pattern=r'^[a-z0-9_-]+')


class ResetPasswordConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @validator('new_password')
    def validate_new_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v


# Схемы для создания первой организации и пользователя
class SystemInitRequest(BaseModel):
    # Данные организации
    organization: OrganizationCreate
    # Данные администратора
    admin_user: UserCreate


# Схемы для списков и фильтрации
class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    size: int
    pages: int


class OrganizationListResponse(BaseModel):
    items: List[OrganizationResponse]
    total: int
    page: int
    size: int
    pages: int


# Схемы для токенов
class TokenData(BaseModel):
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    role: Optional[UserRole] = None
    scopes: List[str] = []


# Схемы для аудита
class UserActionResponse(BaseModel):
    id: str
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    details: Optional[Dict[str, Any]]
    success: bool
    error_message: Optional[str]
    created_at: datetime
    user: Optional[UserResponse]

    class Config:
        from_attributes = True


class LoginAttemptResponse(BaseModel):
    id: str
    email: str
    success: bool
    failure_reason: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Общие схемы ответов
class MessageResponse(BaseModel):
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    error: str
    details: Optional[Dict[str, Any]] = None
    success: bool = False