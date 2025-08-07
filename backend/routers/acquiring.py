# backend/routers/acquiring.py - FIXED VERSION WITH DEBUG

from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
import uuid
import logging

from models.database import get_db
from models.models import User, UserRole, Organization
from utils.dependencies import get_current_active_user, require_role
from schemas.acquiring import (
    AcquiringSettingsCreate, AcquiringSettingsUpdate, AcquiringSettingsResponse,
    QuickAcquiringSetup, AcquiringStatsResponse, AcquiringProviderConfig
)

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/acquiring", tags=["Acquiring"])

# FIXED: Use the correct require_role function
admin_required = require_role(UserRole.ADMIN, UserRole.ACCOUNTANT)

@router.get("/debug/user-info")
async def debug_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Debug endpoint to check user information for acquiring access"""
    return {
        "user_id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role.value,
        "role_type": str(type(current_user.role)),
        "status": current_user.status.value,
        "organization_id": str(current_user.organization_id) if current_user.organization_id else None,
        "has_admin_role": current_user.role == UserRole.ADMIN,
        "has_accountant_role": current_user.role == UserRole.ACCOUNTANT,
        "allowed_roles": [UserRole.ADMIN.value, UserRole.ACCOUNTANT.value]
    }

@router.get("/settings", response_model=AcquiringSettingsResponse)
async def get_acquiring_settings(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Получить настройки эквайринга"""
    
    logger.info(f"User {current_user.email} accessing acquiring settings")
    
    from models.acquiring_models import AcquiringSettings
    
    settings = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    if not settings:
        logger.info(f"No acquiring settings found for org {current_user.organization_id}, returning defaults")
        # Возвращаем настройки по умолчанию
        return AcquiringSettingsResponse(
            id="00000000-0000-0000-0000-000000000000",
            organization_id=str(current_user.organization_id),
            is_enabled=False,
            default_provider="kaspi",
            providers_config={},
            auto_capture=True,
            payment_description_template="Оплата аренды #{rental_id}",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
    
    logger.info(f"Found acquiring settings for org {current_user.organization_id}")
    return settings

@router.post("/settings", response_model=AcquiringSettingsResponse)
async def create_acquiring_settings(
    settings_data: AcquiringSettingsCreate,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Создать настройки эквайринга"""
    
    logger.info(f"User {current_user.email} creating acquiring settings")
    
    from models.acquiring_models import AcquiringSettings
    
    # Проверяем, нет ли уже настроек
    existing = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Acquiring settings already exist. Use PUT to update."
        )
    
    # Конвертируем providers_config в словарь для JSONB
    providers_dict = {}
    for provider_name, config in settings_data.providers_config.items():
        providers_dict[provider_name] = config.dict()
    
    settings = AcquiringSettings(
        id=uuid.uuid4(),
        organization_id=current_user.organization_id,
        **settings_data.dict(exclude={'providers_config'}),
        providers_config=providers_dict
    )
    
    db.add(settings)
    db.commit()
    db.refresh(settings)
    
    logger.info(f"Created acquiring settings {settings.id} for org {current_user.organization_id}")
    return settings

@router.get("/providers/available")
async def get_available_providers(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Получить список доступных провайдеров эквайринга"""
    
    logger.info(f"User {current_user.email} (role: {current_user.role.value}) accessing available providers")
    
    providers = [
        {
            "id": "kaspi",
            "name": "Kaspi Bank",
            "description": "Kaspi.kz эквайринг",
            "default_commission": 2.5,
            "supported_currencies": ["KZT"],
            "features": ["online_payments", "mobile_payments", "qr_payments"],
            "logo_url": "/static/logos/kaspi.png"
        },
        {
            "id": "halyk",
            "name": "Halyk Bank",
            "description": "Народный банк Казахстана",
            "default_commission": 2.0,
            "supported_currencies": ["KZT", "USD"],
            "features": ["online_payments", "mobile_payments", "pos_payments"],
            "logo_url": "/static/logos/halyk.png"
        },
        {
            "id": "jusan",
            "name": "Jusan Bank",
            "description": "Жусан Банк",
            "default_commission": 2.2,
            "supported_currencies": ["KZT"],
            "features": ["online_payments", "mobile_payments"],
            "logo_url": "/static/logos/jusan.png"
        },
        {
            "id": "sberbank",
            "name": "Сбербанк",
            "description": "Сбербанк Казахстан",
            "default_commission": 2.8,
            "supported_currencies": ["KZT", "USD", "RUB"],
            "features": ["online_payments", "pos_payments"],
            "logo_url": "/static/logos/sberbank.png"
        },
        {
            "id": "forte",
            "name": "Forte Bank",
            "description": "Forte Bank",
            "default_commission": 2.3,
            "supported_currencies": ["KZT"],
            "features": ["online_payments", "mobile_payments"],
            "logo_url": "/static/logos/forte.png"
        }
    ]
    
    logger.info(f"Returning {len(providers)} available providers")
    return {"available_providers": providers}

@router.get("/statistics")
async def get_acquiring_statistics(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Получить статистику по эквайрингу"""
    
    # Получаем настройки эквайринга
    from models.acquiring_models import AcquiringSettings
    
    settings = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    if not settings:
        return AcquiringStatsResponse(
            total_payments=0,
            total_amount=0,
            total_commission=0,
            by_provider={},
            period={"start_date": start_date, "end_date": end_date},
            success_rate=0,
            average_payment=0
        )
    
    # Пока что возвращаем мок-данные, так как у нас нет таблицы платежей
    # В будущем здесь будет реальная статистика из таблицы payments
    
    mock_stats = {
        "kaspi": {
            "payments_count": 45,
            "total_amount": 1250000,
            "commission_amount": 31250,  # 2.5%
            "success_rate": 98.5
        },
        "halyk": {
            "payments_count": 23,
            "total_amount": 780000,
            "commission_amount": 15600,  # 2.0%
            "success_rate": 97.2
        }
    }
    
    total_payments = sum(p["payments_count"] for p in mock_stats.values())
    total_amount = sum(p["total_amount"] for p in mock_stats.values())
    total_commission = sum(p["commission_amount"] for p in mock_stats.values())
    
    return AcquiringStatsResponse(
        total_payments=total_payments,
        total_amount=total_amount,
        total_commission=total_commission,
        by_provider=mock_stats,
        period={"start_date": start_date, "end_date": end_date},
        success_rate=sum(p["success_rate"] * p["payments_count"] for p in mock_stats.values()) / total_payments if total_payments > 0 else 0,
        average_payment=total_amount / total_payments if total_payments > 0 else 0
    )

@router.post("/test-provider/{provider_id}")
async def test_provider_connection(
    provider_id: str,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Тестировать подключение к провайдеру"""
    
    from models.acquiring_models import AcquiringSettings
    
    settings = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acquiring settings not found"
        )
    
    provider_config = settings.providers_config.get(provider_id)
    if not provider_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider {provider_id} not configured"
        )
    
    # Здесь будет реальное тестирование подключения к API банка
    # Пока возвращаем мок-результат
    
    test_result = {
        "provider_id": provider_id,
        "connection_status": "success",
        "response_time_ms": 245,
        "test_timestamp": datetime.now(timezone.utc),
        "api_version": "1.0",
        "features_available": ["payments", "refunds", "status_check"],
        "test_details": {
            "merchant_id_valid": True,
            "api_key_valid": True,
            "webhook_url_reachable": True
        }
    }
    
    return test_result

@router.delete("/settings")
async def delete_acquiring_settings(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Удалить настройки эквайринга"""
    
    from models.acquiring_models import AcquiringSettings
    
    settings = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acquiring settings not found"
        )
    
    db.delete(settings)
    db.commit()
    
    return {"message": "Acquiring settings deleted successfully"}

@router.post("/settings/enable")
async def enable_acquiring(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Включить эквайринг"""
    
    from models.acquiring_models import AcquiringSettings
    
    settings = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acquiring settings not found. Configure acquiring first."
        )
    
    settings.is_enabled = True
    settings.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {"message": "Acquiring enabled successfully"}

@router.post("/settings/disable")
async def disable_acquiring(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Отключить эквайринг"""
    
    from models.acquiring_models import AcquiringSettings
    
    settings = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acquiring settings not found"
        )
    
    settings.is_enabled = False
    settings.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {"message": "Acquiring disabled successfully"}

@router.get("/commission-calculator")
async def calculate_commission(
    amount: float = Query(..., gt=0),
    provider: str = Query(...),
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Калькулятор комиссии по провайдеру"""
    
    from models.acquiring_models import AcquiringSettings
    
    settings = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    # Значения по умолчанию если нет настроек
    default_commissions = {
        "kaspi": 2.5,
        "halyk": 2.0,
        "jusan": 2.2,
        "sberbank": 2.8,
        "forte": 2.3
    }
    
    if settings and provider in settings.providers_config:
        commission_rate = settings.providers_config[provider]["commission_rate"]
    else:
        commission_rate = default_commissions.get(provider, 2.5)
    
    commission_amount = amount * (commission_rate / 100)
    net_amount = amount - commission_amount
    
    return {
        "amount": amount,
        "provider": provider,
        "commission_rate": commission_rate,
        "commission_amount": round(commission_amount, 2),
        "net_amount": round(net_amount, 2),
        "calculation_timestamp": datetime.now(timezone.utc)
    }

@router.post("/settings/quick-setup")
async def quick_acquiring_setup(
    setup_data: QuickAcquiringSetup,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Быстрая настройка эквайринга с популярными банками"""
    
    logger.info(f"User {current_user.email} performing quick acquiring setup")
    
    from models.acquiring_models import AcquiringSettings
    
    # Создаем конфигурацию для Kaspi и Halyk
    providers_config = {
        "kaspi": AcquiringProviderConfig(
            provider="kaspi",
            is_enabled=True,
            commission_rate=setup_data.kaspi_commission,
            display_name="Kaspi Bank",
            description="Эквайринг Kaspi Bank",
            currency="KZT",
            min_amount=100,
            max_amount=5000000,
            test_mode=setup_data.enable_test_mode,
            api_url="https://api.kaspi.kz" if not setup_data.enable_test_mode else "https://test-api.kaspi.kz"
        ),
        "halyk": AcquiringProviderConfig(
            provider="halyk",
            is_enabled=True,
            commission_rate=setup_data.halyk_commission,
            display_name="Halyk Bank",
            description="Эквайринг Halyk Bank",
            currency="KZT",
            min_amount=100,
            max_amount=10000000,
            test_mode=setup_data.enable_test_mode,
            api_url="https://api.halykbank.kz" if not setup_data.enable_test_mode else "https://test-api.halykbank.kz"
        )
    }
    
    # Удаляем старые настройки если есть
    existing = db.query(AcquiringSettings).filter(
        AcquiringSettings.organization_id == current_user.organization_id
    ).first()
    
    if existing:
        db.delete(existing)
    
    # Создаем новые настройки
    providers_dict = {}
    for provider_name, config in providers_config.items():
        providers_dict[provider_name] = config.dict()
    
    settings = AcquiringSettings(
        id=uuid.uuid4(),
        organization_id=current_user.organization_id,
        is_enabled=True,
        default_provider="kaspi",  # Kaspi по умолчанию
        providers_config=providers_dict,
        auto_capture=setup_data.auto_capture,
        payment_description_template=f"{setup_data.payment_description} #{{rental_id}}"
    )
    
    db.add(settings)
    db.commit()
    db.refresh(settings)
    
    logger.info(f"Quick setup completed for org {current_user.organization_id}")
    
    return {
        "message": "Эквайринг настроен успешно",
        "providers_configured": ["kaspi", "halyk"],
        "kaspi_commission": setup_data.kaspi_commission,
        "halyk_commission": setup_data.halyk_commission,
        "test_mode": setup_data.enable_test_mode,
        "settings_id": str(settings.id)
    }