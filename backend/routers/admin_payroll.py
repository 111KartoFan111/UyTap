# routers/admin_payroll.py - Админские функции для зарплат

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
import uuid

from models.database import get_db
from models.extended_models import User, UserRole
from schemas.payroll_extended import *
from services.payroll_extended_service import PayrollExtendedService
from utils.dependencies import get_current_active_user, require_role
from schemas.payroll_operation import PayrollOperationCreate, PayrollOperationUpdate, BulkOperationCreate, BulkOperationResponse

from models.payroll_template import PayrollTemplate, PayrollTemplateStatus
from schemas.payroll_template import PayrollTemplateCreate, PayrollTemplateUpdate
from models.payroll_operation import PayrollOperation, PayrollOperationType
from schemas.payroll_operation import PayrollOperationResponse



router = APIRouter(prefix="/api/admin/payroll", tags=["Admin Payroll"])

# Только админы и система
admin_required = require_role([UserRole.ADMIN, UserRole.SYSTEM_OWNER])

# ========== УПРАВЛЕНИЕ ШАБЛОНАМИ ==========

@router.post("/templates/quick-setup")
async def quick_setup_templates_for_organization(
    base_rates: Dict[str, float] = {
        "admin": 500000,
        "manager": 400000,
        "accountant": 350000,
        "technical_staff": 300000,
        "cleaner": 250000,
        "storekeeper": 280000
    },
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Быстрая настройка шаблонов для всех сотрудников организации"""
    
    # Получаем всех сотрудников без активных шаблонов
    users_without_templates = db.query(User).filter(
        and_(
            User.organization_id == current_user.organization_id,
            User.status == "active",
            ~User.id.in_(
                db.query(PayrollTemplate.user_id).filter(
                    and_(
                        PayrollTemplate.organization_id == current_user.organization_id,
                        PayrollTemplate.status == PayrollTemplateStatus.ACTIVE
                    )
                )
            )
        )
    ).all()
    
    templates_created = []
    errors = []
    
    for user in users_without_templates:
        try:
            role_key = user.role.value
            base_rate = base_rates.get(role_key, 200000)  # Базовая ставка по умолчанию
            
            # Определяем тип зарплаты по роли
            if user.role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF]:
                payroll_type = PayrollType.PIECE_WORK
                include_tasks = True
                task_rate = 1000  # Дополнительная оплата за задачу
            else:
                payroll_type = PayrollType.MONTHLY_SALARY
                include_tasks = False
                task_rate = 0
            
            # Автоматические надбавки по ролям
            allowances = {}
            if user.role == UserRole.MANAGER:
                allowances = {"transport": 15000, "communication": 10000}
            elif user.role == UserRole.ACCOUNTANT:
                allowances = {"professional": 20000}
            elif user.role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF]:
                allowances = {"uniform": 5000, "tools": 3000}
            
            template_data = PayrollTemplateCreate(
                user_id=str(user.id),
                name=f"Стандартный {role_key} - {user.first_name} {user.last_name}",
                description=f"Автоматически созданный шаблон для роли {role_key}",
                payroll_type=payroll_type,
                base_rate=base_rate,
                automatic_allowances=allowances,
                include_task_payments=include_tasks,
                task_payment_rate=task_rate,
                calculate_overtime=True,
                overtime_rate_multiplier=1.5,
                tax_rate=0.1,  # 10% подоходный
                social_rate=0.1,  # 10% социальные
                effective_from=datetime.now(timezone.utc)
            )
            
            template = PayrollExtendedService.create_payroll_template(
                db=db,
                template_data=template_data,
                organization_id=current_user.organization_id,
                created_by=current_user.id
            )
            
            templates_created.append({
                "user_id": str(user.id),
                "user_name": f"{user.first_name} {user.last_name}",
                "role": role_key,
                "template_id": str(template.id),
                "base_rate": base_rate
            })
            
        except Exception as e:
            errors.append({
                "user_id": str(user.id),
                "user_name": f"{user.first_name} {user.last_name}",
                "error": str(e)
            })
    
    return {
        "message": f"Created {len(templates_created)} payroll templates",
        "templates_created": templates_created,
        "errors": errors,
        "total_users_processed": len(users_without_templates)
    }


@router.post("/templates/bulk-update")
async def bulk_update_templates(
    updates: Dict[str, Dict[str, Any]],  # user_id -> update_data
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Массовое обновление шаблонов"""
    
    updated = []
    errors = []
    
    for user_id, update_data in updates.items():
        try:
            template = db.query(PayrollTemplate).filter(
                and_(
                    PayrollTemplate.user_id == uuid.UUID(user_id),
                    PayrollTemplate.organization_id == current_user.organization_id,
                    PayrollTemplate.status == PayrollTemplateStatus.ACTIVE
                )
            ).first()
            
            if not template:
                errors.append({
                    "user_id": user_id,
                    "error": "Active template not found"
                })
                continue
            
            # Обновляем поля
            for field, value in update_data.items():
                if hasattr(template, field):
                    setattr(template, field, value)
            
            template.updated_at = datetime.now(timezone.utc)
            
            updated.append({
                "user_id": user_id,
                "template_id": str(template.id),
                "updated_fields": list(update_data.keys())
            })
            
        except Exception as e:
            errors.append({
                "user_id": user_id,
                "error": str(e)
            })
    
    if updated:
        db.commit()
    
    return {
        "updated_count": len(updated),
        "updated_templates": updated,
        "errors": errors
    }


# ========== МАССОВЫЕ ОПЕРАЦИИ ==========

@router.post("/operations/bulk")
async def create_bulk_operations(
    bulk_operation: BulkOperationCreate,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Массовое создание операций для группы сотрудников"""
    
    operations_created = []
    errors = []
    
    # Определяем период
    now = datetime.now(timezone.utc)
    if bulk_operation.apply_to_current_month:
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            period_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(seconds=1)
    else:
        period_start = now
        period_end = now
    
    for user_id in bulk_operation.user_ids:
        try:
            # Проверяем, что пользователь существует в организации
            user = db.query(User).filter(
                and_(
                    User.id == uuid.UUID(user_id),
                    User.organization_id == current_user.organization_id
                )
            ).first()
            
            if not user:
                errors.append({
                    "user_id": user_id,
                    "error": "User not found"
                })
                continue
            
            operation_data = PayrollOperationCreate(
                user_id=user_id,
                operation_type=bulk_operation.operation_type,
                amount=bulk_operation.amount,
                title=bulk_operation.title,
                description=bulk_operation.description,
                reason=bulk_operation.reason,
                apply_to_period_start=period_start,
                apply_to_period_end=period_end,
                is_recurring=bulk_operation.is_recurring
            )
            
            operation = PayrollExtendedService.add_payroll_operation(
                db=db,
                operation_data=operation_data,
                organization_id=current_user.organization_id,
                created_by=current_user.id
            )
            
            operations_created.append(str(operation.id))
            
        except Exception as e:
            errors.append({
                "user_id": user_id,
                "error": str(e)
            })
    
    return BulkOperationResponse(
        operations_created=len(operations_created),
        operations_failed=len(errors),
        created_operations=operations_created,
        errors=errors
    )


@router.post("/operations/seasonal-bonus")
async def create_seasonal_bonus(
    bonus_amount: float = Query(..., gt=0),
    bonus_title: str = Query("Сезонная премия"),
    target_roles: List[UserRole] = Query(default=None),
    exclude_users: List[str] = Query(default=[]),
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Создать сезонную премию для группы сотрудников"""
    
    # Получаем целевых пользователей
    query = db.query(User).filter(
        and_(
            User.organization_id == current_user.organization_id,
            User.status == "active"
        )
    )
    
    if target_roles:
        query = query.filter(User.role.in_(target_roles))
    
    if exclude_users:
        exclude_uuids = [uuid.UUID(uid) for uid in exclude_users]
        query = query.filter(~User.id.in_(exclude_uuids))
    
    target_users = query.all()
    
    # Создаем операции
    bulk_operation = BulkOperationCreate(
        user_ids=[str(user.id) for user in target_users],
        operation_type=PayrollOperationType.BONUS,
        amount=bonus_amount,
        title=bonus_title,
        description=f"Сезонная премия для {len(target_users)} сотрудников",
        apply_to_current_month=True
    )
    
    result = await create_bulk_operations(bulk_operation, current_user, db)
    
    return {
        "bonus_title": bonus_title,
        "bonus_amount": bonus_amount,
        "target_users_count": len(target_users),
        "operations_result": result
    }


# ========== АНАЛИТИКА И ОТЧЕТЫ ==========

@router.get("/analytics/organization-summary")
async def get_organization_payroll_summary(
    year: int = Query(..., ge=2020, le=2030),
    month: Optional[int] = Query(None, ge=1, le=12),
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Получить сводку по зарплатам организации"""
    
    # Определяем период
    if month:
        period_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    else:
        period_start = datetime(year, 1, 1, tzinfo=timezone.utc)
        period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    
    # Получаем все зарплаты за период
    payrolls = db.query(Payroll).filter(
        and_(
            Payroll.organization_id == current_user.organization_id,
            Payroll.period_start >= period_start,
            Payroll.period_end <= period_end
        )
    ).all()
    
    # Общая статистика
    total_employees = db.query(User).filter(
        User.organization_id == current_user.organization_id
    ).count()
    
    employees_with_payroll = len(set(p.user_id for p in payrolls))
    
    total_gross = sum(p.gross_amount for p in payrolls)
    total_net = sum(p.net_amount for p in payrolls)
    total_taxes = sum(p.taxes for p in payrolls)
    
    # Группировка по типам зарплат
    by_payroll_type = {}
    for payroll_type in PayrollType:
        type_payrolls = [p for p in payrolls if p.payroll_type == payroll_type]
        if type_payrolls:
            by_payroll_type[payroll_type.value] = {
                "count": len(type_payrolls),
                "total_gross": sum(p.gross_amount for p in type_payrolls),
                "total_net": sum(p.net_amount for p in type_payrolls),
                "average_net": sum(p.net_amount for p in type_payrolls) / len(type_payrolls)
            }
    
    # Группировка по ролям
    by_role = {}
    for user_role in UserRole:
        role_payrolls = [p for p in payrolls if p.user and p.user.role == user_role]
        if role_payrolls:
            by_role[user_role.value] = {
                "count": len(role_payrolls),
                "total_gross": sum(p.gross_amount for p in role_payrolls),
                "total_net": sum(p.net_amount for p in role_payrolls),
                "average_net": sum(p.net_amount for p in role_payrolls) / len(role_payrolls)
            }
    
    # Статистика по операциям
    operations = db.query(PayrollOperation).filter(
        and_(
            PayrollOperation.organization_id == current_user.organization_id,
            PayrollOperation.apply_to_period_start >= period_start,
            PayrollOperation.apply_to_period_end <= period_end
        )
    ).all()
    
    operations_by_type = {}
    for op_type in PayrollOperationType:
        type_ops = [op for op in operations if op.operation_type == op_type]
        if type_ops:
            operations_by_type[op_type.value] = {
                "count": len(type_ops),
                "total_amount": sum(op.amount for op in type_ops),
                "applied_count": len([op for op in type_ops if op.is_applied])
            }
    
    # Детализация по сотрудникам
    employees_summary = []
    for payroll in payrolls:
        if payroll.user:
            user = payroll.user
            user_operations = [op for op in operations if op.user_id == user.id]
            
            # Проверяем активный шаблон
            has_template = db.query(PayrollTemplate).filter(
                and_(
                    PayrollTemplate.user_id == user.id,
                    PayrollTemplate.status == PayrollTemplateStatus.ACTIVE
                )
            ).first() is not None
            
            employees_summary.append(PayrollSummaryByUser(
                user_id=str(user.id),
                user_name=f"{user.first_name} {user.last_name}",
                role=user.role.value,
                payrolls_count=1,  # За данный период
                total_gross=payroll.gross_amount,
                total_net=payroll.net_amount,
                average_net=payroll.net_amount,
                last_payment_date=payroll.paid_at,
                has_active_template=has_template,
                pending_operations=len([op for op in user_operations if not op.is_applied])
            ))
    
    return PayrollOrganizationSummary(
        organization_id=str(current_user.organization_id),
        period={
            "start": period_start,
            "end": period_end,
            "year": year,
            "month": month
        },
        total_employees=total_employees,
        employees_with_payroll=employees_with_payroll,
        total_gross_amount=total_gross,
        total_net_amount=total_net,
        total_taxes=total_taxes,
        by_payroll_type=by_payroll_type,
        by_role=by_role,
        operations_summary=operations_by_type,
        employees_summary=employees_summary
    )


@router.get("/forecast")
async def get_payroll_forecast(
    months: int = Query(3, ge=1, le=12),
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Получить прогноз расходов на зарплату"""
    
    forecast = PayrollExtendedService.get_payroll_forecast(
        db=db,
        organization_id=current_user.organization_id,
        forecast_months=months
    )
    
    return PayrollForecastResponse(**forecast)


@router.post("/auto-generate/{year}/{month}")
async def auto_generate_monthly_payrolls(
    year: int = Query(..., ge=2020, le=2030),
    month: int = Query(..., ge=1, le=12),
    force_recreate: bool = Query(False),
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Автоматическая генерация зарплат за месяц"""
    
    if force_recreate:
        # Удаляем существующие неоплаченные зарплаты
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
        
        db.commit()
    
    # Генерируем новые зарплаты
    payrolls = PayrollExtendedService.auto_generate_monthly_payrolls(
        db=db,
        organization_id=current_user.organization_id,
        year=year,
        month=month
    )
    
    # Применяем повторяющиеся операции
    PayrollExtendedService.apply_recurring_operations(
        db=db,
        organization_id=current_user.organization_id
    )
    
    # Логируем действие
    from services.auth_service import AuthService
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="auto_generate_payrolls",
        organization_id=current_user.organization_id,
        details={
            "year": year,
            "month": month,
            "payrolls_created": len(payrolls),
            "force_recreate": force_recreate
        }
    )
    
    return {
        "message": f"Generated {len(payrolls)} payroll entries for {year}-{month:02d}",
        "year": year,
        "month": month,
        "payrolls_created": len(payrolls),
        "total_amount": sum(p.net_amount for p in payrolls),
        "payrolls": [
            {
                "payroll_id": str(p.id),
                "user_name": f"{p.user.first_name} {p.user.last_name}" if p.user else "Unknown",
                "gross_amount": p.gross_amount,
                "net_amount": p.net_amount,
                "operations_applied": len(p.operations) if hasattr(p, 'operations') else 0
            }
            for p in payrolls
        ]
    }


# ========== УПРАВЛЕНИЕ НАСТРОЙКАМИ ==========

@router.get("/settings")
async def get_payroll_settings(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Получить настройки зарплатной системы"""
    
    # Получаем настройки из organization.settings
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()
    
    payroll_settings = org.settings.get("payroll", {})
    
    return PayrollSettings(
        auto_generate_monthly=payroll_settings.get("auto_generate_monthly", True),
        auto_apply_operations=payroll_settings.get("auto_apply_operations", True),
        default_tax_rate=payroll_settings.get("default_tax_rate", 0.1),
        default_social_rate=payroll_settings.get("default_social_rate", 0.1),
        overtime_multiplier=payroll_settings.get("overtime_multiplier", 1.5),
        notify_on_payroll_ready=payroll_settings.get("notify_on_payroll_ready", True),
        notify_on_operations=payroll_settings.get("notify_on_operations", True),
        accounting_system_integration=payroll_settings.get("accounting_system_integration", False),
        bank_integration=payroll_settings.get("bank_integration", False)
    )


@router.put("/settings")
async def update_payroll_settings(
    settings_update: PayrollSettingsUpdate,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Обновить настройки зарплатной системы"""
    
    from models.models import Organization
    
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()
    
    # Обновляем настройки
    if "payroll" not in org.settings:
        org.settings["payroll"] = {}
    
    update_data = settings_update.dict(exclude_unset=True)
    org.settings["payroll"].update(update_data)
    
    # Помечаем как изменённое для SQLAlchemy
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(org, 'settings')
    
    db.commit()
    
    return {"message": "Payroll settings updated successfully"}


# ========== ЭКСПОРТ И ОТЧЕТЫ ==========

@router.get("/export/detailed-report")
async def export_detailed_payroll_report(
    year: int = Query(..., ge=2020, le=2030),
    month: Optional[int] = Query(None, ge=1, le=12),
    format: str = Query("excel", regex="^(excel|pdf|json)$"),
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Экспорт детального отчета по зарплатам"""
    
    # Получаем сводку
    summary = await get_organization_payroll_summary(year, month, current_user, db)
    
    if format == "json":
        return summary
    
    elif format == "excel":
        from services.reports_service import ReportsService
        
        # Определяем период
        if month:
            start_date = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
            else:
                end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
            filename = f"payroll_report_{year}_{month:02d}.xlsx"
        else:
            start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
            filename = f"payroll_report_{year}.xlsx"
        
        excel_data = ReportsService.export_data_to_excel(
            db=db,
            organization_id=current_user.organization_id,
            data_type="payroll",
            start_date=start_date,
            end_date=end_date
        )
        
        from fastapi.responses import Response
        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


@router.post("/notify/payroll-ready")
async def notify_payroll_ready(
    year: int,
    month: int,
    user_ids: Optional[List[str]] = None,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Уведомить сотрудников о готовности зарплаты"""
    
    if user_ids:
        target_users = db.query(User).filter(
            and_(
                User.organization_id == current_user.organization_id,
                User.id.in_([uuid.UUID(uid) for uid in user_ids])
            )
        ).all()
    else:
        # Получаем всех, у кого есть зарплата за период
        period_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        
        user_ids_with_payroll = db.query(Payroll.user_id).filter(
            and_(
                Payroll.organization_id == current_user.organization_id,
                Payroll.period_start == period_start,
                Payroll.period_end == period_end
            )
        ).distinct().all()
        
        target_users = db.query(User).filter(
            User.id.in_([uid[0] for uid in user_ids_with_payroll])
        ).all()
    
    # Здесь можно добавить отправку уведомлений
    # Например, через email или push-уведомления
    
    notifications_sent = []
    for user in target_users:
        # Заглушка для отправки уведомления
        notifications_sent.append({
            "user_id": str(user.id),
            "user_name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "notification_sent": True  # В реальности здесь результат отправки
        })
    
    return {
        "message": f"Notifications sent to {len(notifications_sent)} employees",
        "period": f"{year}-{month:02d}",
        "notifications": notifications_sent
    }


# ========== АРХИВИРОВАНИЕ ==========

@router.post("/archive/old-payrolls")
async def archive_old_payrolls(
    months_old: int = Query(24, ge=12, le=60),  # Архивируем зарплаты старше X месяцев
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """Архивировать старые зарплаты"""
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=months_old * 30)
    
    # Находим старые оплаченные зарплаты
    old_payrolls = db.query(Payroll).filter(
        and_(
            Payroll.organization_id == current_user.organization_id,
            Payroll.period_end < cutoff_date,
            Payroll.is_paid == True
        )
    ).all()
    
    archived_count = 0
    
    # В реальности здесь можно перенести данные в архивную таблицу
    # Пока просто добавляем метку архивации
    for payroll in old_payrolls:
        if not payroll.operations_summary:
            payroll.operations_summary = {}
        
        payroll.operations_summary["archived"] = True
        payroll.operations_summary["archived_at"] = datetime.now(timezone.utc).isoformat()
        
        archived_count += 1
    
    db.commit()
    
    return {
        "message": f"Archived {archived_count} old payroll records",
        "cutoff_date": cutoff_date,
        "months_old": months_old
    }