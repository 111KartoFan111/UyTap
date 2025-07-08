# backend/schemas/organization.py
from pydantic import BaseModel, EmailStr, Field, validator,field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
from models.models import UserRole, UserStatus
import re


class OrganizationInfoResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    address: Optional[str]
    city: Optional[str]
    country: Optional[str]
    status: str
    subscription_plan: str
    max_users: int
    max_properties: int
    trial_ends_at: Optional[datetime]
    subscription_ends_at: Optional[datetime]
    created_at: datetime
    settings: Dict[str, Any]
    statistics: Dict[str, int]

    @validator('id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class UserCreateForOrg(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    role: str = Field(default="manager")

    @validator('role')
    def validate_role(cls, v):
        # Исключаем system_owner - его может создать только система
        # Исключаем admin - его может создать только system_owner
        valid_roles = [
            UserRole.MANAGER.value,
            UserRole.TECHNICAL_STAFF.value,
            UserRole.ACCOUNTANT.value,
            UserRole.CLEANER.value,
            UserRole.STOREKEEPER.value
        ]
        if v not in valid_roles:
            raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
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


class UserUpdateForOrg(BaseModel):
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
            # Обычный админ может назначать только ограниченные роли
            valid_roles = [
                UserRole.MANAGER.value,
                UserRole.TECHNICAL_STAFF.value,
                UserRole.ACCOUNTANT.value,
                UserRole.CLEANER.value,
                UserRole.STOREKEEPER.value
            ]
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


class UserPerformanceResponse(BaseModel):
    user_info: Dict[str, Any]
    performance_period: Dict[str, Any]
    task_performance: Dict[str, Any]
    payroll_info: Dict[str, Any]

    class Config:
        from_attributes = True


class DashboardStatsResponse(BaseModel):
    organization_stats: Dict[str, int]
    today_stats: Dict[str, int]
    month_stats: Dict[str, Any]
    user_specific: Dict[str, Any]
    admin_specific: Dict[str, Any]

    class Config:
        from_attributes = True


class AvailableRoleResponse(BaseModel):
    value: str
    label: str
    description: str


class AvailableRolesResponse(BaseModel):
    available_roles: List[AvailableRoleResponse]


class PasswordResetResponse(BaseModel):
    message: str
    new_password: str
    warning: str


class AuditActionResponse(BaseModel):
    id: str
    user_id: Optional[str]
    user_name: str
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    success: bool
    details: Optional[Dict[str, Any]]
    created_at: datetime
    ip_address: Optional[str]

    class Config:
        from_attributes = True


class RecentActionsResponse(BaseModel):
    recent_actions: List[AuditActionResponse]


class StaffStatsByRole(BaseModel):
    manager: int = 0
    technical_staff: int = 0
    accountant: int = 0
    cleaner: int = 0
    storekeeper: int = 0


class TasksAttention(BaseModel):
    pending_tasks: int
    overdue_tasks: int


class OrdersAttention(BaseModel):
    pending_orders: int


class OrganizationHealth(BaseModel):
    subscription_status: str
    user_limit_usage: str
    property_limit_usage: str


class AdminSpecificStats(BaseModel):
    staff_by_role: Dict[str, int]
    tasks_attention: TasksAttention
    orders_attention: OrdersAttention
    organization_health: OrganizationHealth


# Дополнительные схемы для статистики персонала
class StaffMemberStats(BaseModel):
    user_id: str
    name: str
    role: str
    email: str
    phone: Optional[str]
    status: str
    active_tasks: int
    completed_last_month: int
    avg_quality_rating: Optional[float]
    workload_status: str
    last_activity: Optional[datetime]

    class Config:
        from_attributes = True


class StaffOverviewResponse(BaseModel):
    total_staff: int
    by_role: Dict[str, int]
    by_status: Dict[str, int]
    workload_distribution: Dict[str, int]
    staff_members: List[StaffMemberStats]


# Схемы для управления организационными настройками
class OrganizationSettingsUpdate(BaseModel):
    working_hours_start: Optional[str] = Field(
        None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
    )
    working_hours_end: Optional[str] = Field(
        None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
    )
    timezone: Optional[str] = None
    currency: Optional[str] = Field(None, max_length=3)
    default_check_in_time: Optional[str] = Field(
        None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
    )
    default_check_out_time: Optional[str] = Field(
        None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
    )
    auto_assign_tasks: Optional[bool] = None
    notification_email: Optional[EmailStr] = None
    notification_phone: Optional[str] = None
    booking_confirmation_required: Optional[bool] = None
    advance_payment_required: Optional[bool] = None
    cancellation_policy: Optional[str] = None
    default_cleaning_duration: Optional[int] = Field(None, ge=15, le=480)  # 15 минут - 8 часов
    default_maintenance_duration: Optional[int] = Field(None, ge=30, le=480)
    quality_control_enabled: Optional[bool] = None
    client_rating_enabled: Optional[bool] = None

    @field_validator(
        "working_hours_start", 
        "working_hours_end", 
        "default_check_in_time", 
        "default_check_out_time"
    )
    def validate_time_format(cls, v, field):
        if v is None:
            return v
        pattern = r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
        if not re.match(pattern, v):
            raise ValueError(f"{field.name} must be in HH:MM format (00:00 to 23:59)")
        return v

    @field_validator("currency")
    def validate_currency(cls, v):
        if v is None:
            return v
        if not re.match(r"^[A-Z]{3}$", v):
            raise ValueError("currency must be 3 uppercase letters (e.g. USD, EUR)")
        return v


class OrganizationSettingsResponse(BaseModel):
    working_hours_start: Optional[str]
    working_hours_end: Optional[str]
    timezone: str = "Asia/Almaty"
    currency: str = "KZT"
    default_check_in_time: str = "14:00"
    default_check_out_time: str = "12:00"
    auto_assign_tasks: bool = True
    notification_email: Optional[str]
    notification_phone: Optional[str]
    booking_confirmation_required: bool = False
    advance_payment_required: bool = True
    cancellation_policy: Optional[str]
    default_cleaning_duration: int = 60
    default_maintenance_duration: int = 120
    quality_control_enabled: bool = True
    client_rating_enabled: bool = True
    updated_at: datetime

    class Config:
        from_attributes = True


# Схемы для отчетов админа
class AdminReportRequest(BaseModel):
    report_type: str = Field(..., pattern=r'^(financial|staff|occupancy|clients|tasks)$')
    start_date: datetime
    end_date: datetime
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    format: str = Field("json", pattern=r'^(json|excel|pdf)$')

    @field_validator("report_type")
    def validate_report_type(cls, v):
        allowed = {"financial", "staff", "occupancy", "clients", "tasks"}
        if v not in allowed:
            raise ValueError(f"report_type must be one of: {', '.join(allowed)}")
        return v

    @field_validator("format")
    def validate_format(cls, v):
        allowed = {"json", "excel", "pdf"}
        if v not in allowed:
            raise ValueError(f"format must be one of: {', '.join(allowed)}")
        return v


class QuickStatsResponse(BaseModel):
    period: str
    total_revenue: float
    total_bookings: int
    occupancy_rate: float
    staff_efficiency: float
    client_satisfaction: Optional[float]
    pending_tasks: int
    overdue_tasks: int

    class Config:
        from_attributes = True