# backend/utils/dependencies.py - DEBUGGED AND FIXED VERSION

from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid
import logging

from models.database import get_db
from models.models import User, UserRole, UserStatus
from services.auth_service import AuthService

# Setup logging for debugging
logger = logging.getLogger(__name__)

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
        logger.debug(f"Verifying token: {credentials.credentials[:20]}...")
        token_data = AuthService.verify_token(credentials.credentials)
        
        if token_data is None or token_data.user_id is None:
            logger.error("Token verification failed: invalid token data")
            raise credentials_exception
        
        logger.debug(f"Token verified for user_id: {token_data.user_id}")
        
        # Получаем пользователя
        user = db.query(User).filter(User.id == uuid.UUID(token_data.user_id)).first()
        if user is None:
            logger.error(f"User not found in database: {token_data.user_id}")
            raise credentials_exception
        
        logger.debug(f"User found: {user.email}, role: {user.role}")
        return user
        
    except Exception as e:
        logger.error(f"Error in get_current_user: {str(e)}")
        raise credentials_exception


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Получение активного пользователя"""
    
    logger.debug(f"Checking user status: {current_user.email}, status: {current_user.status}")
    
    if current_user.status != UserStatus.ACTIVE:
        logger.warning(f"User {current_user.email} is not active: {current_user.status}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )
    
    # Проверяем статус организации (если пользователь не system_owner)
    if (current_user.organization and 
        current_user.role != UserRole.SYSTEM_OWNER and
        current_user.organization.status not in ["active", "trial"]):
        logger.warning(f"Organization {current_user.organization_id} is not active: {current_user.organization.status}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization account is not active"
        )
    
    logger.debug(f"User {current_user.email} is active and authorized")
    return current_user


def require_role(*required_roles: UserRole):
    """Декоратор для проверки роли пользователя"""
    def role_checker(current_user: Annotated[User, Depends(get_current_active_user)]) -> User:
        
        # DEBUG: Log the comparison details
        logger.debug(f"Role check - User: {current_user.email}")
        logger.debug(f"User role: {current_user.role} (type: {type(current_user.role)})")
        logger.debug(f"Required roles: {required_roles} (types: {[type(r) for r in required_roles]})")
        
        # Convert to string for comparison if needed
        user_role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        required_role_values = [role.value if hasattr(role, 'value') else str(role) for role in required_roles]
        
        logger.debug(f"Comparing: {user_role_value} in {required_role_values}")
        
        # Check both enum and string values
        role_match = (
            current_user.role in required_roles or 
            user_role_value in required_role_values
        )
        
        if not role_match:
            logger.warning(f"Access denied for user {current_user.email}. "
                         f"Role {current_user.role} not in {required_roles}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not enough permissions. Required: {[r.value for r in required_roles]}, "
                       f"Current: {user_role_value}"
            )
        
        logger.debug(f"Role check passed for user {current_user.email}")
        return current_user
    
    return role_checker


def require_scope(*required_scopes: str):
    """Декоратор для проверки разрешений пользователя"""
    def scope_checker(current_user: Annotated[User, Depends(get_current_active_user)]) -> User:
        logger.debug(f"Checking scopes for user {current_user.email}")
        
        try:
            user_scopes = AuthService._get_user_scopes(current_user.role)
            logger.debug(f"User scopes: {user_scopes}")
            logger.debug(f"Required scopes: {required_scopes}")
            
            for scope in required_scopes:
                if scope not in user_scopes:
                    logger.warning(f"Missing scope {scope} for user {current_user.email}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Missing required scope: {scope}"
                    )
            
            logger.debug(f"All required scopes present for user {current_user.email}")
            return current_user
            
        except Exception as e:
            logger.error(f"Error checking scopes: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Error checking permissions: {str(e)}"
            )
    
    return scope_checker


# Специфические зависимости для ролей
get_system_owner = require_role(UserRole.SYSTEM_OWNER)
get_admin_user = require_role(UserRole.ADMIN, UserRole.SYSTEM_OWNER)
get_manager_user = require_role(UserRole.MANAGER, UserRole.ADMIN, UserRole.SYSTEM_OWNER)

# For backwards compatibility and easier imports
admin_required = require_role(UserRole.ADMIN, UserRole.SYSTEM_OWNER, UserRole.ACCOUNTANT)
accountant_required = require_role(UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.SYSTEM_OWNER)
manager_required = require_role(UserRole.MANAGER, UserRole.ADMIN, UserRole.SYSTEM_OWNER)


# Debug function to check token directly
async def debug_token_info(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Session = Depends(get_db)
):
    """Debug function to check what's in the token"""
    try:
        token_data = AuthService.verify_token(credentials.credentials)
        user = db.query(User).filter(User.id == uuid.UUID(token_data.user_id)).first()
        
        return {
            "token_valid": True,
            "user_id": token_data.user_id,
            "user_email": user.email if user else None,
            "user_role": user.role.value if user else None,
            "user_status": user.status.value if user else None,
            "organization_id": str(user.organization_id) if user and user.organization_id else None,
            "org_status": user.organization.status if user and user.organization else None
        }
    except Exception as e:
        return {
            "token_valid": False,
            "error": str(e)
        }