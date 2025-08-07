from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Optional, List
from datetime import datetime
import uuid

class AcquiringProviderConfig(BaseModel):
    """Конфигурация провайдера эквайринга"""
    provider: str
    is_enabled: bool = True
    commission_rate: float = Field(..., ge=0, le=50, description="Комиссия в процентах (0-50%)")
    
    # Основные параметры
    merchant_id: Optional[str] = None
    secret_key: Optional[str] = None
    api_key: Optional[str] = None
    terminal_id: Optional[str] = None
    
    # URL для API
    api_url: Optional[str] = None
    test_mode: bool = True
    
    # Дополнительные настройки
    currency: str = "KZT"
    min_amount: float = Field(100, ge=0)
    max_amount: float = Field(10000000, ge=0)
    
    # Описание и настройки отображения
    display_name: str = Field(..., min_length=1)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    
    @validator('commission_rate')
    def validate_commission(cls, v):
        if v < 0 or v > 50:
            raise ValueError('Commission rate must be between 0 and 50 percent')
        return v

class AcquiringSettingsCreate(BaseModel):
    """Создание настроек эквайринга"""
    is_enabled: bool = True
    default_provider: str
    providers_config: Dict[str, AcquiringProviderConfig]
    
    # Общие настройки
    auto_capture: bool = True
    payment_description_template: str = "Оплата аренды #{rental_id}"
    success_redirect_url: Optional[str] = None
    failure_redirect_url: Optional[str] = None
    
    # Webhooks
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    
    @validator('providers_config')
    def validate_providers(cls, v):
        if not v:
            raise ValueError('At least one provider must be configured')
        
        enabled_providers = [p for p in v.values() if p.is_enabled]
        if not enabled_providers:
            raise ValueError('At least one provider must be enabled')
        
        return v

class AcquiringSettingsUpdate(BaseModel):
    """Обновление настроек эквайринга"""
    is_enabled: Optional[bool] = None
    default_provider: Optional[str] = None
    providers_config: Optional[Dict[str, AcquiringProviderConfig]] = None
    auto_capture: Optional[bool] = None
    payment_description_template: Optional[str] = None
    success_redirect_url: Optional[str] = None
    failure_redirect_url: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None

class AcquiringSettingsResponse(AcquiringSettingsCreate):
    """Ответ с настройками эквайринга"""
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime
    
    @validator('id', 'organization_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True

class QuickAcquiringSetup(BaseModel):
    """Быстрая настройка эквайринга"""
    kaspi_commission: float = Field(2.5, ge=0, le=50, description="Комиссия Kaspi в %")
    halyk_commission: float = Field(2.0, ge=0, le=50, description="Комиссия Halyk в %")
    
    # Тестовые настройки
    enable_test_mode: bool = True
    
    # Основные параметры
    auto_capture: bool = True
    payment_description: str = "Оплата аренды"

class AcquiringStatsResponse(BaseModel):
    """Статистика по эквайрингу"""
    total_payments: int
    total_amount: float
    total_commission: float
    
    by_provider: Dict[str, Dict[str, Any]]
    
    period: Dict[str, datetime]
    
    success_rate: float
    average_payment: float