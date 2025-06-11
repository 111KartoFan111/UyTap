import logging
import logging.config
import os
from datetime import datetime
from typing import Optional


def setup_logging():
    """Настройка логирования"""
    
    # Создаем директорию для логов
    log_dir = os.path.join(os.getcwd(), "logs")
    try:
        os.makedirs(log_dir, exist_ok=True)
        # Проверяем права на запись
        test_file = os.path.join(log_dir, "test.log")
        with open(test_file, 'w') as f:
            f.write("test")
        os.remove(test_file)
        use_file_logging = True
    except (PermissionError, OSError) as e:
        print(f"⚠️  Warning: Cannot write to log directory {log_dir}: {e}")
        print("📝 Using console logging only")
        use_file_logging = False
    
    # Базовая конфигурация логирования
    LOGGING_CONFIG = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "[{asctime}] {levelname} in {name}: {message}",
                "style": "{",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "detailed": {
                "format": "[{asctime}] {levelname} in {name} ({filename}:{lineno}): {message}",
                "style": "{",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": "INFO",
                "formatter": "default",
                "stream": "ext://sys.stdout"
            }
        },
        "loggers": {
            "": {  # root logger
                "level": "INFO",
                "handlers": ["console"]
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"]
            },
            "sqlalchemy.engine": {
                "level": "WARNING",
                "handlers": ["console"]
            }
        }
    }
    
    # Добавляем файловое логирование если возможно
    if use_file_logging:
        LOGGING_CONFIG["handlers"].update({
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "DEBUG",
                "formatter": "detailed",
                "filename": os.path.join(log_dir, "app.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "ERROR",
                "formatter": "detailed",
                "filename": os.path.join(log_dir, "error.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5
            }
        })
        
        # Обновляем обработчики для логгеров
        LOGGING_CONFIG["loggers"][""]["handlers"].extend(["file", "error_file"])
        LOGGING_CONFIG["loggers"]["uvicorn"]["handlers"].append("file")
        LOGGING_CONFIG["loggers"]["sqlalchemy.engine"]["handlers"].append("file")
    
    logging.config.dictConfig(LOGGING_CONFIG)
    logger = logging.getLogger(__name__)
    if use_file_logging:
        logger.info("✅ Logging configured with file support")
    else:
        logger.info("✅ Logging configured (console only)")


def sanitize_string(value: str, max_length: Optional[int] = None) -> str:
    """Очистка строки от потенциально опасных символов"""
    if not value:
        return ""
    
    # Удаляем управляющие символы
    sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', value)
    
    # Обрезаем до максимальной длины
    if max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized.strip()