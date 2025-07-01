# backend/routers/tasks.py
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, and_, or_
import uuid

from models.database import get_db
from models.extended_models import Task, TaskStatus, TaskType, TaskPriority, Property, User
from schemas.task import TaskCreate, TaskUpdate, TaskResponse
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
from services.task_service import TaskService

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


@router.get("", response_model=List[TaskResponse])
async def get_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[TaskStatus] = None,
    task_type: Optional[TaskType] = None,
    priority: Optional[TaskPriority] = None,
    property_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список задач"""
    
    query = db.query(Task).filter(Task.organization_id == current_user.organization_id)
    
    # Фильтры доступа в зависимости от роли
    if current_user.role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF, UserRole.STOREKEEPER]:
        # Сотрудники видят только свои задачи
        query = query.filter(Task.assigned_to == current_user.id)
    elif current_user.role == UserRole.MANAGER:
        # Менеджеры видят все задачи, но не могут изменять системные
        pass
    
    # Применяем фильтры
    if status:
        query = query.filter(Task.status == status)
    if task_type:
        query = query.filter(Task.task_type == task_type)
    if priority:
        query = query.filter(Task.priority == priority)
    if property_id:
        query = query.filter(Task.property_id == uuid.UUID(property_id))
    if assigned_to and current_user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        query = query.filter(Task.assigned_to == uuid.UUID(assigned_to))
    
    # Подгружаем связанные объекты
    query = query.options(
        selectinload(Task.property),
        selectinload(Task.assignee),
        selectinload(Task.creator)
    )
    
    tasks = query.order_by(desc(Task.created_at)).offset(skip).limit(limit).all()
    
    return tasks


@router.post("", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать новую задачу"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create tasks"
        )
    
    # Проверяем существование помещения если указано
    if task_data.property_id:
        property_obj = db.query(Property).filter(
            and_(
                Property.id == uuid.UUID(task_data.property_id),
                Property.organization_id == current_user.organization_id
            )
        ).first()
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Property not found"
            )
        
        property_id = property_obj.id
    else:
        property_id = None
    
    # Создаем задачу
    task = TaskService.create_task(
        db=db,
        task_data=task_data,
        property_id=property_id,
        created_by=current_user.id,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="task_created",
        organization_id=current_user.organization_id,
        resource_type="task",
        resource_id=task.id,
        details={
            "task_title": task.title,
            "task_type": task.task_type.value,
            "property_id": str(property_id) if property_id else None,
            "assigned_to": str(task.assigned_to) if task.assigned_to else None
        }
    )
    
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о задаче"""
    
    task = db.query(Task).filter(
        and_(
            Task.id == task_id,
            Task.organization_id == current_user.organization_id
        )
    ).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Проверяем права доступа
    if (current_user.role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF, UserRole.STOREKEEPER] 
        and task.assigned_to != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    task_data: TaskUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить задачу"""
    
    task = db.query(Task).filter(
        and_(
            Task.id == task_id,
            Task.organization_id == current_user.organization_id
        )
    ).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Проверяем права на обновление
    can_update = (
        current_user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER] or
        (task.assigned_to == current_user.id and task_data.status in [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED])
    )
    
    if not can_update:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update this task"
        )
    
    # Обновляем задачу
    update_data = task_data.dict(exclude_unset=True)
    old_status = task.status
    
    for field, value in update_data.items():
        if field == "assigned_to" and value:
            setattr(task, field, uuid.UUID(value))
        else:
            setattr(task, field, value)
    
    task.updated_at = datetime.now(timezone.utc)
    
    # Обрабатываем изменение статуса
    if 'status' in update_data and task.status != old_status:
        if task.status == TaskStatus.IN_PROGRESS and old_status in [TaskStatus.PENDING, TaskStatus.ASSIGNED]:
            task.started_at = datetime.now(timezone.utc)
        elif task.status == TaskStatus.COMPLETED and old_status == TaskStatus.IN_PROGRESS:
            task.completed_at = datetime.now(timezone.utc)
            # Обрабатываем оплату
            TaskService._process_task_payment(db, task)
    
    db.commit()
    db.refresh(task)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="task_updated",
        organization_id=current_user.organization_id,
        resource_type="task",
        resource_id=task.id,
        details={
            "updated_fields": list(update_data.keys()),
            "old_status": old_status.value if old_status else None,
            "new_status": task.status.value
        }
    )
    
    return task


@router.post("/{task_id}/assign")
async def assign_task(
    task_id: uuid.UUID,
    assigned_to: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Назначить задачу исполнителю"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to assign tasks"
        )
    
    # Назначаем задачу
    task = TaskService.assign_task(
        db=db,
        task_id=task_id,
        assigned_to=uuid.UUID(assigned_to),
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="task_assigned",
        organization_id=current_user.organization_id,
        resource_type="task",
        resource_id=task.id,
        details={
            "assigned_to": assigned_to,
            "task_title": task.title
        }
    )
    
    return {"message": "Task assigned successfully", "assigned_to": assigned_to}


@router.post("/{task_id}/start")
async def start_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Начать выполнение задачи"""
    
    task = TaskService.start_task(
        db=db,
        task_id=task_id,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="task_started",
        organization_id=current_user.organization_id,
        resource_type="task",
        resource_id=task.id,
        details={"task_title": task.title}
    )
    
    return {"message": "Task started successfully", "started_at": task.started_at}


