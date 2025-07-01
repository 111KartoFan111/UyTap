# backend/routers/payroll.py
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
import uuid

from models.database import get_db
from models.extended_models import Payroll, PayrollType, User, Task, TaskStatus
from schemas.payroll import PayrollCreate, PayrollUpdate, PayrollResponse
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from typing import List, Optional
from models.database import get_db
from schemas.payroll import PayrollCreate, PayrollUpdate, PayrollResponse
from models.extended_models import Payroll, PayrollType
from models.models import User, UserRole
from utils.dependencies import get_current_active_user


router = APIRouter(prefix="/api/payroll", tags=["Payroll"])


@router.get("", response_model=List[PayrollResponse])
async def get_payrolls(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[str] = None,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
    is_paid: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список зарплатных ведомостей"""
    
    # Проверяем права доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        # Обычные сотрудники видят только свои ведомости
        user_id = str(current_user.id)
    
    query = db.query(Payroll).filter(Payroll.organization_id == current_user.organization_id)
    
    # Фильтры
    if user_id:
        query = query.filter(Payroll.user_id == uuid.UUID(user_id))
    if period_start:
        query = query.filter(Payroll.period_start >= period_start)
    if period_end:
        query = query.filter(Payroll.period_end <= period_end)
    if is_paid is not None:
        query = query.filter(Payroll.is_paid == is_paid)
    
    payrolls = query.order_by(desc(Payroll.period_start)).offset(skip).limit(limit).all()
    
    return payrolls


@router.post("", response_model=PayrollResponse)
async def create_payroll(
    payroll_data: PayrollCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать зарплатную ведомость"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create payroll records"
        )
    
    # Проверяем существование пользователя
    user = db.query(User).filter(
        and_(
            User.id == uuid.UUID(payroll_data.user_id),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Проверяем, нет ли уже ведомости за этот период
    existing_payroll = db.query(Payroll).filter(
        and_(
            Payroll.user_id == user.id,
            Payroll.period_start == payroll_data.period_start,
            Payroll.period_end == payroll_data.period_end
        )
    ).first()
    
    if existing_payroll:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payroll record for this period already exists"
        )
    
    # Рассчитываем суммы
    gross_amount = (
        (payroll_data.base_rate or 0) +
        payroll_data.tasks_payment +
        payroll_data.bonus +
        payroll_data.tips +
        payroll_data.other_income
    )
    
    net_amount = gross_amount - payroll_data.deductions - payroll_data.taxes
    
    # Создаем ведомость
    payroll = Payroll(
        id=uuid.uuid4(),
        organization_id=current_user.organization_id,
        user_id=user.id,
        **payroll_data.dict(),
        gross_amount=gross_amount,
        net_amount=net_amount
    )
    
    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="payroll_created",
        organization_id=current_user.organization_id,
        resource_type="payroll",
        resource_id=payroll.id,
        details={
            "employee_name": f"{user.first_name} {user.last_name}",
            "period": f"{payroll_data.period_start} - {payroll_data.period_end}",
            "gross_amount": gross_amount,
            "net_amount": net_amount
        }
    )
    
    return payroll


@router.get("/{payroll_id}", response_model=PayrollResponse)
async def get_payroll(
    payroll_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить зарплатную ведомость"""
    
    payroll = db.query(Payroll).filter(
        and_(
            Payroll.id == payroll_id,
            Payroll.organization_id == current_user.organization_id
        )
    ).first()
    
    if not payroll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll record not found"
        )
    
    # Проверяем права доступа
    if (current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER] 
        and payroll.user_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return payroll


@router.put("/{payroll_id}", response_model=PayrollResponse)
async def update_payroll(
    payroll_id: uuid.UUID,
    payroll_data: PayrollUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить зарплатную ведомость"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update payroll records"
        )
    
    payroll = db.query(Payroll).filter(
        and_(
            Payroll.id == payroll_id,
            Payroll.organization_id == current_user.organization_id
        )
    ).first()
    
    if not payroll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll record not found"
        )
    
    if payroll.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update paid payroll record"
        )
    
    # Обновляем поля
    update_data = payroll_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payroll, field, value)
    
    # Пересчитываем суммы
    payroll.gross_amount = (
        (payroll.base_rate or 0) +
        payroll.tasks_payment +
        payroll.bonus +
        payroll.tips +
        payroll.other_income
    )
    
    payroll.net_amount = payroll.gross_amount - payroll.deductions - payroll.taxes
    payroll.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(payroll)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="payroll_updated",
        organization_id=current_user.organization_id,
        resource_type="payroll",
        resource_id=payroll.id,
        details={"updated_fields": list(update_data.keys())}
    )
    
    return payroll


