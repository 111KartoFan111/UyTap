# routers/payroll_extended.py - Дополнительные роуты для работы с зарплатами

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, or_
import uuid

from models.database import get_db
from models.extended_models import User, UserRole
from schemas.payroll_extended import *
from services.payroll_extended_service import PayrollExtendedService
from utils.dependencies import get_current_active_user

router = APIRouter(prefix="/api/payroll", tags=["Enhanced Payroll"])

# ========== ШАБЛОНЫ ЗАРПЛАТ ==========

@router.post("/templates", response_model=PayrollTemplateResponse)
async def create_payroll_template(
    template_data: PayrollTemplateCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать шаблон зарплаты для сотрудника
    
    Позволяет настроить автоматический расчет зарплаты:
    - Базовая ставка
    - Автоматические надбавки (транспорт, питание и т.д.)
    - Настройки сверхурочных
    - Интеграция с задачами
    - Автоматические вычеты
    """
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create payroll templates"
        )
    
    # Проверяем, что пользователь существует в организации
    target_user = db.query(User).filter(
        and_(
            User.id == uuid.UUID(template_data.user_id),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in organization"
        )
    
    # Проверяем, нет ли уже активного шаблона
    existing_template = db.query(PayrollTemplate).filter(
        and_(
            PayrollTemplate.user_id == target_user.id,
            PayrollTemplate.status == PayrollTemplateStatus.ACTIVE,
            or_(
                PayrollTemplate.effective_until.is_(None),
                PayrollTemplate.effective_until > datetime.now(timezone.utc)
            )
        )
    ).first()
    
    if existing_template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has an active payroll template"
        )
    
    template = PayrollExtendedService.create_payroll_template(
        db=db,
        template_data=template_data,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    
    return template

@router.get("/templates", response_model=List[PayrollTemplateResponse])
async def get_payroll_templates(
    user_id: Optional[str] = None,
    status: Optional[PayrollTemplateStatus] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить шаблоны зарплат"""
    
    query = db.query(PayrollTemplate).filter(
        PayrollTemplate.organization_id == current_user.organization_id
    )
    
    if user_id:
        query = query.filter(PayrollTemplate.user_id == uuid.UUID(user_id))
    if status:
        query = query.filter(PayrollTemplate.status == status)
    
    templates = query.order_by(desc(PayrollTemplate.created_at)).all()
    return templates

@router.put("/templates/{template_id}", response_model=PayrollTemplateResponse)
async def update_payroll_template(
    template_id: uuid.UUID,
    template_data: PayrollTemplateUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить шаблон зарплаты"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    template = db.query(PayrollTemplate).filter(
        and_(
            PayrollTemplate.id == template_id,
            PayrollTemplate.organization_id == current_user.organization_id
        )
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Обновляем поля
    update_data = template_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    template.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(template)
    
    return template

@router.delete("/templates/{template_id}")
async def deactivate_payroll_template(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Деактивировать шаблон зарплаты"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    template = db.query(PayrollTemplate).filter(
        and_(
            PayrollTemplate.id == template_id,
            PayrollTemplate.organization_id == current_user.organization_id
        )
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.status = PayrollTemplateStatus.INACTIVE
    template.effective_until = datetime.now(timezone.utc)
    template.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {"message": "Template deactivated successfully"}

# ========== АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ЗАРПЛАТ ==========

@router.post("/auto-generate")
async def auto_generate_payrolls(
    year: int = Query(..., ge=2020, le=2030),
    month: int = Query(..., ge=1, le=12),
    force_recreate: bool = Query(False, description="Пересоздать существующие зарплаты"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Автоматическое создание зарплат на основе шаблонов
    
    Создает зарплатные ведомости для всех сотрудников, у которых есть
    активные шаблоны. Учитывает:
    - Выполненные задачи
    - Автоматические надбавки и вычеты
    - Премии и штрафы
    - Сверхурочные
    """
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    if force_recreate:
        # Удаляем существующие неоплаченные зарплаты за период
        period_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        
        existing_payrolls = db.query(Payroll).filter(
            and_(
                Payroll.organization_id == current_user.organization_id,
                Payroll.period_start == period_start,
                Payroll.period_end == period_end,
                Payroll.is_paid == False
            )
        ).all()
        
        for payroll in existing_payrolls:
            # Сбрасываем операции как неприменённые
            for operation in payroll.operations:
                operation.is_applied = False
                operation.applied_at = None
                operation.payroll_id = None
            db.delete(payroll)
    
    payrolls = PayrollExtendedService.auto_generate_monthly_payrolls(
        db=db,
        organization_id=current_user.organization_id,
        year=year,
        month=month
    )
    
    return {
        "message": f"Generated {len(payrolls)} payroll entries",
        "payrolls_created": len(payrolls),
        "period": f"{year}-{month:02d}",
        "details": [
            {
                "payroll_id": str(p.id),
                "user_name": f"{p.user.first_name} {p.user.last_name}",
                "gross_amount": p.gross_amount,
                "net_amount": p.net_amount
            }
            for p in payrolls
        ]
    }

# ========== ОПЕРАЦИИ С ЗАРПЛАТОЙ ==========

@router.post("/operations", response_model=PayrollOperationResponse)
async def add_payroll_operation(
    operation_data: PayrollOperationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Добавить операцию (премию, штраф, надбавку и т.д.)
    
    Типы операций:
    - BONUS: Премия
    - PENALTY: Штраф
    - OVERTIME: Сверхурочные
    - ALLOWANCE: Надбавка
    - DEDUCTION: Удержание
    - COMMISSION: Комиссионные
    - HOLIDAY_PAY: Праздничная доплата
    - ADVANCE: Аванс
    """
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Проверяем, что пользователь существует
    target_user = db.query(User).filter(
        and_(
            User.id == uuid.UUID(operation_data.user_id),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    operation = PayrollExtendedService.add_payroll_operation(
        db=db,
        operation_data=operation_data,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    
    # Логируем операцию
    from services.auth_service import AuthService
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="payroll_operation_added",
        organization_id=current_user.organization_id,
        resource_type="payroll_operation",
        resource_id=operation.id,
        details={
            "operation_type": operation.operation_type.value,
            "amount": operation.amount,
            "target_user": f"{target_user.first_name} {target_user.last_name}",
            "reason": operation.reason
        }
    )
    
    return operation

@router.get("/operations", response_model=List[PayrollOperationResponse])
async def get_payroll_operations(
    user_id: Optional[str] = None,
    operation_type: Optional[PayrollOperationType] = None,
    is_applied: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить операции с зарплатой"""
    
    query = db.query(PayrollOperation).filter(
        PayrollOperation.organization_id == current_user.organization_id
    )
    
    if user_id:
        query = query.filter(PayrollOperation.user_id == uuid.UUID(user_id))
    if operation_type:
        query = query.filter(PayrollOperation.operation_type == operation_type)
    if is_applied is not None:
        query = query.filter(PayrollOperation.is_applied == is_applied)
    
    operations = query.order_by(desc(PayrollOperation.created_at)).offset(skip).limit(limit).all()
    return operations

@router.delete("/operations/{operation_id}")
async def cancel_payroll_operation(
    operation_id: uuid.UUID,
    reason: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отменить операцию с зарплатой (если ещё не применена)"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    operation = db.query(PayrollOperation).filter(
        and_(
            PayrollOperation.id == operation_id,
            PayrollOperation.organization_id == current_user.organization_id
        )
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    if operation.is_applied:
        raise HTTPException(
            status_code=400, 
            detail="Cannot cancel already applied operation"
        )
    
    # Логируем отмену
    from services.auth_service import AuthService
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="payroll_operation_cancelled",
        organization_id=current_user.organization_id,
        resource_type="payroll_operation",
        resource_id=operation.id,
        details={
            "original_operation": operation.operation_type.value,
            "original_amount": operation.amount,
            "cancellation_reason": reason
        }
    )
    
    db.delete(operation)
    db.commit()
    
    return {"message": "Operation cancelled successfully"}

# ========== БЫСТРЫЕ ОПЕРАЦИИ ==========

@router.post("/users/{user_id}/bonus")
async def add_bonus(
    user_id: str,
    amount: float = Query(..., gt=0),
    reason: str = Query(..., min_length=1),
    apply_to_current_month: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Быстро добавить премию сотруднику"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Определяем период
    now = datetime.now(timezone.utc)
    if apply_to_current_month:
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            period_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(seconds=1)
    else:
        period_start = now
        period_end = now
    
    operation_data = PayrollOperationCreate(
        user_id=user_id,
        operation_type=PayrollOperationType.BONUS,
        amount=amount,
        title=f"Премия: {reason}",
        reason=reason,
        apply_to_period_start=period_start,
        apply_to_period_end=period_end
    )
    
    operation = PayrollExtendedService.add_payroll_operation(
        db=db,
        operation_data=operation_data,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    
    return {"message": f"Bonus of {amount} added successfully", "operation_id": str(operation.id)}

@router.post("/users/{user_id}/penalty")
async def add_penalty(
    user_id: str,
    amount: float = Query(..., gt=0),
    reason: str = Query(..., min_length=1),
    apply_to_current_month: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Быстро добавить штраф сотруднику"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Only admins can add penalties")
    
    # Определяем период
    now = datetime.now(timezone.utc)
    if apply_to_current_month:
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            period_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(seconds=1)
    else:
        period_start = now
        period_end = now
    
    operation_data = PayrollOperationCreate(
        user_id=user_id,
        operation_type=PayrollOperationType.PENALTY,
        amount=-amount,  # Штраф - отрицательная сумма
        title=f"Штраф: {reason}",
        reason=reason,
        apply_to_period_start=period_start,
        apply_to_period_end=period_end
    )
    
    operation = PayrollExtendedService.add_payroll_operation(
        db=db,
        operation_data=operation_data,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    
    return {"message": f"Penalty of {amount} added successfully", "operation_id": str(operation.id)}

@router.post("/users/{user_id}/overtime")
async def add_overtime(
    user_id: str,
    hours: float = Query(..., gt=0, le=100),
    hourly_rate: Optional[float] = Query(None, gt=0),
    description: str = Query("Сверхурочная работа"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Добавить сверхурочные часы"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Получаем шаблон пользователя для определения базовой ставки
    template = db.query(PayrollTemplate).filter(
        and_(
            PayrollTemplate.user_id == uuid.UUID(user_id),
            PayrollTemplate.status == PayrollTemplateStatus.ACTIVE
        )
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="User has no active payroll template")
    
    # Рассчитываем оплату за сверхурочные
    if hourly_rate is None:
        # Рассчитываем часовую ставку из месячного оклада (160 часов в месяц)
        hourly_rate = template.base_rate / 160
    
    overtime_amount = hours * hourly_rate * template.overtime_rate_multiplier
    
    now = datetime.now(timezone.utc)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        period_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    else:
        period_end = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(seconds=1)
    
    operation_data = PayrollOperationCreate(
        user_id=user_id,
        operation_type=PayrollOperationType.OVERTIME,
        amount=overtime_amount,
        title=f"Сверхурочные: {hours} часов",
        description=description,
        apply_to_period_start=period_start,
        apply_to_period_end=period_end,
        metadata={
            "hours": hours,
            "hourly_rate": hourly_rate,
            "multiplier": template.overtime_rate_multiplier
        }
    )
    
    operation = PayrollExtendedService.add_payroll_operation(
        db=db,
        operation_data=operation_data,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    
    return {
        "message": f"Overtime of {hours} hours added successfully",
        "amount": overtime_amount,
        "operation_id": str(operation.id)
    }

# ========== АНАЛИТИКА И ОТЧЕТЫ ==========

@router.get("/summary/{user_id}")
async def get_user_payroll_summary(
    user_id: str,
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить сводку по зарплате пользователя за несколько месяцев"""
    
    # Проверяем права доступа
    if (current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER] 
        and str(current_user.id) != user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Получаем зарплаты за указанный период
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=months * 30)
    
    payrolls = db.query(Payroll).filter(
        and_(
            Payroll.user_id == uuid.UUID(user_id),
            Payroll.organization_id == current_user.organization_id,
            Payroll.period_start >= start_date
        )
    ).order_by(desc(Payroll.period_start)).all()
    
    # Получаем операции
    operations = db.query(PayrollOperation).filter(
        and_(
            PayrollOperation.user_id == uuid.UUID(user_id),
            PayrollOperation.organization_id == current_user.organization_id,
            PayrollOperation.apply_to_period_start >= start_date
        )
    ).order_by(desc(PayrollOperation.created_at)).all()
    
    # Группируем операции по типам
    operations_by_type = {}
    for op in operations:
        op_type = op.operation_type.value
        if op_type not in operations_by_type:
            operations_by_type[op_type] = {"count": 0, "total_amount": 0, "operations": []}
        
        operations_by_type[op_type]["count"] += 1
        operations_by_type[op_type]["total_amount"] += op.amount
        operations_by_type[op_type]["operations"].append({
            "id": str(op.id),
            "title": op.title,
            "amount": op.amount,
            "created_at": op.created_at,
            "is_applied": op.is_applied
        })
    
    # Статистика по зарплатам
    total_gross = sum(p.gross_amount for p in payrolls)
    total_net = sum(p.net_amount for p in payrolls)
    avg_gross = total_gross / len(payrolls) if payrolls else 0
    avg_net = total_net / len(payrolls) if payrolls else 0
    
    return {
        "user_id": user_id,
        "period": {
            "months": months,
            "start_date": start_date,
            "end_date": end_date
        },
        "payroll_summary": {
            "total_payrolls": len(payrolls),
            "total_gross": total_gross,
            "total_net": total_net,
            "average_gross": avg_gross,
            "average_net": avg_net
        },
        "payrolls": [
            {
                "id": str(p.id),
                "period": f"{p.period_start.strftime('%Y-%m')}",
                "gross_amount": p.gross_amount,
                "net_amount": p.net_amount,
                "is_paid": p.is_paid,
                "operations_count": len(p.operations) if p.operations else 0
            }
            for p in payrolls
        ],
        "operations_summary": operations_by_type
    }

# ========== УТИЛИТЫ ==========

@router.post("/recalculate/{payroll_id}")
async def recalculate_payroll(
    payroll_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Пересчитать зарплату с учётом всех операций"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    payroll = db.query(Payroll).filter(
        and_(
            Payroll.id == payroll_id,
            Payroll.organization_id == current_user.organization_id,
            Payroll.is_paid == False
        )
    ).first()
    
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found or already paid")
    
    # Пересчитываем с применением всех операций
    old_net = payroll.net_amount
    
    PayrollExtendedService.recalculate_payroll_with_operations(db, payroll)
    
    return {
        "message": "Payroll recalculated successfully",
        "old_net_amount": old_net,
        "new_net_amount": payroll.net_amount,
        "difference": payroll.net_amount - old_net
    }