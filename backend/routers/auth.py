# Обновленный роутер auth.py с добавлением системной инициализации

import traceback
from datetime import datetime, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid
from models.database import get_db
from schemas.auth import (
    LoginRequest, LoginResponse, RefreshTokenRequest, RefreshTokenResponse,
    LogoutRequest, MessageResponse, UserResponse, ChangePasswordRequest,
    ResetPasswordRequest, ResetPasswordConfirm, SystemInitRequest
)
from services.auth_service import AuthService
from services.init_service import DatabaseInitService
from models.models import User, Organization, UserRole
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


@router.post("/system/init", response_model=MessageResponse)
async def initialize_system(
    request: Request,
    init_data: SystemInitRequest,
    db: Session = Depends(get_db)
):
    """Инициализация системы с созданием первой организации и администратора"""
    
    try:
        client_info = get_client_info(request)
        
        print(f"🔍 System initialization attempt from {client_info['ip_address']}")
        
        # Проверяем, не инициализирована ли уже система
        if DatabaseInitService.is_database_initialized(db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System is already initialized"
            )
        
        # Проверяем rate limiting для инициализации
        if not rate_limiter.check_rate_limit(
            f"system_init:{client_info['ip_address']}", 
            max_requests=3, 
            window_seconds=3600  # 3 попытки в час
        ):
            print(f"❌ Rate limit exceeded for system init from {client_info['ip_address']}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many system initialization attempts. Please try again later."
            )
        
        print(f"🔍 Initializing system...")
        
        # Инициализируем систему
        result = DatabaseInitService.initialize_system(db, init_data)
        
        print(f"✅ System initialized successfully")
        print(f"✅ Organization: {result['organization']['name']}")
        print(f"✅ System Admin: {result['system_admin']['email']}")
        print(f"✅ Org Admin: {result['org_admin']['email']}")
        
        return MessageResponse(
            message="System initialized successfully",
            success=True
        )
        
    except HTTPException as http_ex:
        print(f"❌ HTTP Exception: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error in system init: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during system initialization: {str(e)}"
        )


@router.get("/system/status")
async def get_system_status(db: Session = Depends(get_db)):
    """Проверка статуса инициализации системы"""
    
    try:
        is_initialized = DatabaseInitService.is_database_initialized(db)
        
        # Получаем базовую статистику
        org_count = db.query(Organization).count()
        user_count = db.query(User).count()
        
        return {
            "initialized": is_initialized,
            "organizations_count": org_count,
            "users_count": user_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error checking system status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking system status"
        )


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
            user=UserResponse.model_validate(user)
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


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Обновление access токена"""
    
    try:
        client_info = get_client_info(request)
        
        # Проверяем rate limiting
        if not rate_limiter.check_rate_limit(
            f"refresh:{client_info['ip_address']}", 
            max_requests=10, 
            window_seconds=300  # 10 попыток в 5 минут
        ):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many token refresh attempts. Please try again later."
            )
        
        # Обновляем токен
        tokens = AuthService.refresh_access_token(db, refresh_data.refresh_token)
        
        if not tokens:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )
        
        return RefreshTokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_type=tokens["token_type"],
            expires_in=tokens["expires_in"]
        )
        
    except HTTPException as http_ex:
        raise
    except Exception as e:
        print(f"❌ Unexpected error in token refresh: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during token refresh"
        )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    logout_data: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Выход из системы"""
    
    try:
        client_info = get_client_info(request)
        
        # Отзываем токены
        AuthService.revoke_refresh_token(
            db=db,
            user_id=current_user.id,
            refresh_token=logout_data.refresh_token,
            revoke_all=logout_data.logout_all_devices,
            reason="user_logout"
        )
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="user_logout",
            organization_id=current_user.organization_id,
            details={"logout_all_devices": logout_data.logout_all_devices},
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"]
        )
        
        return MessageResponse(
            message="Successfully logged out",
            success=True
        )
        
    except Exception as e:
        print(f"❌ Error during logout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during logout"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Получить информацию о текущем пользователе"""
    return UserResponse.model_validate(current_user)