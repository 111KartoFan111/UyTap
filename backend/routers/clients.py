from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, and_, func
import uuid

from models.database import get_db
from models.extended_models import Client, Rental, RoomOrder
from schemas.client import ClientCreate, ClientUpdate, ClientResponse
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
from services.client_service import ClientService

router = APIRouter(prefix="/api/clients", tags=["Clients"])


@router.get("", response_model=List[ClientResponse])
async def get_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    source: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список клиентов"""
    
    # Проверяем лимит клиентов для организации
    total_clients = db.query(Client).filter(
        Client.organization_id == current_user.organization_id
    ).count()
    
    query = db.query(Client).filter(Client.organization_id == current_user.organization_id)
    
    # Фильтры
    if search:
        query = query.filter(
            or_(
                Client.first_name.ilike(f"%{search}%"),
                Client.last_name.ilike(f"%{search}%"),
                Client.phone.ilike(f"%{search}%"),
                Client.email.ilike(f"%{search}%")
            )
        )
    
    if source:
        query = query.filter(Client.source == source)
    
    clients = query.order_by(desc(Client.last_visit)).offset(skip).limit(limit).all()
    
    return clients


@router.post("", response_model=ClientResponse)
async def create_client(
    client_data: ClientCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать нового клиента"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create clients"
        )
    
    # Проверяем лимит клиентов организации (если есть)
    current_client_count = db.query(Client).filter(
        Client.organization_id == current_user.organization_id
    ).count()
    
    # Примерный лимит - можно настроить в зависимости от тарифного плана
    max_clients = getattr(current_user.organization, 'max_clients', 1000)
    
    if current_client_count >= max_clients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Client limit reached ({max_clients})"
        )
    
    # Проверяем уникальность телефона в организации
    if client_data.phone:
        existing_client = db.query(Client).filter(
            and_(
                Client.organization_id == current_user.organization_id,
                Client.phone == client_data.phone
            )
        ).first()
        
        if existing_client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Client with phone '{client_data.phone}' already exists"
            )
    
    # Создаем клиента
    client = ClientService.create_client(
        db=db,
        client_data=client_data,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="client_created",
        organization_id=current_user.organization_id,
        resource_type="client",
        resource_id=client.id,
        details={
            "client_name": f"{client.first_name} {client.last_name}",
            "client_phone": client.phone,
            "source": client.source
        }
    )
    
    return client


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о клиенте"""
    
    client = ClientService.get_client_by_id(db, client_id, current_user.organization_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    return client


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    client_data: ClientUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить клиента"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update clients"
        )
    
    client = ClientService.get_client_by_id(db, client_id, current_user.organization_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Проверяем уникальность телефона при изменении
    if client_data.phone and client_data.phone != client.phone:
        existing_client = db.query(Client).filter(
            and_(
                Client.organization_id == current_user.organization_id,
                Client.phone == client_data.phone,
                Client.id != client_id
            )
        ).first()
        
        if existing_client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Client with phone '{client_data.phone}' already exists"
            )
    
    # Обновляем клиента
    updated_client = ClientService.update_client(db, client, client_data)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="client_updated",
        organization_id=current_user.organization_id,
        resource_type="client",
        resource_id=client.id,
        details={"updated_fields": list(client_data.dict(exclude_unset=True).keys())}
    )
    
    return updated_client


@router.delete("/{client_id}")
async def delete_client(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить клиента"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete clients"
        )
    
    client = ClientService.get_client_by_id(db, client_id, current_user.organization_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Проверяем, нет ли активных аренд
    active_rentals = db.query(Rental).filter(
        and_(
            Rental.client_id == client_id,
            Rental.is_active == True
        )
    ).count()
    
    if active_rentals > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete client with active rentals"
        )
    
    # Логируем действие перед удалением
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="client_deleted",
        organization_id=current_user.organization_id,
        resource_type="client",
        resource_id=client.id,
        details={
            "client_name": f"{client.first_name} {client.last_name}",
            "client_phone": client.phone
        }
    )
    
    db.delete(client)
    db.commit()
    
    return {"message": "Client deleted successfully"}


@router.get("/{client_id}/history")
async def get_client_history(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить историю клиента"""
    
    client = ClientService.get_client_by_id(db, client_id, current_user.organization_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    history = ClientService.get_client_history(db, client_id)
    
    return history


@router.get("/{client_id}/statistics")
async def get_client_statistics(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по клиенту"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view client statistics"
        )
    
    client = ClientService.get_client_by_id(db, client_id, current_user.organization_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    stats = ClientService.get_client_statistics(db, client_id)
    
    return stats


@router.post("/bulk-import")
async def bulk_import_clients(
    clients_data: List[ClientCreate],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Массовый импорт клиентов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can import clients"
        )
    
    # Проверяем лимит клиентов
    current_count = db.query(Client).filter(
        Client.organization_id == current_user.organization_id
    ).count()
    
    max_clients = getattr(current_user.organization, 'max_clients', 1000)
    
    if current_count + len(clients_data) > max_clients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Import would exceed client limit ({max_clients})"
        )
    
    # Импортируем клиентов
    result = ClientService.bulk_import(
        db=db,
        clients_data=clients_data,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="clients_bulk_imported",
        organization_id=current_user.organization_id,
        details={
            "total_imported": result["imported"],
            "total_errors": result["errors"]
        }
    )
    
    return result
