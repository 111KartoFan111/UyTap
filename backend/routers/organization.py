# backend/routers/organization.py
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, func
import uuid

from models.database import get_db
from models.models import Organization, User, UserRole, UserStatus
from models.extended_models import Property, Rental, Client, Task, TaskStatus, RoomOrder
from schemas.admin import UserResponse, UserCreate, UserUpdate
from schemas.auth import UserResponse as AuthUserResponse
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user, require_role

# Создаем роутер для администраторов организации
router = APIRouter(prefix="/api/organization", tags=["Organization Management"])

# Зависимость для проверки прав администратора организации
get_org_admin = require_role(UserRole.ADMIN, UserRole.SYSTEM_OWNER)


@router.get("/info")
async def get_organization_info(
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Получить информацию о своей организации"""
    
    if not current_user.organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    org = current_user.organization
    
    # Дополнительная статистика
    total_users = db.query(User).filter(User.organization_id == org.id).count()
    total_properties = db.query(Property).filter(Property.organization_id == org.id).count()
    total_clients = db.query(Client).filter(Client.organization_id == org.id).count()
    active_rentals = db.query(Rental).filter(
        and_(
            Rental.organization_id == org.id,
            Rental.is_active == True
        )
    ).count()
    
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "email": org.email,
        "phone": org.phone,
        "website": org.website,
        "address": org.address,
        "city": org.city,
        "country": org.country,
        "status": org.status.value,
        "subscription_plan": org.subscription_plan,
        "max_users": org.max_users,
        "max_properties": org.max_properties,
        "trial_ends_at": org.trial_ends_at,
        "subscription_ends_at": org.subscription_ends_at,
        "created_at": org.created_at,
        "settings": org.settings,
        "statistics": {
            "total_users": total_users,
            "total_properties": total_properties,
            "total_clients": total_clients,
            "active_rentals": active_rentals
        }
    }


@router.get("/users", response_model=List[UserResponse])
async def get_organization_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[UserRole] = None,
    status: Optional[UserStatus] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Получить список сотрудников организации"""
    
    query = db.query(User).filter(User.organization_id == current_user.organization_id)
    
    # Фильтры
    if role:
        # Админ не может видеть system_owner
        if role == UserRole.SYSTEM_OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot access system owners"
            )
        query = query.filter(User.role == role)
    else:
        # По умолчанию исключаем system_owner
        query = query.filter(User.role != UserRole.SYSTEM_OWNER)
    
    if status:
        query = query.filter(User.status == status)
    
    if search:
        query = query.filter(
            User.first_name.ilike(f"%{search}%") |
            User.last_name.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%")
        )
    
    users = query.order_by(desc(User.created_at)).offset(skip).limit(limit).all()
    
    return users


