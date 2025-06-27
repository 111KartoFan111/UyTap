#!/usr/bin/env python3
"""
Скрипт для создания суперадминистратора системы
Запуск: python create_superadmin.py
"""

import sys
import os
from datetime import datetime, timezone
import uuid

# Добавляем путь к проекту
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.database import SessionLocal, engine
from models.models import User, UserRole, UserStatus
from services.auth_service import AuthService

from sqlalchemy import text  # ✅ Добавлен для работы с текстовым SQL

def create_superadmin():
    """Создание суперадминистратора"""
    
    print("🔧 Создание суперадминистратора системы...")
    
    # Данные суперадмина
    superadmin_data = {
        "email": "admin@system.com",
        "password": "Admin123!",
        "first_name": "System",
        "last_name": "Administrator",
        "middle_name": None,
        "phone": None,
        "role": UserRole.SYSTEM_OWNER,
        "status": UserStatus.ACTIVE
    }
    
    try:
        with SessionLocal() as db:
            # Проверяем, есть ли уже суперадмин
            existing_superadmin = db.query(User).filter(
                User.role == UserRole.SYSTEM_OWNER
            ).first()
            
            if existing_superadmin:
                print(f"⚠️  Суперадмин уже существует:")
                print(f"   Email: {existing_superadmin.email}")
                print(f"   ID: {existing_superadmin.id}")
                return False
            
            # Проверяем, есть ли пользователь с таким email
            existing_user = db.query(User).filter(
                User.email == superadmin_data["email"]
            ).first()
            
            if existing_user:
                print(f"❌ Пользователь с email {superadmin_data['email']} уже существует!")
                return False
            
            # Создаем суперадмина
            superadmin = User(
                id=uuid.uuid4(),
                organization_id=None,  # Суперадмин не привязан к организации
                email=superadmin_data["email"],
                password_hash=AuthService.hash_password(superadmin_data["password"]),
                first_name=superadmin_data["first_name"],
                last_name=superadmin_data["last_name"],
                middle_name=superadmin_data["middle_name"],
                phone=superadmin_data["phone"],
                avatar_url=None,
                role=superadmin_data["role"],
                status=superadmin_data["status"],
                email_verified=True,
                phone_verified=False,
                two_factor_enabled=False,
                last_login_at=None,
                last_activity_at=None,
                password_changed_at=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                preferences={}
            )
            
            db.add(superadmin)
            db.commit()
            
            print("✅ Суперадминистратор успешно создан!")
            print(f"   ID: {superadmin.id}")
            print(f"   Email: {superadmin.email}")
            print(f"   Пароль: {superadmin_data['password']}")
            print(f"   Роль: {superadmin.role.value}")
            print(f"   Статус: {superadmin.status.value}")
            print()
            print("🔐 Данные для входа:")
            print(f"   Email: {superadmin.email}")
            print(f"   Пароль: {superadmin_data['password']}")
            print(f"   Организация: оставить пустым")
            
            return True
            
    except Exception as e:
        print(f"❌ Ошибка при создании суперадмина: {e}")
        return False


def main():
    """Главная функция"""
    
    print("=" * 50)
    print("🏠 Rental System - Создание суперадмина")
    print("=" * 50)
    
    # Проверяем подключение к БД
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))  # ✅ Исправлено
        print("✅ Подключение к базе данных установлено")
    except Exception as e:
        print(f"❌ Ошибка подключения к БД: {e}")
        return
    
    # Создаем суперадмина
    success = create_superadmin()
    
    if success:
        print()
        print("🎉 Суперадминистратор готов к использованию!")
        print("   Теперь можно войти в систему с указанными данными.")
    else:
        print()
        print("❌ Не удалось создать суперадминистратора.")
    
    print("=" * 50)


if __name__ == "__main__":
    main()
