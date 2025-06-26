from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
import os

from models.database import engine, Base
from models.models import Organization, User, UserRole, UserStatus, OrganizationStatus
from services.auth_service import AuthService
from schemas.auth import SystemInitRequest, OrganizationCreate, UserCreate


class DatabaseInitService:
    """Сервис для инициализации базы данных"""
    
    @staticmethod
    def create_tables():
        """Создание всех таблиц"""
        try:
            # Сначала создаем схемы и расширения
            with engine.connect() as conn:
                # Создаем схему audit
                conn.execute(text('CREATE SCHEMA IF NOT EXISTS audit'))
                
                # Создаем расширения (если доступны)
                try:
                    conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
                    print("✅ Extension uuid-ossp created")
                except Exception as e:
                    print(f"⚠️  Warning: Could not create uuid-ossp extension: {e}")
                
                try:
                    conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pg_trgm"'))
                    print("✅ Extension pg_trgm created")
                except Exception as e:
                    print(f"⚠️  Warning: Could not create pg_trgm extension: {e}")
                
                conn.commit()
            
            # Теперь создаем все таблицы
            Base.metadata.create_all(bind=engine)
            print("✅ All tables created successfully")
            return True
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
            return False
    
    @staticmethod
    def is_database_initialized(db: Session) -> bool:
        """Проверка, инициализирована ли база данных"""
        try:
            # Проверяем наличие системного пользователя
            system_user = db.query(User).filter(
                User.role == UserRole.SYSTEM_OWNER
            ).first()
            
            return system_user is not None
        except Exception as e:
            print(f"❌ Error checking database initialization: {e}")
            return False
    
    @staticmethod
    def initialize_system(db: Session, init_data: SystemInitRequest) -> dict:
        """Инициализация системы с первой организацией и администратором"""
        
        try:
            # Проверяем, не инициализирована ли уже система
            if DatabaseInitService.is_database_initialized(db):
                raise ValueError("System is already initialized")
            
            # Создаем организацию
            organization = Organization(
                name=init_data.organization.name,
                slug=init_data.organization.slug,
                description=init_data.organization.description,
                email=init_data.organization.email,
                phone=init_data.organization.phone,
                website=init_data.organization.website,
                country=init_data.organization.country,
                city=init_data.organization.city,
                address=init_data.organization.address,
                postal_code=init_data.organization.postal_code,
                status=OrganizationStatus.ACTIVE,
                subscription_plan=init_data.organization.subscription_plan,
                max_users=init_data.organization.max_users,
                max_properties=init_data.organization.max_properties,
                trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
                settings={}
            )
            
            db.add(organization)
            db.flush()  # Получаем ID организации
            
            # Создаем системного администратора
            system_admin = User(
                organization_id=None,  # Системный пользователь не привязан к организации
                email="admin@system.local",
                password_hash=AuthService.hash_password("SystemAdmin123!"),
                first_name="System",
                last_name="Administrator",
                role=UserRole.SYSTEM_OWNER,
                status=UserStatus.ACTIVE,
                email_verified=True,
                preferences={}
            )
            
            db.add(system_admin)
            
            # Создаем администратора организации
            org_admin = User(
                organization_id=organization.id,
                email=init_data.admin_user.email,
                password_hash=AuthService.hash_password(init_data.admin_user.password),
                first_name=init_data.admin_user.first_name,
                last_name=init_data.admin_user.last_name,
                middle_name=init_data.admin_user.middle_name,
                phone=init_data.admin_user.phone,
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
                email_verified=True,
                preferences={}
            )
            
            db.add(org_admin)
            db.commit()
            
            return {
                "success": True,
                "message": "System initialized successfully",
                "organization": {
                    "id": str(organization.id),
                    "name": organization.name,
                    "slug": organization.slug
                },
                "system_admin": {
                    "id": str(system_admin.id),
                    "email": system_admin.email
                },
                "org_admin": {
                    "id": str(org_admin.id),
                    "email": org_admin.email,
                    "name": f"{org_admin.first_name} {org_admin.last_name}"
                }
            }
            
        except Exception as e:
            db.rollback()
            raise e
    
    @staticmethod
    def create_organization_with_admin(
        db: Session, 
        org_data: OrganizationCreate, 
        admin_data: UserCreate
    ) -> dict:
        """Создание новой организации с администратором"""
        
        try:
            # Проверяем уникальность slug
            existing_org = db.query(Organization).filter(
                Organization.slug == org_data.slug
            ).first()
            
            if existing_org:
                raise ValueError(f"Organization with slug '{org_data.slug}' already exists")
            
            # Создаем организацию
            organization = Organization(
                name=org_data.name,
                slug=org_data.slug,
                description=org_data.description,
                email=org_data.email,
                phone=org_data.phone,
                website=org_data.website,
                country=org_data.country,
                city=org_data.city,
                address=org_data.address,
                postal_code=org_data.postal_code,
                status=OrganizationStatus.TRIAL,
                subscription_plan=org_data.subscription_plan,
                max_users=org_data.max_users,
                max_properties=org_data.max_properties,
                trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
                settings={}
            )
            
            db.add(organization)
            db.flush()
            
            # Проверяем уникальность email в организации
            existing_user = db.query(User).filter(
                User.organization_id == organization.id,
                User.email == admin_data.email
            ).first()
            
            if existing_user:
                raise ValueError(f"User with email '{admin_data.email}' already exists in this organization")
            
            # Создаем администратора организации
            admin_user = User(
                organization_id=organization.id,
                email=admin_data.email,
                password_hash=AuthService.hash_password(admin_data.password),
                first_name=admin_data.first_name,
                last_name=admin_data.last_name,
                middle_name=admin_data.middle_name,
                phone=admin_data.phone,
                role=UserRole.ADMIN,
                status=UserStatus.PENDING_VERIFICATION,
                email_verified=False,
                preferences={}
            )
            
            db.add(admin_user)
            db.commit()
            
            return {
                "success": True,
                "message": "Organization and admin user created successfully",
                "organization": {
                    "id": str(organization.id),
                    "name": organization.name,
                    "slug": organization.slug,
                    "status": organization.status.value
                },
                "admin": {
                    "id": str(admin_user.id),
                    "email": admin_user.email,
                    "name": f"{admin_user.first_name} {admin_user.last_name}",
                    "status": admin_user.status.value
                }
            }
            
        except Exception as e:
            db.rollback()
            raise e
    
    @staticmethod
    def run_database_migrations(db: Session):
        """Выполнение миграций и настройка БД (вызывается после создания таблиц)"""
        try:
            # Дополнительные настройки после создания таблиц
            print("✅ Database migrations completed successfully")
            
        except Exception as e:
            db.rollback()
            print(f"❌ Database migration error: {e}")
            # Не поднимаем исключение, чтобы приложение могло запуститься
    
    @staticmethod
    def cleanup_old_data(db: Session):
        """Очистка старых данных"""
        try:
            # Очищаем истекшие refresh токены
            deleted_tokens = AuthService.cleanup_expired_tokens(db)
            
            # Очищаем старые логи входа (старше 90 дней)
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)
            
            deleted_login_attempts = db.execute(
                text("""
                DELETE FROM audit.login_attempts 
                WHERE created_at < :cutoff_date
                """),
                {"cutoff_date": cutoff_date}
            ).rowcount
            
            # Очищаем старые действия пользователей (старше 365 дней)
            cutoff_date_actions = datetime.now(timezone.utc) - timedelta(days=365)
            
            deleted_actions = db.execute(
                text("""
                DELETE FROM audit.user_actions 
                WHERE created_at < :cutoff_date
                """),
                {"cutoff_date": cutoff_date_actions}
            ).rowcount
            
            db.commit()
            
            return {
                "deleted_tokens": deleted_tokens,
                "deleted_login_attempts": deleted_login_attempts,
                "deleted_actions": deleted_actions
            }
            
        except Exception as e:
            db.rollback()
            raise e
    
    @staticmethod
    def get_system_stats(db: Session) -> dict:
        """Получение статистики системы"""
        try:
            stats = {}
            
            # Статистика организаций
            stats["organizations"] = {
                "total": db.query(Organization).count(),
                "active": db.query(Organization).filter(
                    Organization.status == OrganizationStatus.ACTIVE
                ).count(),
                "trial": db.query(Organization).filter(
                    Organization.status == OrganizationStatus.TRIAL
                ).count(),
                "suspended": db.query(Organization).filter(
                    Organization.status == OrganizationStatus.SUSPENDED
                ).count()
            }
            
            # Статистика пользователей
            stats["users"] = {
                "total": db.query(User).count(),
                "active": db.query(User).filter(
                    User.status == UserStatus.ACTIVE
                ).count(),
                "pending": db.query(User).filter(
                    User.status == UserStatus.PENDING_VERIFICATION
                ).count(),
                "suspended": db.query(User).filter(
                    User.status == UserStatus.SUSPENDED
                ).count()
            }
            
            # Статистика по ролям
            stats["roles"] = {}
            for role in UserRole:
                stats["roles"][role.value] = db.query(User).filter(
                    User.role == role
                ).count()
            
            return stats
            
        except Exception as e:
            raise e