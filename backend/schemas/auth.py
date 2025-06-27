from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
from models.models import UserRole, UserStatus
import re


# Базовые схемы для токенов
class TokenData(BaseModel):
    user_id: str
    organization_id: Optional[str] = None
    role: Optional[UserRole] = None
    scopes: List[str] = []


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    organization_slug: Optional[str] = None
    device_info: Optional[Dict[str, Any]] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: 'UserResponse'  # Forward reference

    class Config:
        from_attributes = True


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LogoutRequest(BaseModel):
    refresh_token: str
    logout_all_devices: bool = False


class MessageResponse(BaseModel):
    message: str
    success: bool = True


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


def validate_password_strength(password: str) -> str:
    """Валидация силы пароля"""
    errors = []
    
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    
    if len(password) > 128:
        errors.append("Password must be no more than 128 characters")
    
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    
    if not re.search(r'\d', password):
        errors.append("Password must contain at least one digit")
    
    if errors:
        raise ValueError("; ".join(errors))
    
    return password


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @validator('new_password')
    def validate_password(cls, v):
        return validate_password_strength(v)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    organization_slug: Optional[str] = None


class ResetPasswordConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @validator('new_password')
    def validate_password(cls, v):
        return validate_password_strength(v)


# Схемы для создания пользователей и организаций
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    role: str = Field(default="admin")

    @validator('role')
    def validate_role(cls, v):
        # Исключаем system_owner - его может создать только система
        valid_roles = [role.value for role in UserRole if role != UserRole.SYSTEM_OWNER]
        if v not in valid_roles:
            raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
        return v

    @validator('password')
    def validate_password(cls, v):
        return validate_password_strength(v)


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


class SystemInitRequest(BaseModel):
    organization: OrganizationCreate
    admin_user: UserCreate


# Обновляем forward reference для LoginResponse
LoginResponse.model_rebuild()