@router.post("/users", response_model=UserResponse)
async def create_organization_user(
    user_data: UserCreate,
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Создать нового сотрудника в организации"""
    
    # Проверяем лимит пользователей
    current_user_count = db.query(User).filter(
        User.organization_id == current_user.organization_id
    ).count()
    
    if current_user_count >= current_user.organization.max_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User limit reached ({current_user.organization.max_users})"
        )
    
    # Проверяем роль - админ не может создавать system_owner или других админов
    if user_data.role in ["system_owner", "admin"]:
        if current_user.role != UserRole.SYSTEM_OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create users with admin or system_owner role"
            )
    
    # Проверяем уникальность email в организации
    existing_user = db.query(User).filter(
        and_(
            User.organization_id == current_user.organization_id,
            User.email == user_data.email
        )
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{user_data.email}' already exists in this organization"
        )
    
    # Создаем пользователя
    user = User(
        id=uuid.uuid4(),
        organization_id=current_user.organization_id,
        email=user_data.email,
        password_hash=AuthService.hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        middle_name=user_data.middle_name,
        phone=user_data.phone,
        role=UserRole(user_data.role),
        status=UserStatus.ACTIVE,  # Админ сразу активирует пользователей
        email_verified=True,
        preferences={}
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="user_created",
        organization_id=current_user.organization_id,
        resource_type="user",
        resource_id=user.id,
        details={
            "created_user_email": user.email,
            "created_user_role": user.role.value,
            "created_user_name": f"{user.first_name} {user.last_name}"
        }
    )
    
    return user


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_organization_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Получить информацию о сотруднике"""
    
    user = db.query(User).filter(
        and_(
            User.id == user_id,
            User.organization_id == current_user.organization_id,
            User.role != UserRole.SYSTEM_OWNER  # Исключаем system_owner
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_organization_user(
    user_id: uuid.UUID,
    user_data: UserUpdate,
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Обновить сотрудника"""
    
    user = db.query(User).filter(
        and_(
            User.id == user_id,
            User.organization_id == current_user.organization_id,
            User.role != UserRole.SYSTEM_OWNER
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Нельзя изменить самого себя на неактивного или понизить роль
    if user.id == current_user.id:
        if user_data.status == UserStatus.INACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate yourself"
            )
        if user_data.role and UserRole(user_data.role) != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change your own role"
            )
    
    # Проверяем роль - админ не может назначать admin или system_owner
    if user_data.role:
        if user_data.role in ["system_owner", "admin"] and current_user.role != UserRole.SYSTEM_OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot assign admin or system_owner role"
            )
    
    # Обновляем только переданные поля
    update_data = user_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "role":
            setattr(user, field, UserRole(value))
        elif field == "status":
            setattr(user, field, UserStatus(value))
        else:
            setattr(user, field, value)
    
    user.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(user)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="user_updated",
        organization_id=current_user.organization_id,
        resource_type="user",
        resource_id=user.id,
        details={"updated_fields": list(update_data.keys())}
    )
    
    return user


@router.delete("/users/{user_id}")
async def delete_organization_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Удалить сотрудника"""
    
    user = db.query(User).filter(
        and_(
            User.id == user_id,
            User.organization_id == current_user.organization_id,
            User.role != UserRole.SYSTEM_OWNER
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Нельзя удалить самого себя
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    # Проверяем, нет ли активных задач у пользователя
    active_tasks = db.query(Task).filter(
        and_(
            Task.assigned_to == user.id,
            Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
        )
    ).count()
    
    if active_tasks > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete user with {active_tasks} active tasks. Reassign or complete them first."
        )
    
    # Логируем действие перед удалением
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="user_deleted",
        organization_id=current_user.organization_id,
        resource_type="user",
        resource_id=user.id,
        details={
            "deleted_user_email": user.email,
            "deleted_user_role": user.role.value,
            "deleted_user_name": f"{user.first_name} {user.last_name}"
        }
    )
    
    # Удаляем пользователя
    db.delete(user)
    db.commit()
    
    return {"message": f"User '{user.email}' deleted successfully"}


@router.get("/dashboard/statistics")
async def get_dashboard_statistics(
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Получить статистику для дашборда администратора"""
    
    from services.reports_service import ReportsService
    
    # Получаем общую статистику дашборда
    dashboard_stats = ReportsService.generate_dashboard_summary(
        db=db,
        organization_id=current_user.organization_id,
        user_role=current_user.role
    )
    
    # Добавляем специфичную для админа информацию
    today = datetime.now(timezone.utc)
    
    # Статистика по сотрудникам
    staff_stats = {}
    for role in UserRole:
        if role != UserRole.SYSTEM_OWNER:
            count = db.query(User).filter(
                and_(
                    User.organization_id == current_user.organization_id,
                    User.role == role,
                    User.status == UserStatus.ACTIVE
                )
            ).count()
            staff_stats[role.value] = count
    
    # Задачи требующие внимания
    pending_tasks = db.query(Task).filter(
        and_(
            Task.organization_id == current_user.organization_id,
            Task.status == TaskStatus.PENDING
        )
    ).count()
    
    overdue_tasks = db.query(Task).filter(
        and_(
            Task.organization_id == current_user.organization_id,
            Task.due_date < today,
            Task.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
        )
    ).count()
    
    # Заказы требующие внимания
    pending_orders = db.query(RoomOrder).filter(
        and_(
            RoomOrder.organization_id == current_user.organization_id,
            RoomOrder.status == "pending"
        )
    ).count()
    
    # Добавляем админскую информацию
    dashboard_stats["admin_specific"] = {
        "staff_by_role": staff_stats,
        "tasks_attention": {
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks
        },
        "orders_attention": {
            "pending_orders": pending_orders
        },
        "organization_health": {
            "subscription_status": current_user.organization.status.value,
            "user_limit_usage": f"{dashboard_stats['organization_stats']['total_staff']}/{current_user.organization.max_users}",
            "property_limit_usage": f"{dashboard_stats['organization_stats']['total_properties']}/{current_user.organization.max_properties}"
        }
    }
    
    return dashboard_stats


@router.get("/users/{user_id}/performance")
async def get_user_performance(
    user_id: uuid.UUID,
    period_days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Получить статистику производительности сотрудника"""
    
    # Проверяем что пользователь из нашей организации
    user = db.query(User).filter(
        and_(
            User.id == user_id,
            User.organization_id == current_user.organization_id,
            User.role != UserRole.SYSTEM_OWNER
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    from services.task_service import TaskService
    
    # Получаем статистику по задачам пользователя
    task_stats = TaskService.get_task_statistics(
        db=db,
        organization_id=current_user.organization_id,
        user_id=user_id,
        period_days=period_days
    )
    
    # Статистика по зарплате
    from services.reports_service import ReportsService
    from datetime import timedelta
    
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=period_days)
    
    payroll_stats = ReportsService.get_user_payroll(
        db=db,
        user_id=user_id,
        period_start=start_date,
        period_end=end_date
    )
    
    return {
        "user_info": {
            "id": str(user.id),
            "name": f"{user.first_name} {user.last_name}",
            "role": user.role.value,
            "email": user.email,
            "phone": user.phone,
            "status": user.status.value
        },
        "performance_period": {
            "days": period_days,
            "start_date": start_date,
            "end_date": end_date
        },
        "task_performance": task_stats,
        "payroll_info": payroll_stats
    }


@router.get("/users/roles/available")
async def get_available_roles(
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Получить список доступных ролей для назначения"""
    
    # Администратор может назначать все роли кроме system_owner и admin
    available_roles = []
    
    for role in UserRole:
        if role == UserRole.SYSTEM_OWNER:
            continue  # Всегда исключаем
        
        if role == UserRole.ADMIN and current_user.role != UserRole.SYSTEM_OWNER:
            continue  # Только system_owner может назначать админов
        
        available_roles.append({
            "value": role.value,
            "label": role.value.replace("_", " ").title(),
            "description": _get_role_description(role)
        })
    
    return {"available_roles": available_roles}


def _get_role_description(role: UserRole) -> str:
    """Получить описание роли"""
    descriptions = {
        UserRole.ADMIN: "Администратор организации - полный доступ к управлению",
        UserRole.MANAGER: "Менеджер - управление арендой, клиентами, отчеты",
        UserRole.TECHNICAL_STAFF: "Технический персонал - обслуживание помещений",
        UserRole.ACCOUNTANT: "Бухгалтер - финансы, отчеты, зарплата",
        UserRole.CLEANER: "Уборщик - выполнение задач по уборке",
        UserRole.STOREKEEPER: "Кладовщик - управление складом и материалами"
    }
    return descriptions.get(role, "")


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: uuid.UUID,
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Сбросить пароль сотрудника"""
    
    user = db.query(User).filter(
        and_(
            User.id == user_id,
            User.organization_id == current_user.organization_id,
            User.role != UserRole.SYSTEM_OWNER
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Генерируем новый временный пароль
    from utils.security import generate_password
    new_password = generate_password(12)
    
    # Обновляем пароль
    user.password_hash = AuthService.hash_password(new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="password_reset",
        organization_id=current_user.organization_id,
        resource_type="user",
        resource_id=user.id,
        details={"target_user": user.email}
    )
    
    return {
        "message": "Password reset successfully",
        "new_password": new_password,
        "warning": "Please share this password securely with the user and ask them to change it on first login"
    }


@router.get("/audit/recent-actions")
async def get_recent_audit_actions(
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_org_admin),
    db: Session = Depends(get_db)
):
    """Получить последние действия в организации"""
    
    from models.models import UserAction
    
    actions = db.query(UserAction).filter(
        UserAction.organization_id == current_user.organization_id
    ).order_by(desc(UserAction.created_at)).limit(limit).all()
    
    return {
        "recent_actions": [
            {
                "id": str(action.id),
                "user_id": str(action.user_id) if action.user_id else None,
                "user_name": f"{action.user.first_name} {action.user.last_name}" if action.user else "System",
                "action": action.action,
                "resource_type": action.resource_type,
                "resource_id": str(action.resource_id) if action.resource_id else None,
                "success": action.success,
                "details": action.details,
                "created_at": action.created_at,
                "ip_address": action.ip_address
            }
            for action in actions
        ]
    }