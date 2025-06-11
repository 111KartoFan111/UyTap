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
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "device_info": {
            "platform": request.headers.get("sec-ch-ua-platform"),
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
    
    client_info = get_client_info(request)
    
    # Проверяем rate limiting
    if not rate_limiter.check_rate_limit(
        f"login:{client_info['ip_address']}", 
        max_requests=5, 
        window_seconds=300  # 5 попыток в 5 минут
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    try:
        # Аутентификация пользователя
        user = AuthService.authenticate_user(
            db=db,
            email=login_data.email,
            password=login_data.password,
            organization_slug=login_data.organization_slug
        )
        
        if not user:
            # Логируем неуспешную попытку
            org = None
            if login_data.organization_slug:
                org = db.query(Organization).filter(
                    Organization.slug == login_data.organization_slug
                ).first()
            
            AuthService.log_login_attempt(
                db=db,
                email=login_data.email,
                success=False,
                organization_id=org.id if org else None,
                failure_reason="invalid_credentials",
                ip_address=client_info["ip_address"],
                user_agent=client_info["user_agent"]
            )
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Создаем токены
        tokens = AuthService.create_user_tokens(
            db=db,
            user=user,
            device_info=login_data.device_info or client_info["device_info"],
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"]
        )
        
        # Логируем успешный вход
        AuthService.log_login_attempt(
            db=db,
            email=login_data.email,
            success=True,
            organization_id=user.organization_id,
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"]
        )
        
        # Логируем действие пользователя
        AuthService.log_user_action(
            db=db,
            user_id=user.id,
            action="user_login",
            organization_id=user.organization_id,
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"]
        )
        
        return LoginResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_type=tokens["token_type"],
            expires_in=tokens["expires_in"],
            user=UserResponse.from_orm(user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Обновление access токена"""
    
    client_info = get_client_info(request)
    
    # Проверяем rate limiting
    if not rate_limiter.check_rate_limit(
        f"refresh:{client_info['ip_address']}", 
        max_requests=10, 
        window_seconds=60  # 10 попыток в минуту
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many refresh attempts. Please try again later."
        )
    
    try:
        tokens = AuthService.refresh_access_token(
            db=db, 
            refresh_token=refresh_data.refresh_token
        )
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during token refresh"
        )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    logout_data: LogoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Выход из системы"""
    
    client_info = get_client_info(request)
    
    try:
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
        
        return MessageResponse(message="Successfully logged out")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during logout"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Получение информации о текущем пользователе"""
    return UserResponse.from_orm(current_user)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    request: Request,
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Смена пароля"""
    
    client_info = get_client_info(request)
    
    try:
        # Проверяем текущий пароль
        if not AuthService.verify_password(
            password_data.current_password, 
            current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Проверяем, что новый пароль отличается от текущего
        if AuthService.verify_password(
            password_data.new_password, 
            current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password"
            )
        
        # Обновляем пароль
        current_user.password_hash = AuthService.hash_password(password_data.new_password)
        current_user.password_changed_at = datetime.now(timezone.utc)
        
        # Отзываем все refresh токены кроме текущего
        AuthService.revoke_refresh_token(
            db=db,
            user_id=current_user.id,
            revoke_all=True,
            reason="password_changed"
        )
        
        db.commit()
        
        # Логируем действие
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="password_changed",
            organization_id=current_user.organization_id,
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"]
        )
        
        return MessageResponse(message="Password changed successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during password change"
        )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: Request,
    reset_data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Запрос на сброс пароля"""
    
    client_info = get_client_info(request)
    
    # Проверяем rate limiting
    if not rate_limiter.check_rate_limit(
        f"reset:{client_info['ip_address']}", 
        max_requests=3, 
        window_seconds=3600  # 3 попытки в час
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many reset password attempts. Please try again later."
        )
    
    # TODO: Реализовать отправку email с токеном сброса
    # Здесь будет логика отправки email
    
    return MessageResponse(
        message="If an account with this email exists, you will receive password reset instructions"
    )


@router.post("/reset-password/confirm", response_model=MessageResponse)
async def reset_password_confirm(
    request: Request,
    confirm_data: ResetPasswordConfirm,
    db: Session = Depends(get_db)
):
    """Подтверждение сброса пароля"""
    
    # TODO: Реализовать проверку токена и сброс пароля
    # Здесь будет логика проверки токена из email
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Password reset confirmation not implemented yet"
    )


# Системные endpoints (только для system_owner)
@router.post("/system/init", response_model=dict)
async def initialize_system(
    request: Request,
    init_data: SystemInitRequest,
    db: Session = Depends(get_db)
):
    """Инициализация системы (только при первом запуске)"""
    
    client_info = get_client_info(request)
    
    try:
        # Проверяем, не инициализирована ли уже система
        if DatabaseInitService.is_database_initialized(db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System is already initialized"
            )
        
        # Инициализируем систему
        result = DatabaseInitService.initialize_system(db, init_data)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize system: {str(e)}"
        )


@router.get("/system/status")
async def get_system_status(db: Session = Depends(get_db)):
    """Получение статуса системы"""
    
    try:
        is_initialized = DatabaseInitService.is_database_initialized(db)
        
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get system status"
        )