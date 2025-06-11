from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import json


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


def serialize_error_detail(error_detail):
    """Безопасная сериализация деталей ошибки"""
    try:
        # Если это уже словарь/список/примитив - возвращаем как есть
        if isinstance(error_detail, (dict, list, str, int, float, bool, type(None))):
            return error_detail
        
        # Если это исключение - преобразуем в строку
        if isinstance(error_detail, Exception):
            return str(error_detail)
        
        # Для других объектов пытаемся сериализовать в JSON
        return json.loads(json.dumps(error_detail, default=str))
    except (TypeError, ValueError):
        # Если не получается сериализовать - возвращаем строковое представление
        return str(error_detail)


def clean_validation_errors(errors):
    """Очистка ошибок валидации от несериализуемых объектов"""
    cleaned_errors = []
    
    for error in errors:
        cleaned_error = {}
        
        for key, value in error.items():
            if key == 'ctx' and isinstance(value, dict):
                # Очищаем контекст от несериализуемых объектов
                cleaned_ctx = {}
                for ctx_key, ctx_value in value.items():
                    cleaned_ctx[ctx_key] = serialize_error_detail(ctx_value)
                cleaned_error[key] = cleaned_ctx
            else:
                cleaned_error[key] = serialize_error_detail(value)
        
        cleaned_errors.append(cleaned_error)
    
    return cleaned_errors


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
    
    # Очищаем ошибки от несериализуемых объектов
    cleaned_errors = clean_validation_errors(exc.errors())
    
    # Создаем понятные сообщения об ошибках
    error_messages = []
    for error in cleaned_errors:
        loc = " -> ".join(str(x) for x in error.get('loc', []))
        msg = error.get('msg', 'Validation error')
        error_messages.append(f"{loc}: {msg}")
    
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "message": "; ".join(error_messages),
            "details": cleaned_errors,
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