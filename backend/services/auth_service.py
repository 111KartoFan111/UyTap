from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import hashlib
import secrets
import uuid
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import os

from models.models import User, Organization, RefreshToken, LoginAttempt, UserAction
from models.models import UserRole, UserStatus, OrganizationStatus
from schemas.auth import TokenData, LoginRequest, UserCreate, OrganizationCreate


# Настройки безопасности
SECRET_KEY = os.getenv("SECRET_KEY", "hsu9aQmPbz@vZtN!f7Kd#w8Lx2TPeCm5")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
BCRYPT_ROUNDS = int(os.getenv("BCRYPT_ROUNDS", "12"))

# Контекст для хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=BCRYPT_ROUNDS)


class AuthService:
    """Сервис для работы с авторизацией и аутентификацией"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Хеширование пароля"""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Проверка пароля"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Создание access токена"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token() -> str:
        """Создание refresh токена"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def hash_refresh_token(token: str) -> str:
        """Хеширование refresh токена для хранения в БД"""
        return hashlib.sha256(token.encode()).hexdigest()
    
    @staticmethod
    def verify_token(token: str) -> Optional[TokenData]:
        """Проверка и декодирование access токена"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("sub")
            organization_id: str = payload.get("org_id")
            role: str = payload.get("role")
            scopes: list = payload.get("scopes", [])
            
            if user_id is None:
                return None
                
            return TokenData(
                user_id=user_id,
                organization_id=organization_id,
                role=UserRole(role) if role else None,
                scopes=scopes
            )
        except JWTError:
            return None
    
    @staticmethod
    def authenticate_user(
        db: Session, 
        email: str, 
        password: str, 
        organization_slug: Optional[str] = None
    ) -> Optional[User]:
        """Аутентификация пользователя"""

        user = db.query(User).filter(User.email == email).first()

        if not user or not AuthService.verify_password(password, user.password_hash):
            return None

        # ✅ Если роль SYSTEM_OWNER — разрешаем без организации
        if user.role == UserRole.SYSTEM_OWNER:
            return user

        # Для остальных пользователей обязательна организация
        if not organization_slug:
            return None

        organization = db.query(Organization).filter(
            Organization.slug == organization_slug
        ).first()

        if not organization or user.organization_id != organization.id:
            return None

        # Проверка статуса пользователя
        if user.status != UserStatus.ACTIVE:
            return None

        # Проверка статуса организации (если есть)
        if user.organization and user.organization.status not in [
            OrganizationStatus.ACTIVE, 
            OrganizationStatus.TRIAL
        ]:
            return None

        return user
    
    @staticmethod
    def create_user_tokens(
        db: Session,
        user: User,
        device_info: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """Создание токенов для пользователя"""
        
        # Создаем access token
        access_token_data = {
            "sub": str(user.id),
            "org_id": str(user.organization_id) if user.organization_id else None,
            "role": user.role.value,
            "scopes": AuthService._get_user_scopes(user.role),
            "email": user.email
        }
        
        access_token = AuthService.create_access_token(access_token_data)
        refresh_token = AuthService.create_refresh_token()
        
        # Сохраняем refresh token в БД
        refresh_token_record = RefreshToken(
            user_id=user.id,
            token_hash=AuthService.hash_refresh_token(refresh_token),
            device_info=device_info,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        )
        
        db.add(refresh_token_record)
        
        # Обновляем время последнего входа
        user.last_login_at = datetime.now(timezone.utc)
        user.last_activity_at = datetime.now(timezone.utc)
        
        db.commit()
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Обновление access токена по refresh токену"""
        
        token_hash = AuthService.hash_refresh_token(refresh_token)
        
        # Ищем токен в БД
        db_token = db.query(RefreshToken).filter(
            and_(
                RefreshToken.token_hash == token_hash,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.now(timezone.utc)
            )
        ).first()
        
        if not db_token:
            return None
        
        # Получаем пользователя
        user = db.query(User).filter(User.id == db_token.user_id).first()
        if not user or user.status != UserStatus.ACTIVE:
            return None
        
        # Проверяем организацию
        if user.organization and user.organization.status not in [
            OrganizationStatus.ACTIVE, 
            OrganizationStatus.TRIAL
        ]:
            return None
        
        # Создаем новый access token
        access_token_data = {
            "sub": str(user.id),
            "org_id": str(user.organization_id) if user.organization_id else None,
            "role": user.role.value,
            "scopes": AuthService._get_user_scopes(user.role),
            "email": user.email
        }
        
        access_token = AuthService.create_access_token(access_token_data)
        new_refresh_token = AuthService.create_refresh_token()
        
        # Обновляем refresh token
        db_token.token_hash = AuthService.hash_refresh_token(new_refresh_token)
        db_token.last_used_at = datetime.now(timezone.utc)
        db_token.expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        # Обновляем активность пользователя
        user.last_activity_at = datetime.now(timezone.utc)
        
        db.commit()
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    @staticmethod
    def revoke_refresh_token(
        db: Session, 
        user_id: uuid.UUID, 
        refresh_token: Optional[str] = None,
        revoke_all: bool = False,
        reason: str = "user_logout"
    ):
        """Отзыв refresh токенов"""
        
        if revoke_all:
            # Отзываем все токены пользователя
            db.query(RefreshToken).filter(
                RefreshToken.user_id == user_id
            ).update({
                "is_revoked": True,
                "revoked_at": datetime.now(timezone.utc),
                "revoked_reason": reason
            })
        elif refresh_token:
            # Отзываем конкретный токен
            token_hash = AuthService.hash_refresh_token(refresh_token)
            db.query(RefreshToken).filter(
                and_(
                    RefreshToken.user_id == user_id,
                    RefreshToken.token_hash == token_hash
                )
            ).update({
                "is_revoked": True,
                "revoked_at": datetime.now(timezone.utc),
                "revoked_reason": reason
            })
        
        db.commit()
    
    @staticmethod
    def log_login_attempt(
        db: Session,
        email: str,
        success: bool,
        organization_id: Optional[uuid.UUID] = None,
        failure_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        device_fingerprint: Optional[str] = None
    ):
        """Логирование попытки входа"""
        
        login_attempt = LoginAttempt(
            email=email,
            organization_id=organization_id,
            success=success,
            failure_reason=failure_reason,
            ip_address=ip_address,
            user_agent=user_agent,
            device_fingerprint=device_fingerprint
        )
        
        db.add(login_attempt)
        db.commit()
    
    @staticmethod
    def log_user_action(
        db: Session,
        user_id: uuid.UUID,
        action: str,
        organization_id: Optional[uuid.UUID] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[uuid.UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Логирование действий пользователя"""
        
        user_action = UserAction(
            user_id=user_id,
            organization_id=organization_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            success=success,
            error_message=error_message,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.add(user_action)
        db.commit()
    
    @staticmethod
    def cleanup_expired_tokens(db: Session):
        """Очистка истекших токенов"""
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
        
        deleted_count = db.query(RefreshToken).filter(
            RefreshToken.expires_at < cutoff_date
        ).delete()
        
        db.commit()
        return deleted_count
    
    @staticmethod
    def _get_user_scopes(role: UserRole) -> list:
        """Получение разрешений пользователя по роли"""
        
        scopes_map = {
            UserRole.SYSTEM_OWNER: [
                "system:read", "system:write", "system:admin",
                "organizations:read", "organizations:write", "organizations:admin",
                "users:read", "users:write", "users:admin",
                "audit:read"
            ],
            UserRole.ADMIN: [
                "organization:read", "organization:write",
                "users:read", "users:write",
                "properties:read", "properties:write", "properties:admin",
                "tenants:read", "tenants:write",
                "reports:read"
            ],
            UserRole.MANAGER: [
                "organization:read",
                "users:read",
                "properties:read", "properties:write",
                "tenants:read", "tenants:write",
                "reports:read"
            ],
            UserRole.TECHNICAL_STAFF: [
                "properties:read",
                "maintenance:read", "maintenance:write",
                "inventory:read"
            ],
            UserRole.ACCOUNTANT: [
                "organization:read",
                "properties:read",
                "tenants:read",
                "payments:read", "payments:write",
                "reports:read", "reports:write"
            ],
            UserRole.CLEANER: [
                "properties:read",
                "tasks:read", "tasks:write"
            ],
            UserRole.STOREKEEPER: [
                "inventory:read", "inventory:write",
                "properties:read"
            ]
        }
        
        return scopes_map.get(role, [])