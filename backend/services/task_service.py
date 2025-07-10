# backend/services/task_service.py
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
import uuid


from models.extended_models import (
    Task, TaskType, TaskStatus, TaskPriority, Property, User, UserRole, Payroll,PropertyStatus
)
from models.models import UserRole
from schemas.task import TaskCreate, TaskUpdate
from schemas.property import PropertyResponse

class TaskService:
    """Сервис для управления задачами"""
    @staticmethod
    def create_task(
        db: Session,
        task_data: TaskCreate | dict,
        property_id: uuid.UUID,
        created_by: uuid.UUID,
        organization_id: uuid.UUID
    ) -> Task:
        """Создать новую задачу"""

        if isinstance(task_data, dict):
            task_data = TaskCreate(**task_data)

        filtered_data = {
            k: v for k, v in task_data.dict().items()
            if k not in {'assigned_to', 'property_id', 'organization_id', 'created_by', 'id'}
        }

        task = Task(
            id=uuid.uuid4(),
            organization_id=organization_id,
            property_id=property_id,
            created_by=created_by,
            **filtered_data,
            status=TaskStatus.PENDING
        )

        if task_data.assigned_to:
            task.assigned_to = uuid.UUID(str(task_data.assigned_to))
        elif task.task_type == TaskType.CLEANING:
            assigned_cleaner = TaskService.get_least_busy_cleaner(db, organization_id)
            if assigned_cleaner:
                task.assigned_to = assigned_cleaner.id
                task.status = TaskStatus.ASSIGNED

        db.add(task)
        db.commit()
        db.refresh(task)

        return task

    @staticmethod
    def create_cleaning_task(
        db: Session,
        property_id: uuid.UUID,
        created_by: uuid.UUID,
        organization_id: uuid.UUID,
        priority: TaskPriority = TaskPriority.MEDIUM
    ) -> Task:
        """Создать задачу на уборку"""
        
        property_obj = db.query(Property).filter(Property.id == property_id).first()
        
        task_data = TaskCreate(
            title=f"Уборка {property_obj.name if property_obj else 'помещения'}",
            description="Стандартная уборка помещения",
            task_type=TaskType.CLEANING,
            priority=priority,
            estimated_duration=60,  # 1 час по умолчанию
            payment_amount=3000,  # базовая оплата за уборку
            payment_type="fixed"
        )
        
        return TaskService.create_task(
            db=db,
            task_data=task_data,
            property_id=property_id,
            created_by=created_by,
            organization_id=organization_id
        )
    
    @staticmethod
    def create_maintenance_task(
        db: Session,
        property_id: uuid.UUID,
        created_by: uuid.UUID,
        organization_id: uuid.UUID,
        priority: TaskPriority = TaskPriority.HIGH
    ) -> Task:
        """Создать задачу на обслуживание"""
        
        property_obj = db.query(Property).filter(Property.id == property_id).first()
        
        task_data = TaskCreate(
            title=f"Техническое обслуживание {property_obj.name if property_obj else 'помещения'}",
            description="Техническое обслуживание и проверка состояния",
            task_type=TaskType.MAINTENANCE,
            priority=priority,
            estimated_duration=120,  # 2 часа по умолчанию
            payment_amount=5000,  # базовая оплата за обслуживание
            payment_type="fixed"
        )
        
        return TaskService.create_task(
            db=db,
            task_data=task_data,
            property_id=property_id,
            created_by=created_by,
            organization_id=organization_id
        )
    
    @staticmethod
    def get_least_busy_cleaner(db: Session, organization_id: uuid.UUID) -> Optional[User]:
        """Найти уборщика с наименьшей загрузкой"""
        
        # Получаем всех активных уборщиков организации
        cleaners = db.query(User).filter(
            and_(
                User.organization_id == organization_id,
                User.role == UserRole.CLEANER,
                User.status == "active"
            )
        ).all()
        
        if not cleaners:
            return None
        
        # Считаем активные задачи для каждого уборщика
        cleaner_workload = []
        
        for cleaner in cleaners:
            active_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == cleaner.id,
                    Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
                )
            ).count()
            
            cleaner_workload.append((cleaner, active_tasks))
        
        # Возвращаем уборщика с минимальным количеством активных задач
        return min(cleaner_workload, key=lambda x: x[1])[0]
    
    @staticmethod
    def assign_task(
        db: Session,
        task_id: uuid.UUID,
        assigned_to: uuid.UUID,
        organization_id: uuid.UUID
    ) -> Task:
        """Назначить задачу исполнителю"""
        
        task = db.query(Task).filter(
            and_(
                Task.id == task_id,
                Task.organization_id == organization_id
            )
        ).first()
        
        if not task:
            raise ValueError("Task not found")
        
        # Проверяем, что исполнитель принадлежит той же организации
        assignee = db.query(User).filter(
            and_(
                User.id == assigned_to,
                User.organization_id == organization_id
            )
        ).first()
        
        if not assignee:
            raise ValueError("Assignee not found or not in the same organization")
        
        task.assigned_to = assigned_to
        if task.status == TaskStatus.PENDING:
            task.status = TaskStatus.ASSIGNED
        
        task.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(task)
        
        return task
    
    @staticmethod
    def start_task(
        db: Session,
        task_id: uuid.UUID,
        user_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> Task:
        """Начать выполнение задачи"""
        
        task = db.query(Task).filter(
            and_(
                Task.id == task_id,
                Task.organization_id == organization_id,
                Task.assigned_to == user_id
            )
        ).first()
        
        if not task:
            raise ValueError("Task not found or not assigned to user")
        
        if task.status not in [TaskStatus.ASSIGNED, TaskStatus.PENDING]:
            raise ValueError("Task cannot be started in current status")
        
        task.status = TaskStatus.IN_PROGRESS
        task.started_at = datetime.now(timezone.utc)
        task.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(task)
        
        return task
    
    @staticmethod
    def complete_task(
        db: Session,
        task_id: uuid.UUID,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        completion_notes: Optional[str] = None,
        quality_rating: Optional[int] = None,
        actual_duration: Optional[int] = None
    ) -> Task:
        """Завершить задачу"""
        
        task = db.query(Task).filter(
            and_(
                Task.id == task_id,
                Task.organization_id == organization_id,
                Task.assigned_to == user_id
            )
        ).first()
        
        if not task:
            raise ValueError("Task not found or not assigned to user")
        
        if task.status != TaskStatus.IN_PROGRESS:
            raise ValueError("Task must be in progress to complete")
        
        # Вычисляем фактическую продолжительность если не указана
        if actual_duration is None and task.started_at:
            duration_delta = datetime.now(timezone.utc) - task.started_at
            actual_duration = int(duration_delta.total_seconds() / 60)  # в минутах
        
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc)
        task.completion_notes = completion_notes
        task.quality_rating = quality_rating
        task.actual_duration = actual_duration
        task.updated_at = datetime.now(timezone.utc)
        
        # Обрабатываем оплату задачи
        TaskService._process_task_payment(db, task)
        
        db.commit()
        db.refresh(task)
        
        return task
    
    @staticmethod
    def _process_task_payment(db: Session, task: Task):
        """Обработать оплату за выполненную задачу"""
        
        if task.payment_type == "none" or task.payment_amount <= 0:
            return
        
        # Получаем исполнителя
        assignee = db.query(User).filter(User.id == task.assigned_to).first()
        if not assignee:
            return
        
        # Проверяем тип оплаты исполнителя
        if assignee.role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF]:
            # Для сдельщиков добавляем оплату к текущему периоду
            current_period_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            next_month = current_period_start.replace(month=current_period_start.month + 1)
            current_period_end = next_month - timedelta(seconds=1)
            
            # Ищем существующую запись о зарплате за текущий период
            payroll = db.query(Payroll).filter(
                and_(
                    Payroll.user_id == assignee.id,
                    Payroll.period_start == current_period_start,
                    Payroll.period_end == current_period_end
                )
            ).first()
            
            if not payroll:
                # Создаем новую запись о зарплате
                from models.extended_models import PayrollType
                payroll = Payroll(
                    id=uuid.uuid4(),
                    organization_id=task.organization_id,
                    user_id=assignee.id,
                    period_start=current_period_start,
                    period_end=current_period_end,
                    payroll_type=PayrollType.PIECE_WORK,
                    tasks_completed=0,
                    tasks_payment=0,
                    gross_amount=0,
                    net_amount=0
                )
                db.add(payroll)
            
            # Обновляем данные о выполненных задачах
            payroll.tasks_completed += 1
            payroll.tasks_payment += task.payment_amount
            
            # Пересчитываем общую сумму
            payroll.gross_amount = (
                (payroll.base_rate or 0) + 
                payroll.tasks_payment + 
                payroll.bonus + 
                payroll.tips + 
                payroll.other_income
            )
            payroll.net_amount = payroll.gross_amount - payroll.deductions - payroll.taxes
            payroll.updated_at = datetime.now(timezone.utc)
            
            # Отмечаем задачу как оплаченную
            task.is_paid = True
    
    @staticmethod
    def get_task_statistics(
        db: Session,
        organization_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """Получить статистику по задачам"""
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        query = db.query(Task).filter(
            and_(
                Task.organization_id == organization_id,
                Task.created_at >= start_date
            )
        )
        
        if user_id:
            query = query.filter(Task.assigned_to == user_id)
        
        tasks = query.all()
        
        # Группируем по статусам
        status_counts = {}
        for status in TaskStatus:
            status_counts[status.value] = len([t for t in tasks if t.status == status])
        
        # Группируем по типам
        type_counts = {}
        for task_type in TaskType:
            type_counts[task_type.value] = len([t for t in tasks if t.task_type == task_type])
        
        # Группируем по приоритетам
        priority_counts = {}
        for priority in TaskPriority:
            priority_counts[priority.value] = len([t for t in tasks if t.priority == priority])
        
        # Завершенные задачи
        completed_tasks = [t for t in tasks if t.status == TaskStatus.COMPLETED]
        
        # Средние времена
        avg_completion_time = None
        avg_response_time = None
        
        if completed_tasks:
            completion_times = [
                t.actual_duration for t in completed_tasks 
                if t.actual_duration is not None
            ]
            if completion_times:
                avg_completion_time = sum(completion_times) / len(completion_times)
            
            response_times = [
                (t.started_at - t.created_at).total_seconds() / 3600  # в часах
                for t in completed_tasks 
                if t.started_at is not None
            ]
            if response_times:
                avg_response_time = sum(response_times) / len(response_times)
        
        # Средний рейтинг качества
        avg_quality = None
        quality_ratings = [
            t.quality_rating for t in completed_tasks 
            if t.quality_rating is not None
        ]
        if quality_ratings:
            avg_quality = sum(quality_ratings) / len(quality_ratings)
        
        # Общая оплата
        total_payment = sum(t.payment_amount for t in completed_tasks if t.is_paid)
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": period_days
            },
            "totals": {
                "total_tasks": len(tasks),
                "completed_tasks": len(completed_tasks),
                "completion_rate": (len(completed_tasks) / len(tasks) * 100) if tasks else 0
            },
            "by_status": status_counts,
            "by_type": type_counts,
            "by_priority": priority_counts,
            "performance": {
                "avg_completion_time_minutes": avg_completion_time,
                "avg_response_time_hours": avg_response_time,
                "avg_quality_rating": avg_quality
            },
            "financial": {
                "total_payment": total_payment,
                "avg_payment_per_task": total_payment / len(completed_tasks) if completed_tasks else 0
            }
        }
    
    @staticmethod
    def get_employee_workload(
        db: Session,
        organization_id: uuid.UUID,
        role: Optional[UserRole] = None
    ) -> List[Dict[str, Any]]:
        """Получить загрузку сотрудников по задачам"""
        
        query = db.query(User).filter(User.organization_id == organization_id)
        
        if role:
            query = query.filter(User.role == role)
        
        employees = query.all()
        workload_data = []
        
        for employee in employees:
            # Активные задачи
            active_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == employee.id,
                    Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
                )
            ).count()
            
            # Завершенные задачи за последние 30 дней
            last_month = datetime.now(timezone.utc) - timedelta(days=30)
            completed_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == employee.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= last_month
                )
            ).count()
            
            # Средний рейтинг качества
            avg_quality = db.query(func.avg(Task.quality_rating)).filter(
                and_(
                    Task.assigned_to == employee.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.quality_rating.isnot(None),
                    Task.completed_at >= last_month
                )
            ).scalar()
            
            workload_data.append({
                "user_id": str(employee.id),
                "name": f"{employee.first_name} {employee.last_name}",
                "role": employee.role.value,
                "active_tasks": active_tasks,
                "completed_last_month": completed_tasks,
                "avg_quality_rating": round(avg_quality, 2) if avg_quality else None,
                "workload_status": TaskService._get_workload_status(active_tasks)
            })
        
        return sorted(workload_data, key=lambda x: x["active_tasks"])
    
    @staticmethod
    def _get_workload_status(active_tasks: int) -> str:
        """Определить статус загрузки сотрудника"""
        if active_tasks == 0:
            return "free"
        elif active_tasks <= 3:
            return "low"
        elif active_tasks <= 6:
            return "medium"
        elif active_tasks <= 10:
            return "high"
        else:
            return "overloaded"
    
    @staticmethod
    def get_urgent_tasks(db: Session, organization_id: uuid.UUID) -> List[Task]:
        """Получить срочные задачи"""
        
        return db.query(Task).filter(
            and_(
                Task.organization_id == organization_id,
                Task.priority == TaskPriority.URGENT,
                Task.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
            )
        ).order_by(Task.created_at).all()
    
    @staticmethod
    def reassign_tasks_on_employee_unavailable(
        db: Session,
        unavailable_user_id: uuid.UUID,
        organization_id: uuid.UUID
    ):
        """Перераспределить задачи при недоступности сотрудника"""
        
        # Получаем активные задачи недоступного сотрудника
        active_tasks = db.query(Task).filter(
            and_(
                Task.assigned_to == unavailable_user_id,
                Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
            )
        ).all()
        
        if not active_tasks:
            return
        
        # Группируем задачи по типам
        cleaning_tasks = [t for t in active_tasks if t.task_type == TaskType.CLEANING]
        maintenance_tasks = [t for t in active_tasks if t.task_type == TaskType.MAINTENANCE]
        other_tasks = [t for t in active_tasks if t.task_type not in [TaskType.CLEANING, TaskType.MAINTENANCE]]
        
        # Перераспределяем задачи уборки
        for task in cleaning_tasks:
            new_assignee = TaskService.get_least_busy_cleaner(db, organization_id)
            if new_assignee and new_assignee.id != unavailable_user_id:
                task.assigned_to = new_assignee.id
                task.status = TaskStatus.ASSIGNED
                task.updated_at = datetime.now(timezone.utc)
        
        # Перераспределяем задачи обслуживания
        for task in maintenance_tasks:
            # Находим технического сотрудника с минимальной загрузкой
            tech_staff = db.query(User).filter(
                and_(
                    User.organization_id == organization_id,
                    User.role == UserRole.TECHNICAL_STAFF,
                    User.status == "active",
                    User.id != unavailable_user_id
                )
            ).all()
            
            if tech_staff:
                # Находим наименее загруженного
                staff_workload = []
                for staff in tech_staff:
                    active_count = db.query(Task).filter(
                        and_(
                            Task.assigned_to == staff.id,
                            Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
                        )
                    ).count()
                    staff_workload.append((staff, active_count))
                
                new_assignee = min(staff_workload, key=lambda x: x[1])[0]
                task.assigned_to = new_assignee.id
                task.status = TaskStatus.ASSIGNED
                task.updated_at = datetime.now(timezone.utc)
        
        # Остальные задачи помечаем как неназначенные
        for task in other_tasks:
            task.assigned_to = None
            task.status = TaskStatus.PENDING
            task.updated_at = datetime.now(timezone.utc)
        
        db.commit()
    
    @staticmethod
    def create_recurring_tasks(db: Session, organization_id: uuid.UUID):
        """Создать регулярные задачи (например, ежедневные проверки)"""
        
        # Получаем все активные помещения
        properties = db.query(Property).filter(
            and_(
                Property.organization_id == organization_id,
                Property.is_active == True
            )
        ).all()
        
        tasks_created = []
        
        for prop in properties:
            # Проверяем, нужна ли ежедневная проверка
            last_check = db.query(Task).filter(
                and_(
                    Task.property_id == prop.id,
                    Task.task_type == TaskType.CHECK_IN,
                    Task.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
                )
            ).first()
            
            if not last_check and prop.status in [PropertyStatus.AVAILABLE, PropertyStatus.OCCUPIED]:
                # Создаем задачу ежедневной проверки
                task_data = TaskCreate(
                    title=f"Ежедневная проверка {prop.name}",
                    description="Проверка состояния помещения",
                    task_type=TaskType.CHECK_IN,
                    priority=TaskPriority.LOW,
                    estimated_duration=15,  # 15 минут
                    payment_amount=500,
                    payment_type="fixed"
                )
                
                task = TaskService.create_task(
                    db=db,
                    task_data=task_data,
                    property_id=prop.id,
                    created_by=None,  # Системная задача
                    organization_id=organization_id
                )
                tasks_created.append(task)
        
        return tasks_created