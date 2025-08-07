# backend/main.py - ИСПРАВЛЕННАЯ ВЕРСИЯ ИМПОРТОВ

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
import os
import logging
import time
from fastapi import status


# БЕЗОПАСНЫЕ ИМПОРТЫ МОДЕЛЕЙ
try:
    from models.database import engine, SessionLocal
    from models.models import Base  # Базовые модели
    print("✅ Base models imported successfully")
except Exception as e:
    print(f"❌ Error importing base models: {e}")
    raise

try:
    # Импортируем расширенные модели
    from models import extended_models
    print("✅ Extended models imported successfully")
except Exception as e:
    print(f"❌ Error importing extended models: {e}")
    raise

try:
    # Импортируем модели зарплат
    from models import payroll_template, payroll_operation , acquiring_models
    print("✅ Payroll models imported successfully")
except Exception as e:
    print(f"⚠️  Warning: Payroll models not available: {e}")

# Импорты роутеров
try:
    from routers import (
        auth, admin, properties, rentals, clients, 
        orders, reports, documents, tasks, payroll, inventory, organization, payments,order_payments,export_reports,acquiring
    )
    print("✅ Core routers imported successfully")
except Exception as e:
    print(f"❌ Error importing core routers: {e}")
    raise

try:
    # Импорт расширенных роутеров зарплат (опционально)
    from routers import payroll_extended, admin_payroll, manager_payroll
    PAYROLL_EXTENDED_AVAILABLE = True
    print("✅ Extended payroll routers imported successfully")
except Exception as e:
    print(f"⚠️  Warning: Extended payroll routers not available: {e}")
    PAYROLL_EXTENDED_AVAILABLE = False

# Остальные импорты
from services.init_service import DatabaseInitService
from utils.logging_config import setup_logging
from utils.exceptions import (
    http_exception_handler,
    validation_exception_handler, 
    general_exception_handler
)
from utils.rate_limiter import RateLimiter

# Настройка логирования
setup_logging()
logger = logging.getLogger(__name__)

# Глобальный rate limiter
rate_limiter = RateLimiter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Жизненный цикл приложения"""
    
    # Startup
    logger.info("🚀 Starting Enhanced Rental System API...")
    
    try:
        # Создаем таблицы если их нет
        logger.info("📊 Creating database tables...")
        success = DatabaseInitService.create_tables()
        
        if success:
            logger.info("✅ Database tables created successfully")
        else:
            logger.error("❌ Failed to create database tables")
            raise Exception("Database table creation failed")
        
        # Выполняем дополнительные миграции
        with SessionLocal() as db:
            DatabaseInitService.run_database_migrations(db)
        
        logger.info("✅ Database initialization completed")
        
        # Проверяем инициализацию системы
        try:
            with SessionLocal() as db:
                is_initialized = DatabaseInitService.is_database_initialized(db)
                if is_initialized:
                    logger.info("✅ System is already initialized")
                else:
                    logger.warning("⚠️  System needs to be initialized")
                    logger.info("📝 Use POST /api/auth/system/init to initialize the system")
        except Exception as e:
            logger.warning(f"⚠️  Could not check initialization status: {e}")
        
        # Запускаем фоновые задачи
        try:
            from services.background_service import BackgroundService
            BackgroundService.start_scheduled_tasks()
            logger.info("✅ Background tasks started")
        except Exception as e:
            logger.warning(f"⚠️  Background tasks not started: {e}")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize application: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Enhanced Rental System API...")
    
    # Очистка старых данных
    try:
        with SessionLocal() as db:
            cleanup_result = DatabaseInitService.cleanup_old_data(db)
            logger.info(f"🧹 Cleanup completed: {cleanup_result}")
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")


# Создание приложения FastAPI
app = FastAPI(
    title="Enhanced Rental System API",
    description="""
    🏠 **Комплексная система управления арендой недвижимости**
    
    Полнофункциональная API для управления арендой квартир с расширенными возможностями.
    """,
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc", 
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# Middleware для безопасности
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0").split(",")
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Логирование HTTP запросов"""
    start_time = time.time()
    
    # Логируем входящий запрос
    logger.info(f"📥 {request.method} {request.url.path} from {request.client.host}")
    
    # Выполняем запрос
    response = await call_next(request)
    
    # Логируем время выполнения
    process_time = time.time() - start_time
    logger.info(f"📤 {request.method} {request.url.path} completed in {process_time:.3f}s with status {response.status_code}")
    
    # Добавляем заголовок с временем выполнения
    response.headers["X-Process-Time"] = str(process_time)
    
    return response

# Обработчики исключений
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Подключение всех роутеров
logger.info("🔌 Connecting routers...")

# Основные роутеры
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(organization.router)
app.include_router(properties.router)
app.include_router(rentals.router)
app.include_router(clients.router)
app.include_router(orders.router)
app.include_router(reports.router)
app.include_router(documents.router)
app.include_router(tasks.router)
app.include_router(payroll.router)
app.include_router(inventory.router)
app.include_router(payments.router)
app.include_router(order_payments.router)
app.include_router(export_reports.router)
app.include_router(acquiring.router)


# Расширенные роутеры зарплат (если доступны)
if PAYROLL_EXTENDED_AVAILABLE:
    app.include_router(payroll_extended.router)
    app.include_router(admin_payroll.router)
    app.include_router(manager_payroll.router)
    logger.info("✅ Extended payroll routers connected")
else:
    logger.warning("⚠️  Extended payroll routers not connected")

logger.info("✅ All available routers connected")

# Корневой endpoint
@app.get("/", tags=["Root"])
async def root():
    """Корневой endpoint API"""
    return {
        "message": "🏠 Enhanced Rental System API",
        "version": "2.0.0",
        "docs": "/api/docs",
        "admin": "/admin",
        "status": "🟢 Online",
        "features": [
            "🏢 Property Management",
            "👥 Client Management", 
            "📋 Rental Management",
            "✅ Task Management",
            "🛒 Room Orders",
            "💰 Financial Reports",
            "📄 Document Management",
            "📊 Analytics & Reports",
            "📦 Inventory Management",
            "🔐 Multi-tenant Security"
        ]
    }

# Health check endpoint
@app.get("/api/health", tags=["Health"])
async def health_check():
    """Проверка состояния API"""
    try:
        # Проверяем подключение к БД
        with SessionLocal() as db:
            db.execute("SELECT 1")
        
        return {
            "status": "🟢 Healthy",
            "database": "🟢 Connected",
            "version": "2.0.0",
            "payroll_extended": "✅ Available" if PAYROLL_EXTENDED_AVAILABLE else "⚠️ Limited",
            "modules": {
                "properties": "✅ Active",
                "rentals": "✅ Active", 
                "clients": "✅ Active",
                "tasks": "✅ Active",
                "orders": "✅ Active",
                "reports": "✅ Active",
                "documents": "✅ Active",
                "inventory": "✅ Active",
                "payroll": "✅ Active",
                "payroll_extended": "✅ Active" if PAYROLL_EXTENDED_AVAILABLE else "⚠️ Limited"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "🔴 Unhealthy",
            "database": "🔴 Disconnected",
            "error": str(e)
        }

# Остальные endpoints остаются без изменений...


if __name__ == "__main__":
    import uvicorn
    import sys
    import time
    from datetime import datetime
    
    # Запуск сервера
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=os.getenv("DEBUG", "false").lower() == "true",
        log_level="info"
    )