@router.post("/{task_id}/complete")
async def complete_task(
    task_id: uuid.UUID,
    completion_notes: Optional[str] = None,
    quality_rating: Optional[int] = Query(None, ge=1, le=5),
    actual_duration: Optional[int] = Query(None, ge=1),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Завершить задачу"""
    
    task = TaskService.complete_task(
        db=db,
        task_id=task_id,
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        completion_notes=completion_notes,
        quality_rating=quality_rating,
        actual_duration=actual_duration
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="task_completed",
        organization_id=current_user.organization_id,
        resource_type="task",
        resource_id=task.id,
        details={
            "task_title": task.title,
            "actual_duration": actual_duration,
            "quality_rating": quality_rating
        }
    )
    
    return {"message": "Task completed successfully", "completed_at": task.completed_at}


@router.delete("/{task_id}")
async def cancel_task(
    task_id: uuid.UUID,
    reason: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отменить задачу"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to cancel tasks"
        )
    
    task = db.query(Task).filter(
        and_(
            Task.id == task_id,
            Task.organization_id == current_user.organization_id
        )
    ).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    if task.status == TaskStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel completed task"
        )
    
    # Отменяем задачу
    task.status = TaskStatus.CANCELLED
    task.completion_notes = f"Отменено: {reason}"
    task.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="task_cancelled",
        organization_id=current_user.organization_id,
        resource_type="task",
        resource_id=task.id,
        details={
            "task_title": task.title,
            "cancellation_reason": reason
        }
    )
    
    return {"message": "Task cancelled successfully"}


@router.get("/my/assigned", response_model=List[TaskResponse])
async def get_my_assigned_tasks(
    status: Optional[TaskStatus] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить свои назначенные задачи"""
    
    query = db.query(Task).filter(
        and_(
            Task.assigned_to == current_user.id,
            Task.organization_id == current_user.organization_id
        )
    )
    
    if status:
        query = query.filter(Task.status == status)
    
    tasks = query.order_by(Task.priority.desc(), Task.created_at).all()
    
    return tasks


@router.get("/statistics/overview")
async def get_tasks_statistics(
    period_days: int = Query(30, ge=1, le=365),
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по задачам"""
    
    # Проверяем права на просмотр статистики других пользователей
    if user_id and current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        if uuid.UUID(user_id) != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only view your own statistics"
            )
    
    target_user_id = uuid.UUID(user_id) if user_id else None
    
    stats = TaskService.get_task_statistics(
        db=db,
        organization_id=current_user.organization_id,
        user_id=target_user_id,
        period_days=period_days
    )
    
    return stats


@router.get("/workload/employees")
async def get_employees_workload(
    role: Optional[UserRole] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить загрузку сотрудников"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view employee workload"
        )
    
    workload = TaskService.get_employee_workload(
        db=db,
        organization_id=current_user.organization_id,
        role=role
    )
    
    return workload


@router.get("/urgent", response_model=List[TaskResponse])
async def get_urgent_tasks(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить срочные задачи"""
    
    urgent_tasks = TaskService.get_urgent_tasks(
        db=db,
        organization_id=current_user.organization_id
    )
    
    return urgent_tasks


@router.post("/auto-assign")
async def auto_assign_tasks(
    task_ids: List[str],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Автоматически назначить задачи исполнителям"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to auto-assign tasks"
        )
    
    results = {
        "assigned": [],
        "errors": []
    }
    
    for task_id_str in task_ids:
        try:
            task_id = uuid.UUID(task_id_str)
            task = db.query(Task).filter(
                and_(
                    Task.id == task_id,
                    Task.organization_id == current_user.organization_id
                )
            ).first()
            
            if not task:
                results["errors"].append({
                    "task_id": task_id_str,
                    "error": "Task not found"
                })
                continue
            
            if task.assigned_to:
                results["errors"].append({
                    "task_id": task_id_str,
                    "error": "Task already assigned"
                })
                continue
            
            # Автоназначение в зависимости от типа задачи
            if task.task_type == TaskType.CLEANING:
                assignee = TaskService.get_least_busy_cleaner(db, current_user.organization_id)
            elif task.task_type == TaskType.MAINTENANCE:
                # Находим наименее загруженного технического сотрудника
                tech_staff = db.query(User).filter(
                    and_(
                        User.organization_id == current_user.organization_id,
                        User.role == UserRole.TECHNICAL_STAFF,
                        User.status == "active"
                    )
                ).all()
                
                if tech_staff:
                    # Выбираем наименее загруженного
                    staff_workload = []
                    for staff in tech_staff:
                        active_tasks = db.query(Task).filter(
                            and_(
                                Task.assigned_to == staff.id,
                                Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
                            )
                        ).count()
                        staff_workload.append((staff, active_tasks))
                    
                    assignee = min(staff_workload, key=lambda x: x[1])[0] if staff_workload else None
                else:
                    assignee = None
            else:
                assignee = None
            
            if assignee:
                task.assigned_to = assignee.id
                task.status = TaskStatus.ASSIGNED
                task.updated_at = datetime.now(timezone.utc)
                
                results["assigned"].append({
                    "task_id": task_id_str,
                    "assigned_to": str(assignee.id),
                    "assignee_name": f"{assignee.first_name} {assignee.last_name}"
                })
            else:
                results["errors"].append({
                    "task_id": task_id_str,
                    "error": "No suitable assignee found"
                })
                
        except Exception as e:
            results["errors"].append({
                "task_id": task_id_str,
                "error": str(e)
            })
    
    if results["assigned"]:
        db.commit()
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="tasks_auto_assigned",
        organization_id=current_user.organization_id,
        details={
            "total_tasks": len(task_ids),
            "assigned_count": len(results["assigned"]),
            "errors_count": len(results["errors"])
        }
    )
    
    return results


@router.post("/maintenance/create-recurring")
async def create_recurring_maintenance_tasks(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать регулярные задачи технического обслуживания"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create recurring tasks"
        )
    
    tasks_created = TaskService.create_recurring_tasks(
        db=db,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="recurring_tasks_created",
        organization_id=current_user.organization_id,
        details={"tasks_created": len(tasks_created)}
    )
    
    return {
        "message": f"Created {len(tasks_created)} recurring tasks",
        "tasks_created": len(tasks_created),
        "task_ids": [str(task.id) for task in tasks_created]
    }