@router.post("/{payroll_id}/pay")
async def mark_payroll_paid(
    payroll_id: uuid.UUID,
    payment_method: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отметить зарплату как выплаченную"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to mark payroll as paid"
        )
    
    payroll = db.query(Payroll).filter(
        and_(
            Payroll.id == payroll_id,
            Payroll.organization_id == current_user.organization_id
        )
    ).first()
    
    if not payroll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll record not found"
        )
    
    if payroll.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payroll is already marked as paid"
        )
    
    # Отмечаем как выплаченную
    payroll.is_paid = True
    payroll.paid_at = datetime.now(timezone.utc)
    payroll.payment_method = payment_method
    payroll.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="payroll_paid",
        organization_id=current_user.organization_id,
        resource_type="payroll",
        resource_id=payroll.id,
        details={
            "payment_method": payment_method,
            "amount": payroll.net_amount
        }
    )
    
    return {"message": "Payroll marked as paid", "paid_at": payroll.paid_at}


@router.post("/calculate-monthly")
async def calculate_monthly_payroll(
    year: int = Query(..., ge=2020, le=2030),
    month: int = Query(..., ge=1, le=12),
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Рассчитать зарплату за месяц"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to calculate payroll"
        )
    
    # Определяем период
    period_start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    else:
        period_end = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    
    # Определяем пользователей для расчета
    query = db.query(User).filter(User.organization_id == current_user.organization_id)
    
    if user_id:
        query = query.filter(User.id == uuid.UUID(user_id))
    
    users = query.all()
    
    results = {
        "calculated": [],
        "errors": [],
        "period_start": period_start,
        "period_end": period_end
    }
    
    for user in users:
        try:
            # Проверяем, нет ли уже расчета за этот период
            existing_payroll = db.query(Payroll).filter(
                and_(
                    Payroll.user_id == user.id,
                    Payroll.period_start == period_start,
                    Payroll.period_end == period_end
                )
            ).first()
            
            if existing_payroll:
                results["errors"].append({
                    "user_id": str(user.id),
                    "user_name": f"{user.first_name} {user.last_name}",
                    "error": "Payroll already calculated for this period"
                })
                continue
            
            # Рассчитываем зарплату на основе выполненных задач
            completed_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == user.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= period_start,
                    Task.completed_at <= period_end,
                    Task.is_paid == True
                )
            ).all()
            
            tasks_payment = sum(task.payment_amount or 0 for task in completed_tasks)
            tasks_count = len(completed_tasks)
            
            # Базовая ставка в зависимости от роли
            base_rates = {
                UserRole.ADMIN: 500000,
                UserRole.MANAGER: 400000,
                UserRole.ACCOUNTANT: 350000,
                UserRole.TECHNICAL_STAFF: 300000,
                UserRole.CLEANER: 250000,
                UserRole.STOREKEEPER: 280000
            }
            
            base_rate = base_rates.get(user.role, 200000)
            
            # Определяем тип зарплаты
            if user.role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF]:
                payroll_type = PayrollType.PIECE_WORK
            else:
                payroll_type = PayrollType.MONTHLY_SALARY
            
            # Рассчитываем общую сумму
            gross_amount = base_rate + tasks_payment
            
            # Примерные налоги (10% подоходный + 10% социальные взносы)
            taxes = gross_amount * 0.1
            social_tax = gross_amount * 0.1
            
            net_amount = gross_amount - taxes - social_tax
            
            # Создаем запись о зарплате
            payroll = Payroll(
                id=uuid.uuid4(),
                organization_id=current_user.organization_id,
                user_id=user.id,
                period_start=period_start,
                period_end=period_end,
                payroll_type=payroll_type,
                base_rate=base_rate,
                tasks_completed=tasks_count,
                tasks_payment=tasks_payment,
                bonus=0,
                tips=0,
                other_income=0,
                deductions=social_tax,
                taxes=taxes,
                gross_amount=gross_amount,
                net_amount=net_amount
            )
            
            db.add(payroll)
            
            results["calculated"].append({
                "user_id": str(user.id),
                "user_name": f"{user.first_name} {user.last_name}",
                "role": user.role.value,
                "base_rate": base_rate,
                "tasks_completed": tasks_count,
                "tasks_payment": tasks_payment,
                "gross_amount": gross_amount,
                "net_amount": net_amount
            })
            
        except Exception as e:
            results["errors"].append({
                "user_id": str(user.id),
                "user_name": f"{user.first_name} {user.last_name}",
                "error": str(e)
            })
    
    if results["calculated"]:
        db.commit()
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="monthly_payroll_calculated",
        organization_id=current_user.organization_id,
        details={
            "period": f"{year}-{month:02d}",
            "calculated_count": len(results["calculated"]),
            "errors_count": len(results["errors"])
        }
    )
    
    return results


