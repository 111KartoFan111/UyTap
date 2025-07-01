# backend/routers/rentals.py
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, and_, or_
import uuid

from models.database import get_db
from models.extended_models import Rental, Property, Client, PropertyStatus, RentalType
from schemas.rental import RentalCreate, RentalUpdate, RentalResponse
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
from services.rental_service import RentalService
from services.property_service import PropertyService

router = APIRouter(prefix="/api/rentals", tags=["Rentals"])


@router.get("", response_model=List[RentalResponse])
async def get_rentals(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = None,
    rental_type: Optional[RentalType] = None,
    property_id: Optional[str] = None,
    client_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список аренд"""
    
    query = db.query(Rental).filter(Rental.organization_id == current_user.organization_id)
    
    # Фильтры
    if is_active is not None:
        query = query.filter(Rental.is_active == is_active)
    if rental_type:
        query = query.filter(Rental.rental_type == rental_type)
    if property_id:
        query = query.filter(Rental.property_id == uuid.UUID(property_id))
    if client_id:
        query = query.filter(Rental.client_id == uuid.UUID(client_id))
    
    # Подгружаем связанные объекты
    query = query.options(
        selectinload(Rental.property),
        selectinload(Rental.client)
    )
    
    rentals = query.order_by(desc(Rental.created_at)).offset(skip).limit(limit).all()
    
    return rentals


@router.post("", response_model=RentalResponse)
async def create_rental(
    rental_data: RentalCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать новую аренду"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create rentals"
        )
    
    # Проверяем доступность помещения
    availability = PropertyService.check_availability(
        db=db,
        property_id=uuid.UUID(rental_data.property_id),
        start_date=rental_data.start_date,
        end_date=rental_data.end_date
    )
    
    if not availability["is_available"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property is not available for the requested period"
        )
    
    # Создаем аренду
    rental = RentalService.create_rental(
        db=db,
        rental_data=rental_data,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="rental_created",
        organization_id=current_user.organization_id,
        resource_type="rental",
        resource_id=rental.id,
        details={
            "property_id": rental_data.property_id,
            "client_id": rental_data.client_id,
            "rental_type": rental_data.rental_type.value,
            "start_date": rental_data.start_date.isoformat(),
            "end_date": rental_data.end_date.isoformat(),
            "total_amount": rental_data.total_amount
        }
    )
    
    return rental


@router.get("/{rental_id}", response_model=RentalResponse)
async def get_rental(
    rental_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить информацию об аренде"""
    
    rental = RentalService.get_rental_by_id(db, rental_id, current_user.organization_id)
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    return rental


@router.put("/{rental_id}", response_model=RentalResponse)
async def update_rental(
    rental_id: uuid.UUID,
    rental_data: RentalUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить аренду"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update rentals"
        )
    
    rental = RentalService.get_rental_by_id(db, rental_id, current_user.organization_id)
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    # Обновляем аренду
    updated_rental = RentalService.update_rental(db, rental, rental_data)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="rental_updated",
        organization_id=current_user.organization_id,
        resource_type="rental",
        resource_id=rental.id,
        details={"updated_fields": list(rental_data.dict(exclude_unset=True).keys())}
    )
    
    return updated_rental


@router.post("/{rental_id}/check-in")
async def check_in_rental(
    rental_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Заселить клиента"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to check in rentals"
        )
    
    rental = RentalService.get_rental_by_id(db, rental_id, current_user.organization_id)
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    if rental.checked_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rental is already checked in"
        )
    
    # Выполняем заселение
    checked_in_rental = RentalService.check_in(db, rental, current_user.id)
    
    return {"message": "Check-in successful", "check_in_time": checked_in_rental.check_in_time}


@router.post("/{rental_id}/check-out")
async def check_out_rental(
    rental_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Выселить клиента"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to check out rentals"
        )
    
    rental = RentalService.get_rental_by_id(db, rental_id, current_user.organization_id)
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    if not rental.checked_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rental is not checked in"
        )
    
    if rental.checked_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rental is already checked out"
        )
    
    # Выполняем выселение
    checked_out_rental = RentalService.check_out(db, rental, current_user.id)
    
    return {"message": "Check-out successful", "check_out_time": checked_out_rental.check_out_time}


@router.delete("/{rental_id}")
async def cancel_rental(
    rental_id: uuid.UUID,
    reason: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отменить аренду"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can cancel rentals"
        )
    
    rental = RentalService.get_rental_by_id(db, rental_id, current_user.organization_id)
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    if rental.checked_in and not rental.checked_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel active rental. Check out first."
        )
    
    # Отменяем аренду
    RentalService.cancel_rental(db, rental, reason, current_user.id)
    
    return {"message": "Rental cancelled successfully"}