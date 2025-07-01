from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
import uuid

from models.database import get_db
from models.extended_models import Document, DocumentType, Rental, Client
from schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
from services.document_service import DocumentService

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("", response_model=List[DocumentResponse])
async def get_documents(
    skip: int = 0,
    limit: int = 100,
    document_type: Optional[DocumentType] = None,
    rental_id: Optional[str] = None,
    client_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список документов"""
    
    query = db.query(Document).filter(Document.organization_id == current_user.organization_id)
    
    # Фильтры
    if document_type:
        query = query.filter(Document.document_type == document_type)
    if rental_id:
        query = query.filter(Document.rental_id == uuid.UUID(rental_id))
    if client_id:
        query = query.filter(Document.client_id == uuid.UUID(client_id))
    
    documents = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
    
    return documents


@router.post("", response_model=DocumentResponse)
async def create_document(
    document_data: DocumentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать документ"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create documents"
        )
    
    # Создаем документ
    document = DocumentService.create_document(
        db=db,
        document_data=document_data,
        created_by=current_user.id,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="document_created",
        organization_id=current_user.organization_id,
        resource_type="document",
        resource_id=document.id,
        details={
            "document_type": document.document_type.value,
            "title": document.title
        }
    )
    
    return document


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить документ"""
    
    document = DocumentService.get_document_by_id(db, document_id, current_user.organization_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return document


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: uuid.UUID,
    document_data: DocumentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить документ"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update documents"
        )
    
    document = DocumentService.get_document_by_id(db, document_id, current_user.organization_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Обновляем документ
    updated_document = DocumentService.update_document(db, document, document_data)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="document_updated",
        organization_id=current_user.organization_id,
        resource_type="document",
        resource_id=document.id,
        details={"updated_fields": list(document_data.dict(exclude_unset=True).keys())}
    )
    
    return updated_document


@router.get("/{document_id}/download")
async def download_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Скачать PDF документа"""
    
    document = DocumentService.get_document_by_id(db, document_id, current_user.organization_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Генерируем PDF если его нет
    if not document.file_path:
        pdf_content = DocumentService.generate_pdf(db, document)
        
        # Логируем скачивание
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="document_downloaded",
            organization_id=current_user.organization_id,
            resource_type="document",
            resource_id=document.id,
            details={
                "document_type": document.document_type.value,
                "title": document.title
            }
        )
        
        filename = f"{document.document_type.value}_{document.document_number or document.id}.pdf"
        
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    # Возвращаем существующий файл
    return FileResponse(
        path=document.file_path,
        media_type="application/pdf",
        filename=f"{document.document_type.value}_{document.document_number or document.id}.pdf"
    )


@router.post("/{document_id}/sign")
async def sign_document(
    document_id: uuid.UUID,
    signature_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Подписать документ"""
    
    document = DocumentService.get_document_by_id(db, document_id, current_user.organization_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document.is_signed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is already signed"
        )
    
    # Подписываем документ
    DocumentService.sign_document(db, document, current_user.id, signature_data)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="document_signed",
        organization_id=current_user.organization_id,
        resource_type="document",
        resource_id=document.id,
        details={
            "document_type": document.document_type.value,
            "signer": f"{current_user.first_name} {current_user.last_name}"
        }
    )
    
    return {"message": "Document signed successfully", "signed_at": document.signed_at}


@router.post("/rental/{rental_id}/generate-contract")
async def generate_rental_contract(
    rental_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Сгенерировать договор аренды"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to generate contracts"
        )
    
    # Проверяем существование аренды
    rental = db.query(Rental).filter(
        and_(
            Rental.id == rental_id,
            Rental.organization_id == current_user.organization_id
        )
    ).first()
    
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    # Генерируем договор
    contract = DocumentService.generate_rental_contract(
        db=db,
        rental=rental,
        created_by=current_user.id
    )
    
    return {"message": "Contract generated successfully", "document_id": str(contract.id)}


@router.post("/rental/{rental_id}/generate-act")
async def generate_work_act(
    rental_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Сгенерировать акт выполненных работ"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to generate acts"
        )
    
    # Проверяем существование аренды
    rental = db.query(Rental).filter(
        and_(
            Rental.id == rental_id,
            Rental.organization_id == current_user.organization_id
        )
    ).first()
    
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental not found"
        )
    
    # Генерируем акт
    act = DocumentService.generate_work_act(
        db=db,
        rental=rental,
        created_by=current_user.id
    )
    
    return {"message": "Work act generated successfully", "document_id": str(act.id)}


@router.post("/{document_id}/send-esf")
async def send_esf(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отправить ЭСФ в ИС"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to send ESF"
        )
    
    document = DocumentService.get_document_by_id(db, document_id, current_user.organization_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document.document_type != DocumentType.ESF:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not an ESF"
        )
    
    # Отправляем ЭСФ
    result = DocumentService.send_esf_to_system(db, document)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="esf_sent",
        organization_id=current_user.organization_id,
        resource_type="document",
        resource_id=document.id,
        details={
            "esf_status": result.get("status"),
            "esf_id": result.get("esf_id")
        }
    )
    
    return result