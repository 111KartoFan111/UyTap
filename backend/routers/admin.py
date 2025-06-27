from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid

from models.database import get_db
from models.models import Organization, User, UserRole, UserStatus, OrganizationStatus
from schemas.admin import (
    OrganizationResponse, OrganizationCreate, OrganizationUpdate,
    UserResponse, UserCreate, UserUpdate,
    SystemStatsResponse
)
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user, require_role

# Создаем роутер
router = APIRouter(prefix="/api/admin", tags=["Admin"])

# Зависимость для проверки прав системного администратора
get_system_owner = require_role(UserRole.SYSTEM_OWNER)


@router.get("/organizations", response_model=List[OrganizationResponse])
async def get_organizations(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Получить список всех организаций"""
    
    organizations = db.query(Organization)\
        .order_by(desc(Organization.created_at))\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    # Добавляем счетчики пользователей для каждой организации
    for org in organizations:
        org.user_count = db.query(User).filter(User.organization_id == org.id).count()
        
    return organizations


@router.post("/organizations", response_model=OrganizationResponse)
async def create_organization(
    org_data: OrganizationCreate,
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Создать новую организацию"""
    
    # Проверяем уникальность slug
    existing_org = db.query(Organization).filter(
        Organization.slug == org_data.slug
    ).first()
    
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization with slug '{org_data.slug}' already exists"
        )
    
    # Проверяем уникальность email
    if org_data.email:
        existing_email = db.query(Organization).filter(
            Organization.email == org_data.email
        ).first()
        
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Organization with email '{org_data.email}' already exists"
            )
    
    # Создаем организацию
    organization = Organization(
        id=uuid.uuid4(),
        name=org_data.name,
        slug=org_data.slug,
        description=org_data.description,
        email=org_data.email,
        phone=org_data.phone,
        website=org_data.website,
        country=org_data.country,
        city=org_data.city,
        address=org_data.address,
        postal_code=org_data.postal_code,
        status=OrganizationStatus(org_data.status),
        subscription_plan=org_data.subscription_plan,
        max_users=org_data.max_users,
        max_properties=org_data.max_properties,
        settings={}
    )
    
    # Устанавливаем даты в зависимости от статуса
    if org_data.status == "trial":
        from datetime import timedelta
        organization.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=30)
    elif org_data.status == "active":
        from datetime import timedelta
        organization.subscription_ends_at = datetime.now(timezone.utc) + timedelta(days=365)
    
    db.add(organization)
    db.commit()
    db.refresh(organization)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="organization_created",
        organization_id=organization.id,
        details={"organization_name": organization.name, "slug": organization.slug}
    )
    
    # Добавляем счетчик пользователей
    organization.user_count = 0
    
    return organization


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Получить организацию по ID"""
    
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Добавляем счетчик пользователей
    organization.user_count = db.query(User).filter(User.organization_id == org_id).count()
    
    return organization


@router.put("/organizations/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    org_data: OrganizationUpdate,
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Обновить организацию"""
    
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Обновляем только переданные поля
    update_data = org_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(organization, field, value)
    
    organization.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(organization)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="organization_updated",
        organization_id=organization.id,
        details={"updated_fields": list(update_data.keys())}
    )
    
    # Добавляем счетчик пользователей
    organization.user_count = db.query(User).filter(User.organization_id == org_id).count()
    
    return organization


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: uuid.UUID,
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Удалить организацию (вместе со всеми пользователями)"""
    
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Проверяем количество пользователей
    user_count = db.query(User).filter(User.organization_id == org_id).count()
    
    # Логируем действие перед удалением
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="organization_deleted",
        organization_id=organization.id,
        details={
            "organization_name": organization.name,
            "slug": organization.slug,
            "users_deleted": user_count
        }
    )
    
    # Удаляем организацию (CASCADE удалит связанных пользователей)
    db.delete(organization)
    db.commit()
    
    return {"message": f"Organization '{organization.name}' and {user_count} users deleted successfully"}


@router.get("/organizations/{org_id}/users", response_model=List[UserResponse])
async def get_organization_users(
    org_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Получить пользователей организации"""
    
    # Проверяем существование организации
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    users = db.query(User)\
        .filter(User.organization_id == org_id)\
        .order_by(desc(User.created_at))\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return users


@router.post("/organizations/{org_id}/users", response_model=UserResponse)
async def create_organization_user(
    org_id: uuid.UUID,
    user_data: UserCreate,
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Создать пользователя в организации"""
    
    # Проверяем существование организации
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Проверяем лимит пользователей
    current_user_count = db.query(User).filter(User.organization_id == org_id).count()
    if current_user_count >= organization.max_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization has reached maximum user limit ({organization.max_users})"
        )
    
    # Проверяем уникальность email
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{user_data.email}' already exists"
        )
    
    # Создаем пользователя
    user = User(
        id=uuid.uuid4(),
        organization_id=org_id,
        email=user_data.email,
        password_hash=AuthService.hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        middle_name=user_data.middle_name,
        phone=user_data.phone,
        role=UserRole(user_data.role),
        status=UserStatus(user_data.status),
        email_verified=user_data.status == "active",
        preferences={}
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="user_created",
        organization_id=org_id,
        details={
            "created_user_email": user.email,
            "created_user_role": user.role.value,
            "created_user_name": f"{user.first_name} {user.last_name}"
        }
    )
    
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Удалить пользователя"""
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Нельзя удалить самого себя
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    # Логируем действие перед удалением
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="user_deleted",
        organization_id=user.organization_id,
        details={
            "deleted_user_email": user.email,
            "deleted_user_role": user.role.value,
            "deleted_user_name": f"{user.first_name} {user.last_name}"
        }
    )
    
    # Удаляем пользователя
    db.delete(user)
    db.commit()
    
    return {"message": f"User '{user.email}' deleted successfully"}


@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    current_user: User = Depends(get_system_owner),
    db: Session = Depends(get_db)
):
    """Получить статистику системы"""
    
    from services.init_service import DatabaseInitService
    stats = DatabaseInitService.get_system_stats(db)
    
    return SystemStatsResponse(**stats)