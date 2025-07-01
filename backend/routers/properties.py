# backend/routers/properties.py
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, and_
import uuid

from models.database import get_db
from models.extended_models import Property, PropertyStatus, PropertyType, Task, TaskType, TaskStatus
from schemas.property import PropertyCreate, PropertyUpdate, PropertyResponse
from schemas.task import TaskCreate, TaskResponse
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user, require_scope
from services.property_service import PropertyService
from services.task_service import TaskService

router = APIRouter(prefix="/api/properties", tags=["Properties"])


@router.get("", response_model=List[PropertyResponse])
async def get_properties(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[PropertyStatus] = None,
    property_type: Optional[PropertyType] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список помещений организации"""
    
    # Проверяем права доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view properties"
        )
    
    query = db.query(Property).filter(Property.organization_id == current_user.organization_id)
    
    # Фильтры
    if status:
        query = query.filter(Property.status == status)
    if property_type:
        query = query.filter(Property.property_type == property_type)
    if search:
        query = query.filter(
            Property.name.ilike(f"%{search}%") |
            Property.number.ilike(f"%{search}%") |
            Property.address.ilike(f"%{search}%")
        )
    
    properties = query.order_by(Property.number).offset(skip).limit(limit).all()
    
    return properties


@router.post("", response_model=PropertyResponse)
async def create_property(
    property_data: PropertyCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать новое помещение"""
    
    # Только администраторы могут создавать помещения
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create properties"
        )
    
    # Проверяем лимиты организации
    property_count = db.query(Property).filter(
        Property.organization_id == current_user.organization_id
    ).count()
    
    if property_count >= current_user.organization.max_properties:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Property limit reached ({current_user.organization.max_properties})"
        )
    
    # Проверяем уникальность номера в организации
    existing_property = db.query(Property).filter(
        and_(
            Property.organization_id == current_user.organization_id,
            Property.number == property_data.number
        )
    ).first()
    
    if existing_property:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Property with number '{property_data.number}' already exists"
        )
    
    # Создаем помещение
    property_obj = Property(
        id=uuid.uuid4(),
        organization_id=current_user.organization_id,
        **property_data.dict(),
        status=PropertyStatus.AVAILABLE
    )
    
    db.add(property_obj)
    db.commit()
    db.refresh(property_obj)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="property_created",
        organization_id=current_user.organization_id,
        resource_type="property",
        resource_id=property_obj.id,
        details={
            "property_name": property_obj.name,
            "property_number": property_obj.number,
            "property_type": property_obj.property_type.value
        }
    )
    
    return property_obj


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о помещении"""
    
    property_obj = PropertyService.get_property_by_id(db, property_id, current_user.organization_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    return property_obj


@router.put("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: uuid.UUID,
    property_data: PropertyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить помещение"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update properties"
        )
    
    property_obj = PropertyService.get_property_by_id(db, property_id, current_user.organization_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Проверяем уникальность номера при изменении
    if property_data.number and property_data.number != property_obj.number:
        existing_property = db.query(Property).filter(
            and_(
                Property.organization_id == current_user.organization_id,
                Property.number == property_data.number,
                Property.id != property_id
            )
        ).first()
        
        if existing_property:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Property with number '{property_data.number}' already exists"
            )
    
    # Обновляем помещение
    update_data = property_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(property_obj, field, value)
    
    property_obj.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(property_obj)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="property_updated",
        organization_id=current_user.organization_id,
        resource_type="property",
        resource_id=property_obj.id,
        details={
            "updated_fields": list(update_data.keys()),
            "property_name": property_obj.name
        }
    )
    
    return property_obj


@router.delete("/{property_id}")
async def delete_property(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить помещение"""
    
    # Только администраторы могут удалять помещения
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete properties"
        )
    
    property_obj = PropertyService.get_property_by_id(db, property_id, current_user.organization_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Проверяем, нет ли активных аренд
    from models.extended_models import Rental
    active_rentals = db.query(Rental).filter(
        and_(
            Rental.property_id == property_id,
            Rental.is_active == True
        )
    ).count()
    
    if active_rentals > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete property with active rentals"
        )
    
    # Логируем действие перед удалением
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="property_deleted",
        organization_id=current_user.organization_id,
        resource_type="property",
        resource_id=property_obj.id,
        details={
            "property_name": property_obj.name,
            "property_number": property_obj.number
        }
    )
    
    db.delete(property_obj)
    db.commit()
    
    return {"message": "Property deleted successfully"}


