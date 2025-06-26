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
from routers import auth
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
    logger.info("🚀 Starting Rental System API...")
    
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
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize database: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Rental System API...")
    
    # Очистка старых данных
    try:
        with SessionLocal() as db:
            cleanup_result = DatabaseInitService.cleanup_old_data(db)
            logger.info(f"🧹 Cleanup completed: {cleanup_result}")
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")


# Создание приложения FastAPI
app = FastAPI(
    title="Rental System API",
    description="""
    🏠 **Система управления арендой недвижимости**
    
    API для управления арендой квартир с поддержкой мультитенантности.
    
    ## Особенности
    
    * 🔐 **Безопасная авторизация** с JWT токенами
    * 🏢 **Мультитенантность** - изоляция данных между организациями
    * 👥 **Система ролей** - от владельца системы до уборщика
    * 📊 **Аудит действий** - полное логирование всех операций
    * 🛡️ **Rate limiting** - защита от злоупотреблений
    
    ## Роли пользователей
    
    * **System Owner** - владелец системы
    * **Admin** - администратор (арендодатель)
    * **Manager** - менеджер
    * **Technical Staff** - технический персонал
    * **Accountant** - бухгалтер
    * **Cleaner** - уборщик
    * **Storekeeper** - кладовщик
    
    ## Авторизация
    
    Используйте Bearer токен в заголовке Authorization:
    ```
    Authorization: Bearer <your_token>
    ```
    """,
    version="1.0.0",
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

# Подключение роутеров
app.include_router(auth.router)

# Корневой endpoint
@app.get("/", tags=["Root"])
async def root():
    """Корневой endpoint API"""
    return {
        "message": "🏠 Rental System API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "status": "🟢 Online"
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
            "timestamp": datetime.now().isoformat()
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
    """Информация о системе"""
    return {
        "name": "Rental System API",
        "version": "1.0.0",
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "debug": os.getenv("DEBUG", "false").lower() == "true"
    }


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