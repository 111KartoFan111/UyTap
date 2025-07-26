# backend/main.py - ОБНОВЛЕННАЯ ВЕРСИЯ
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
import os
import logging
import time

# Импорты приложения
from models.database import engine, SessionLocal
from models.models import Base
# Импортируем все роутеры
# Импортируем все роутеры
from routers import (
    auth, admin, properties, rentals, clients, 
    orders, reports, documents, tasks, payroll, inventory,organization, payments
)
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
        with SessionLocal() as db:
            is_initialized = DatabaseInitService.is_database_initialized(db)
            if is_initialized:
                logger.info("✅ System is already initialized")
            else:
                logger.warning("⚠️  System needs to be initialized")
                logger.info("📝 Use POST /api/auth/system/init to initialize the system")
        
        # Запускаем фоновые задачи
        from services.background_service import BackgroundService
        BackgroundService.start_scheduled_tasks()
        logger.info("✅ Background tasks started")
        
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
    
    ## Основные модули
    
    * 🏢 **Управление помещениями** - добавление, редактирование, статусы
    * 👥 **Управление клиентами** - база клиентов, история, аналитика
    * 📋 **Система аренды** - создание, продление, заселение/выселение
    * ✅ **Управление задачами** - уборка, обслуживание, автоназначение
    * 🛒 **Заказы в номер** - еда, услуги, доставка
    * 💰 **Финансы и отчеты** - доходы, расходы, зарплата
    * 📄 **Документооборот** - договоры, акты, ЭСФ
    * 📊 **Аналитика** - загруженность, производительность
    * 📦 **Склад** - учет материалов, списание
    
    ## Роли и права доступа
    
    * **System Owner** - владелец системы (полный доступ)
    * **Admin** - администратор организации 
    * **Manager** - менеджер (аренда, клиенты)
    * **Technical Staff** - технический персонал
    * **Accountant** - бухгалтер (финансы, отчеты)
    * **Cleaner** - уборщик (задачи уборки)
    * **Storekeeper** - кладовщик (склад, материалы)
    
    ## Ключевые особенности
    
    * 🔐 **Мультитенантность** - изоляция данных между организациями
    * 🔄 **Автоматизация** - автоназначение задач, расчет зарплаты
    * 📱 **Мобильная поддержка** - адаптивный интерфейс
    * 🛡️ **Безопасность** - JWT токены, аудит действий
    * 📈 **Масштабируемость** - поддержка больших объемов данных
    * 🌍 **Локализация** - поддержка казахского и русского языков
    
    ## Интеграции
    
    * **ЭСФ/ЭАВР** - интеграция с ИС ЭСФ Казахстана
    * **Платежи** - поддержка различных способов оплаты
    * **Отчетность** - экспорт в Excel, PDF
    * **Уведомления** - SMS, email, push-уведомления
    
    ## Авторизация
    
    Используйте Bearer токен в заголовке Authorization:
    ```
    Authorization: Bearer <your_token>
    ```
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
            "timestamp": datetime.now().isoformat(),
            "modules": {
                "properties": "✅ Active",
                "rentals": "✅ Active", 
                "clients": "✅ Active",
                "tasks": "✅ Active",
                "orders": "✅ Active",
                "reports": "✅ Active",
                "documents": "✅ Active",
                "inventory": "✅ Active"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "🔴 Unhealthy",
            "database": "🔴 Disconnected",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Информация о системе
@app.get("/api/info", tags=["System"])
async def system_info():
    """Подробная информация о системе"""
    return {
        "name": "Enhanced Rental System API",
        "version": "2.0.0",
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "debug": os.getenv("DEBUG", "false").lower() == "true",
        "modules": {
            "properties": {
                "description": "Управление помещениями",
                "endpoints": ["/api/properties"]
            },
            "rentals": {
                "description": "Управление арендой",
                "endpoints": ["/api/rentals"]
            },
            "clients": {
                "description": "Управление клиентами", 
                "endpoints": ["/api/clients"]
            },
            "tasks": {
                "description": "Управление задачами",
                "endpoints": ["/api/tasks"]
            },
            "orders": {
                "description": "Заказы в номер",
                "endpoints": ["/api/orders"]
            },
            "reports": {
                "description": "Отчеты и аналитика",
                "endpoints": ["/api/reports"]
            },
            "documents": {
                "description": "Документооборот",
                "endpoints": ["/api/documents"]
            },
            "payroll": {
                "description": "Расчет зарплаты",
                "endpoints": ["/api/payroll"]
            },
            "inventory": {
                "description": "Управление складом",
                "endpoints": ["/api/inventory"]
            }
        },
        "features": {
            "multi_tenant": True,
            "admin_panel": True, 
            "audit_logging": True,
            "rate_limiting": True,
            "document_generation": True,
            "esf_integration": True,
            "auto_task_assignment": True,
            "payroll_calculation": True,
            "inventory_tracking": True,
            "client_analytics": True,
            "financial_reports": True
        },
        "supported_languages": ["ru", "kk"],
        "supported_formats": ["JSON", "Excel", "PDF"],
        "integrations": ["ЭСФ/ЭАВР", "SMS", "Email", "Payment Systems"]
    }


# Endpoint для получения статистики системы
@app.get("/api/system/stats", tags=["System"])
async def get_system_stats():
    """Получить статистику системы"""
    with SessionLocal() as db:
        from services.init_service import DatabaseInitService
        stats = DatabaseInitService.get_system_stats(db)
        
        # Добавляем дополнительную статистику
        from models.extended_models import Property, Rental, Task, RoomOrder
        
        stats["modules"] = {
            "properties": db.query(Property).count(),
            "active_rentals": db.query(Rental).filter(Rental.is_active == True).count(),
            "pending_tasks": db.query(Task).filter(Task.status == "pending").count(),
            "pending_orders": db.query(RoomOrder).filter(RoomOrder.status == "pending").count()
        }
        
        return stats


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