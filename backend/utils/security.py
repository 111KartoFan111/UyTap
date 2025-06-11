import secrets
import string
from typing import Optional
import re


def generate_secure_token(length: int = 32) -> str:
    """Генерация безопасного токена"""
    return secrets.token_urlsafe(length)


def generate_password(length: int = 12) -> str:
    """Генерация безопасного пароля"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    
    # Проверяем, что пароль содержит все необходимые символы
    if (any(c.islower() for c in password) and 
        any(c.isupper() for c in password) and 
        any(c.isdigit() for c in password) and 
        any(c in "!@#$%^&*" for c in password)):
        return password
    else:
        # Рекурсивно генерируем новый пароль
        return generate_password(length)


def validate_password_strength(password: str) -> dict:
    """Проверка силы пароля"""
    result = {
        "valid": False,
        "score": 0,
        "feedback": []
    }
    
    # Минимальная длина
    if len(password) < 8:
        result["feedback"].append("Password must be at least 8 characters long")
    else:
        result["score"] += 1
    
    # Максимальная длина
    if len(password) > 128:
        result["feedback"].append("Password must be no more than 128 characters long")
        return result
    
    # Проверки на наличие разных типов символов
    if not re.search(r'[a-z]', password):
        result["feedback"].append("Password must contain at least one lowercase letter")
    else:
        result["score"] += 1
        
    if not re.search(r'[A-Z]', password):
        result["feedback"].append("Password must contain at least one uppercase letter")
    else:
        result["score"] += 1
        
    if not re.search(r'\d', password):
        result["feedback"].append("Password must contain at least one digit")
    else:
        result["score"] += 1
        
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        result["feedback"].append("Password must contain at least one special character")
    else:
        result["score"] += 1
    
    # Проверка на повторяющиеся символы
    if re.search(r'(.)\1{2,}', password):
        result["feedback"].append("Password should not contain repeated characters")
    else:
        result["score"] += 1
    
    # Общая оценка
    if result["score"] >= 5 and len(result["feedback"]) == 0:
        result["valid"] = True
    
    return result