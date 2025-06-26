# Добавьте это в routers/auth.py для отладки

import traceback
from datetime import datetime, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid

from models.database import get_db
from models.models import User, Organization, UserRole
from schemas.auth import (
    LoginRequest, LoginResponse, RefreshTokenRequest, RefreshTokenResponse,
    LogoutRequest, MessageResponse, UserResponse, ChangePasswordRequest,
    ResetPasswordRequest, ResetPasswordConfirm, SystemInitRequest
)
from services.auth_service import AuthService
from services.init_service import DatabaseInitService
from utils.dependencies import get_current_user, get_current_active_user
from utils.rate_limiter import RateLimiter


# Создаем роутер
router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()
rate_limiter = RateLimiter()


def get_client_info(request: Request) -> dict:
    """Получение информации о клиенте"""
    return {
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "device_info": {
            "platform": request.headers.get("sec-ch-ua-platform", "unknown"),
            "mobile": request.headers.get("sec-ch-ua-mobile") == "?1"
        }
    }


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Авторизация пользователя"""
    
    try:
        client_info = get_client_info(request)
        
        # Добавляем детальное логирование
        print(f"🔍 Login attempt for email: {login_data.email}")
        print(f"🔍 Organization slug: {login_data.organization_slug}")
        print(f"🔍 Client info: {client_info}")
        
        # Проверяем rate limiting
        if not rate_limiter.check_rate_limit(
            f"login:{client_info['ip_address']}", 
            max_requests=5, 
            window_seconds=300  # 5 попыток в 5 минут
        ):
            print(f"❌ Rate limit exceeded for {client_info['ip_address']}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later."
            )
        
        # Аутентификация пользователя
        print(f"🔍 Attempting authentication...")
        user = AuthService.authenticate_user(
            db=db,
            email=login_data.email,
            password=login_data.password,
            organization_slug=login_data.organization_slug
        )
        
        print(f"🔍 Authentication result: {user is not None}")
        
        if not user:
            print(f"❌ Authentication failed for {login_data.email}")
            
            # Логируем неуспешную попытку
            org = None
            if login_data.organization_slug:
                org = db.query(Organization).filter(
                    Organization.slug == login_data.organization_slug
                ).first()
                print(f"🔍 Organization found: {org is not None}")
            
            try:
                AuthService.log_login_attempt(
                    db=db,
                    email=login_data.email,
                    success=False,
                    organization_id=org.id if org else None,
                    failure_reason="invalid_credentials",
                    ip_address=client_info["ip_address"],
                    user_agent=client_info["user_agent"]
                )
            except Exception as log_error:
                print(f"⚠️ Failed to log login attempt: {log_error}")
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        print(f"✅ User authenticated: {user.email}, role: {user.role}")
        
        # Создаем токены
        print(f"🔍 Creating tokens...")
        tokens = AuthService.create_user_tokens(
            db=db,
            user=user,
            device_info=login_data.device_info or client_info["device_info"],
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"]
        )
        
        print(f"✅ Tokens created successfully")
        
        # Логируем успешный вход
        try:
            AuthService.log_login_attempt(
                db=db,
                email=login_data.email,
                success=True,
                organization_id=user.organization_id,
                ip_address=client_info["ip_address"],
                user_agent=client_info["user_agent"]
            )
        except Exception as log_error:
            print(f"⚠️ Failed to log successful login: {log_error}")
        
        # Логируем действие пользователя
        try:
            AuthService.log_user_action(
                db=db,
                user_id=user.id,
                action="user_login",
                organization_id=user.organization_id,
                ip_address=client_info["ip_address"],
                user_agent=client_info["user_agent"]
            )
        except Exception as log_error:
            print(f"⚠️ Failed to log user action: {log_error}")
        
        print(f"✅ Login successful for {user.email}")
        
        return LoginResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_type=tokens["token_type"],
            expires_in=tokens["expires_in"],
            user=UserResponse.from_orm(user)
        )
        
    except HTTPException as http_ex:
        print(f"❌ HTTP Exception: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error in login: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during login: {str(e)}"
        )


# Системные endpoints (только для system_owner)
@router.post("/system/init", response_model=dict)
async def initialize_system(
    request: Request,
    init_data: SystemInitRequest,
    db: Session = Depends(get_db)
):
    """Инициализация системы (только при первом запуске)"""
    
    try:
        client_info = get_client_info(request)
        
        print(f"🔍 System initialization attempt")
        print(f"🔍 Organization data: {init_data.organization.dict()}")
        print(f"🔍 Admin user email: {init_data.admin_user.email}")
        
        # Проверяем, не инициализирована ли уже система
        if DatabaseInitService.is_database_initialized(db):
            print(f"❌ System already initialized")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System is already initialized"
            )
        
        # Инициализируем систему
        print(f"🔍 Initializing system...")
        result = DatabaseInitService.initialize_system(db, init_data)
        print(f"✅ System initialized successfully")
        
        return result
        
    except HTTPException as http_ex:
        print(f"❌ HTTP Exception in init: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error in system init: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize system: {str(e)}"
        )


@router.get("/system/status")
async def get_system_status(db: Session = Depends(get_db)):
    """Получение статуса системы"""
    
    try:
        print(f"🔍 Checking system status...")
        is_initialized = DatabaseInitService.is_database_initialized(db)
        print(f"🔍 System initialized: {is_initialized}")
        
        if is_initialized:
            stats = DatabaseInitService.get_system_stats(db)
            return {
                "initialized": True,
                "stats": stats
            }
        else:
            return {
                "initialized": False,
                "message": "System needs to be initialized"
            }
            
    except Exception as e:
        print(f"❌ Error getting system status: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system status: {str(e)}"
        )

@router.get("/system/status")
async def get_system_status(db: Session = Depends(get_db)):
    """Проверка статуса инициализации системы"""
    try:
        logger.info("🔍 Checking system status...")
        is_initialized = DatabaseInitService.is_database_initialized(db)
        logger.info(f"🔍 System initialized: {is_initialized}")
        return {"initialized": is_initialized}
    except Exception as e:
        logger.error(f"❌ Error checking system status: {e}")
        return {"initialized": False, "error": str(e)}