@router.get("/statistics/overview")
async def get_payroll_statistics(
    year: int = Query(..., ge=2020, le=2030),
    month: Optional[int] = Query(None, ge=1, le=12),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по зарплате"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view payroll statistics"
        )
    
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
    
    # Рассчитываем статистику
    total_gross = sum(p.gross_amount for p in payrolls)
    total_net = sum(p.net_amount for p in payrolls)
    total_taxes = sum(p.taxes for p in payrolls)
    total_deductions = sum(p.deductions for p in payrolls)
    
    paid_payrolls = [p for p in payrolls if p.is_paid]
    unpaid_payrolls = [p for p in payrolls if not p.is_paid]
    
    total_paid = sum(p.net_amount for p in paid_payrolls)
    total_unpaid = sum(p.net_amount for p in unpaid_payrolls)
    
    # Статистика по ролям
    role_stats = {}
    for payroll in payrolls:
        role = payroll.user.role.value if payroll.user else "unknown"
        if role not in role_stats:
            role_stats[role] = {
                "count": 0,
                "total_gross": 0,
                "total_net": 0,
                "avg_gross": 0,
                "avg_net": 0
            }
        
        role_stats[role]["count"] += 1
        role_stats[role]["total_gross"] += payroll.gross_amount
        role_stats[role]["total_net"] += payroll.net_amount
    
    # Рассчитываем средние значения
    for role in role_stats:
        count = role_stats[role]["count"]
        if count > 0:
            role_stats[role]["avg_gross"] = role_stats[role]["total_gross"] / count
            role_stats[role]["avg_net"] = role_stats[role]["total_net"] / count
    
    return {
        "period": {
            "start": period_start,
            "end": period_end,
            "year": year,
            "month": month
        },
        "summary": {
            "total_employees": len(payrolls),
            "total_gross_amount": total_gross,
            "total_net_amount": total_net,
            "total_taxes": total_taxes,
            "total_deductions": total_deductions,
            "average_gross": total_gross / len(payrolls) if payrolls else 0,
            "average_net": total_net / len(payrolls) if payrolls else 0
        },
        "payment_status": {
            "paid_count": len(paid_payrolls),
            "unpaid_count": len(unpaid_payrolls),
            "total_paid_amount": total_paid,
            "total_unpaid_amount": total_unpaid,
            "payment_completion_rate": len(paid_payrolls) / len(payrolls) * 100 if payrolls else 0
        },
        "by_role": role_stats
    }


@router.get("/export/{format}")
async def export_payroll_data(
    format: str,
    year: int = Query(..., ge=2020, le=2030),
    month: Optional[int] = Query(None, ge=1, le=12),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспорт данных зарплаты"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export payroll data"
        )
    
    if format not in ["xlsx", "csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported formats: xlsx, csv"
        )
    
    # Определяем период
    if month:
        period_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        filename = f"payroll_{year}_{month:02d}.{format}"
    else:
        period_start = datetime(year, 1, 1, tzinfo=timezone.utc)
        period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        filename = f"payroll_{year}.{format}"
    
    # Получаем данные
    payrolls = db.query(Payroll).filter(
        and_(
            Payroll.organization_id == current_user.organization_id,
            Payroll.period_start >= period_start,
            Payroll.period_end <= period_end
        )
    ).order_by(Payroll.period_start, Payroll.user_id).all()
    
    if format == "xlsx":
        from services.reports_service import ReportsService
        excel_data = ReportsService.export_data_to_excel(
            db=db,
            organization_id=current_user.organization_id,
            data_type="payroll",
            start_date=period_start,
            end_date=period_end
        )
        
        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    elif format == "csv":
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Заголовки
        writer.writerow([
            'Сотрудник', 'Период начала', 'Период окончания', 'Тип оплаты',
            'Базовая ставка', 'Часы', 'Задач выполнено', 'К доплате за задачи',
            'Премия', 'Чаевые', 'Другой доход', 'Вычеты', 'Налоги',
            'Брутто', 'Нетто', 'Выплачено'
        ])
        
        # Данные
        for payroll in payrolls:
            writer.writerow([
                f"{payroll.user.first_name} {payroll.user.last_name}" if payroll.user else "",
                payroll.period_start.strftime('%d.%m.%Y'),
                payroll.period_end.strftime('%d.%m.%Y'),
                payroll.payroll_type.value,
                payroll.base_rate or 0,
                payroll.hours_worked,
                payroll.tasks_completed,
                payroll.tasks_payment,
                payroll.bonus,
                payroll.tips,
                payroll.other_income,
                payroll.deductions,
                payroll.taxes,
                payroll.gross_amount,
                payroll.net_amount,
                "Да" if payroll.is_paid else "Нет"
            ])
        
        output.seek(0)
        content = output.getvalue().encode('utf-8-sig')  # BOM для правильного отображения в Excel
        
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )