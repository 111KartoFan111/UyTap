from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging


logger = logging.getLogger(__name__)


class RentalSystemException(Exception):
    """Базовое исключение для системы аренды"""
    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(RentalSystemException):
    """Ошибка аутентификации"""
    pass


class AuthorizationError(RentalSystemException):
    """Ошибка авторизации"""
    pass


class ValidationError(RentalSystemException):
    """Ошибка валидации"""
    pass


class NotFoundError(RentalSystemException):
    """Ошибка - ресурс не найден"""
    pass


class ConflictError(RentalSystemException):
    """Ошибка конфликта"""
    pass


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Обработчик HTTP исключений"""
    logger.error(f"HTTP {exc.status_code}: {exc.detail}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "success": False,
            "status_code": exc.status_code
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Обработчик ошибок валидации"""
    logger.error(f"Validation error: {exc.errors()}")
    
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "details": exc.errors(),
            "success": False,
            "status_code": 422
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Общий обработчик исключений"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "success": False,
            "status_code": 500
        }
    )
