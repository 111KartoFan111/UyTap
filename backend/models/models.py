from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Integer, 
    ForeignKey, Enum, TIMESTAMP, JSON, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base


# Enums
class UserRole(str, enum.Enum):
    SYSTEM_OWNER = "system_owner"
    ADMIN = "admin"
    MANAGER = "manager"
    TECHNICAL_STAFF = "technical_staff"
    ACCOUNTANT = "accountant"
    CLEANER = "cleaner"
    STOREKEEPER = "storekeeper"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"


class OrganizationStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    EXPIRED = "expired"


# Модель организации
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    
    # Контактная информация
    email = Column(String(255))
    phone = Column(String(50))
    website = Column(String(255))
    
    # Адрес
    country = Column(String(100))
    city = Column(String(100))
    address = Column(Text)
    postal_code = Column(String(20))
    
    # Подписка и ограничения
    status = Column(Enum(OrganizationStatus), nullable=False, default=OrganizationStatus.TRIAL)
    subscription_plan = Column(String(50), default="basic")
    max_users = Column(Integer, default=10)
    max_properties = Column(Integer, default=50)
    
    # Даты
    trial_ends_at = Column(TIMESTAMP(timezone=True))
    subscription_ends_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Настройки
    settings = Column(JSONB, default=dict)
    
    # Отношения
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    user_actions = relationship("UserAction", back_populates="organization", cascade="all, delete-orphan")
    login_attempts = relationship("LoginAttempt", back_populates="organization", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("slug ~ '^[a-z0-9_-]+'", name="check_slug_format"),
    )


# Модель пользователя
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"))
    
    # Основная информация
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Персональные данные
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    middle_name = Column(String(100))
    phone = Column(String(50))
    avatar_url = Column(String(500))
    
    # Система и роли
    role = Column(Enum(UserRole), nullable=False)
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.PENDING_VERIFICATION)
    
    # Безопасность
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    
    # Сессии и токены
    last_login_at = Column(TIMESTAMP(timezone=True))
    last_activity_at = Column(TIMESTAMP(timezone=True))
    password_changed_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Настройки пользователя
    preferences = Column(JSONB, default=dict)
    
    # Отношения
    organization = relationship("Organization", back_populates="users")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    user_actions = relationship("UserAction", back_populates="user")

    __table_args__ = (
        CheckConstraint("email ~ '^[^@]+@[^@]+\\.[^@]+'", name="check_email_format"),
    )


# Модель refresh токенов
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    
    # Метаданные
    device_info = Column(JSONB)
    ip_address = Column(INET)
    user_agent = Column(Text)
    
    # Даты
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    last_used_at = Column(TIMESTAMP(timezone=True))
    
    # Статус
    is_revoked = Column(Boolean, default=False)
    revoked_at = Column(TIMESTAMP(timezone=True))
    revoked_reason = Column(String(100))
    
    # Отношения
    user = relationship("User", back_populates="refresh_tokens")


# Модель аудита действий пользователей
class UserAction(Base):
    __tablename__ = "user_actions"
    __table_args__ = {"schema": "audit"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"))
    
    # Действие
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(UUID(as_uuid=True))
    
    # Детали
    details = Column(JSONB)
    ip_address = Column(INET)
    user_agent = Column(Text)
    
    # Результат
    success = Column(Boolean, nullable=False)
    error_message = Column(Text)
    
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Отношения
    user = relationship("User", back_populates="user_actions")
    organization = relationship("Organization", back_populates="user_actions")


# Модель попыток входа
class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    __table_args__ = {"schema": "audit"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"))
    
    # Результат
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(100))
    
    # Метаданные
    ip_address = Column(INET)
    user_agent = Column(Text)
    device_fingerprint = Column(String(255))
    
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Отношения
    organization = relationship("Organization", back_populates="login_attempts")