@router.patch("/{property_id}/status")
async def update_property_status(
    property_id: uuid.UUID,
    new_status: PropertyStatus,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Изменить статус помещения"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update property status"
        )
    
    property_obj = PropertyService.get_property_by_id(db, property_id, current_user.organization_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    old_status = property_obj.status
    property_obj.status = new_status
    property_obj.updated_at = datetime.now(timezone.utc)
    
    # Создаем автоматические задачи при смене статуса
    if new_status == PropertyStatus.CLEANING:
        # Создаем задачу на уборку
        cleaning_task = TaskService.create_cleaning_task(
            db=db,
            property_id=property_id,
            created_by=current_user.id,
            organization_id=current_user.organization_id
        )
    
    elif new_status == PropertyStatus.MAINTENANCE:
        # Создаем задачу на обслуживание
        maintenance_task = TaskService.create_maintenance_task(
            db=db,
            property_id=property_id,
            created_by=current_user.id,
            organization_id=current_user.organization_id
        )
    
    db.commit()
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="property_status_changed",
        organization_id=current_user.organization_id,
        resource_type="property",
        resource_id=property_obj.id,
        details={
            "property_name": property_obj.name,
            "old_status": old_status.value,
            "new_status": new_status.value
        }
    )
    
    return {"message": "Property status updated successfully", "new_status": new_status.value}


@router.get("/{property_id}/tasks", response_model=List[TaskResponse])
async def get_property_tasks(
    property_id: uuid.UUID,
    status: Optional[TaskStatus] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить задачи для помещения"""
    
    property_obj = PropertyService.get_property_by_id(db, property_id, current_user.organization_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    query = db.query(Task).filter(Task.property_id == property_id)
    
    if status:
        query = query.filter(Task.status == status)
    
    tasks = query.order_by(desc(Task.created_at)).all()
    
    return tasks


@router.post("/{property_id}/tasks", response_model=TaskResponse)
async def create_property_task(
    property_id: uuid.UUID,
    task_data: TaskCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать задачу для помещения"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create tasks"
        )
    
    property_obj = PropertyService.get_property_by_id(db, property_id, current_user.organization_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Создаем задачу
    task = TaskService.create_task(
        db=db,
        task_data=task_data,
        property_id=property_id,
        created_by=current_user.id,
        organization_id=current_user.organization_id
    )
    
    return task


@router.get("/{property_id}/availability")
async def check_property_availability(
    property_id: uuid.UUID,
    start_date: datetime,
    end_date: datetime,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Проверить доступность помещения на период"""
    
    property_obj = PropertyService.get_property_by_id(db, property_id, current_user.organization_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    availability = PropertyService.check_availability(
        db=db,
        property_id=property_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return {
        "property_id": str(property_id),
        "start_date": start_date,
        "end_date": end_date,
        "is_available": availability["is_available"],
        "conflicts": availability["conflicts"],
        "suggested_rates": PropertyService.get_suggested_rates(property_obj, start_date, end_date)
    }


@router.get("/{property_id}/statistics")
async def get_property_statistics(
    property_id: uuid.UUID,
    period_days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по помещению"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view statistics"
        )
    
    property_obj = PropertyService.get_property_by_id(db, property_id, current_user.organization_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    stats = PropertyService.get_property_statistics(
        db=db,
        property_id=property_id,
        period_days=period_days
    )
    
    return stats