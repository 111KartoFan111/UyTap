# backend/services/background_service.py
import logging
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import schedule

from models.database import SessionLocal
from services.auth_service import AuthService
from services.task_service import TaskService

logger = logging.getLogger(__name__)


class BackgroundService:
    """Сервис для выполнения фоновых задач"""
    
    _running = False
    _scheduler_thread = None
    
    @classmethod
    def start_scheduled_tasks(cls):
        """Запуск планировщика задач"""
        if cls._running:
            logger.warning("Background service is already running")
            return
        
        cls._running = True
        logger.info("🔄 Starting background service...")
        
        # Настраиваем расписание
        cls._setup_schedule()
        
        # Запускаем планировщик в отдельном потоке
        cls._scheduler_thread = threading.Thread(target=cls._run_scheduler, daemon=True)
        cls._scheduler_thread.start()
        
        logger.info("✅ Background service started")
    
    @classmethod
    def stop_scheduled_tasks(cls):
        """Остановка планировщика задач"""
        cls._running = False
        logger.info("🛑 Background service stopped")
    
    @classmethod
    def _setup_schedule(cls):
        """Настройка расписания задач"""
        
        # Очистка истекших токенов (каждый час)
        schedule.every().hour.do(cls._cleanup_expired_tokens)
        
        # Создание регулярных задач (каждый день в 06:00)
        schedule.every().day.at("06:00").do(cls._create_daily_tasks)
        
        # Очистка старых логов (каждую неделю в воскресенье в 02:00)
        schedule.every().sunday.at("02:00").do(cls._cleanup_old_logs)
        
        # Проверка просроченных задач (каждые 30 минут)
        schedule.every(30).minutes.do(cls._check_overdue_tasks)
        
        # Обновление статистики (каждые 6 часов)
        schedule.every(6).hours.do(cls._update_statistics)
        
        logger.info("📅 Scheduled tasks configured")
    
    @classmethod
    def _run_scheduler(cls):
        """Основной цикл планировщика"""
        while cls._running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Проверяем каждую минуту
            except Exception as e:
                logger.error(f"Error in scheduler: {e}")
                time.sleep(60)
    
    @classmethod
    def _cleanup_expired_tokens(cls):
        """Очистка истекших токенов"""
        try:
            with SessionLocal() as db:
                deleted_count = AuthService.cleanup_expired_tokens(db)
                logger.info(f"🧹 Cleaned up {deleted_count} expired tokens")
        except Exception as e:
            logger.error(f"Error cleaning up tokens: {e}")
    
    @classmethod
    def _create_daily_tasks(cls):
        """Создание ежедневных задач"""
        try:
            with SessionLocal() as db:
                # Получаем все организации
                from models.models import Organization
                organizations = db.query(Organization).all()
                
                total_tasks = 0
                for org in organizations:
                    tasks = TaskService.create_recurring_tasks(db, org.id)
                    total_tasks += len(tasks)
                
                logger.info(f"📋 Created {total_tasks} daily recurring tasks")
        except Exception as e:
            logger.error(f"Error creating daily tasks: {e}")
    
    @classmethod
    def _cleanup_old_logs(cls):
        """Очистка старых логов"""
        try:
            with SessionLocal() as db:
                from services.init_service import DatabaseInitService
                cleanup_result = DatabaseInitService.cleanup_old_data(db)
                logger.info(f"🧹 Weekly cleanup completed: {cleanup_result}")
        except Exception as e:
            logger.error(f"Error during weekly cleanup: {e}")
    
    @classmethod
    def _check_overdue_tasks(cls):
        """Проверка просроченных задач"""
        try:
            with SessionLocal() as db:
                from models.extended_models import Task, TaskStatus
                from sqlalchemy import and_
                
                # Найти просроченные задачи
                now = datetime.now(timezone.utc)
                overdue_tasks = db.query(Task).filter(
                    and_(
                        Task.due_date < now,
                        Task.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
                    )
                ).all()
                
                if overdue_tasks:
                    logger.warning(f"⚠️ Found {len(overdue_tasks)} overdue tasks")
                    
                    # Можно добавить логику для уведомлений или эскалации
                    for task in overdue_tasks:
                        logger.warning(f"Overdue task: {task.title} (due: {task.due_date})")
                
        except Exception as e:
            logger.error(f"Error checking overdue tasks: {e}")
    
    @classmethod
    def _update_statistics(cls):
        """Обновление кешированной статистики"""
        try:
            with SessionLocal() as db:
                from models.models import Organization
                organizations = db.query(Organization).all()
                
                for org in organizations:
                    # Можно обновлять кешированные метрики
                    # Например, загруженность помещений, финансовые показатели и т.д.
                    pass
                
                logger.info("📊 Statistics updated")
        except Exception as e:
            logger.error(f"Error updating statistics: {e}")
    
    @classmethod
    def execute_task_now(cls, task_name: str) -> Dict[str, Any]:
        """Немедленное выполнение задачи (для тестирования)"""
        try:
            if task_name == "cleanup_tokens":
                cls._cleanup_expired_tokens()
            elif task_name == "create_daily_tasks":
                cls._create_daily_tasks()
            elif task_name == "cleanup_logs":
                cls._cleanup_old_logs()
            elif task_name == "check_overdue":
                cls._check_overdue_tasks()
            elif task_name == "update_stats":
                cls._update_statistics()
            else:
                return {"success": False, "error": f"Unknown task: {task_name}"}
            
            return {"success": True, "message": f"Task '{task_name}' executed successfully"}
            
        except Exception as e:
            logger.error(f"Error executing task {task_name}: {e}")
            return {"success": False, "error": str(e)}
    
    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """Получить статус фонового сервиса"""
        return {
            "running": cls._running,
            "scheduler_thread_alive": cls._scheduler_thread.is_alive() if cls._scheduler_thread else False,
            "scheduled_jobs": len(schedule.jobs),
            "next_run": str(schedule.next_run()) if schedule.jobs else None
        }