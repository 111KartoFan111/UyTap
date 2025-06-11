from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid

from models.database import get_db
from models.models import User, UserRole, UserStatus
from services.auth_service import AuthService


security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Session = Depends(get_db)
) -> User:
    """Получение текущего пользователя по токену"""
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Проверяем токен
        token_data = AuthService.verify_token(credentials.credentials)
        if token_data is None or token_data.user_id is None:
            raise credentials_exception
        
        # Получаем пользователя
        user = db.query(User).filter(User.id == uuid.UUID(token_data.user_id)).first()
        if user is None:
            raise credentials_exception
            
        return user
        
    except Exception:
        raise credentials_exception


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Получение активного пользователя"""
    
    if current_user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )
    
    # Проверяем статус организации (если пользователь не system_owner)
    if (current_user.organization and 
        current_user.role != UserRole.SYSTEM_OWNER and
        current_user.organization.status not in ["active", "trial"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization account is not active"
        )
    
    return current_user


def require_role(*required_roles: UserRole):
    """Декоратор для проверки роли пользователя"""
    def role_checker(current_user: Annotated[User, Depends(get_current_active_user)]) -> User:
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker


def require_scope(*required_scopes: str):
    """Декоратор для проверки разрешений пользователя"""
    def scope_checker(current_user: Annotated[User, Depends(get_current_active_user)]) -> User:
        user_scopes = AuthService._get_user_scopes(current_user.role)
        
        for scope in required_scopes:
            if scope not in user_scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing required scope: {scope}"
                )
        return current_user
    return scope_checker


# Специфические зависимости для ролей
get_system_owner = require_role(UserRole.SYSTEM_OWNER)
get_admin_user = require_role(UserRole.ADMIN, UserRole.SYSTEM_OWNER)
get_manager_user = require_role(UserRole.MANAGER, UserRole.ADMIN, UserRole.SYSTEM_OWNER)
