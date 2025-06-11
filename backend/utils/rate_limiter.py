from datetime import datetime, timedelta
from typing import Dict, Tuple
import threading


class RateLimiter:
    """Простой rate limiter в памяти"""
    
    def __init__(self):
        self.requests: Dict[str, list] = {}
        self.lock = threading.Lock()
    
    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int) -> bool:
        """
        Проверка лимита запросов
        
        Args:
            key: Ключ для идентификации (IP, user_id и т.д.)
            max_requests: Максимальное количество запросов
            window_seconds: Окно времени в секундах
            
        Returns:
            True если запрос разрешен, False если превышен лимит
        """
        with self.lock:
            now = datetime.now()
            cutoff_time = now - timedelta(seconds=window_seconds)
            
            # Инициализируем список для ключа если его нет
            if key not in self.requests:
                self.requests[key] = []
            
            # Удаляем старые запросы
            self.requests[key] = [
                req_time for req_time in self.requests[key] 
                if req_time > cutoff_time
            ]
            
            # Проверяем лимит
            if len(self.requests[key]) >= max_requests:
                return False
            
            # Добавляем текущий запрос
            self.requests[key].append(now)
            return True
    
    def cleanup_old_entries(self, max_age_hours: int = 24):
        """Очистка старых записей"""
        with self.lock:
            cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
            
            keys_to_remove = []
            for key, requests in self.requests.items():
                # Фильтруем старые запросы
                self.requests[key] = [
                    req_time for req_time in requests 
                    if req_time > cutoff_time
                ]
                
                # Помечаем пустые ключи для удаления
                if not self.requests[key]:
                    keys_to_remove.append(key)
            
            # Удаляем пустые ключи
            for key in keys_to_remove:
                del self.requests[key]