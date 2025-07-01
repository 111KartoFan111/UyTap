from models.extended_models import DocumentType
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator
import uuid


class DocumentBase(BaseModel):
    document_type: DocumentType
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[Dict[str, Any]] = {}
    template_used: Optional[str] = None


class DocumentCreate(DocumentBase):
    rental_id: Optional[str] = None
    client_id: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[Dict[str, Any]] = None
    is_signed: Optional[bool] = None
    signature_data: Optional[Dict[str, Any]] = None


class DocumentResponse(DocumentBase):
    id: str
    organization_id: str
    rental_id: Optional[str]
    client_id: Optional[str]
    created_by: Optional[str]
    document_number: Optional[str]
    file_path: Optional[str]
    is_signed: bool
    signed_at: Optional[datetime]
    signature_data: Optional[Dict[str, Any]]
    esf_status: Optional[str]
    esf_sent_at: Optional[datetime]
    esf_response: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    @validator('id', 'organization_id', 'rental_id', 'client_id', 'created_by', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True