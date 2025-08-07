from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
import uuid
import io
import xlsxwriter

from models.database import get_db
from models.extended_models import Task, TaskStatus, TaskType, TaskPriority, Payroll
from models.models import User, UserRole
from utils.dependencies import get_current_active_user

router = APIRouter(prefix="/api/export", tags=["Export Reports"])

@router.get("/tasks")
async def export_tasks_report(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    task_type: Optional[TaskType] = None,
    status: Optional[TaskStatus] = None,
    assigned_to: Optional[str] = None,
    format: str = Query("xlsx", regex="^(xlsx|csv)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспорт отчета по задачам"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export tasks report"
        )
    
    # Базовый запрос
    query = db.query(Task).filter(
        and_(
            Task.organization_id == current_user.organization_id,
            Task.created_at >= start_date,
            Task.created_at <= end_date
        )
    )
    
    # Применяем фильтры
    if task_type:
        query = query.filter(Task.task_type == task_type)
    
    if status:
        query = query.filter(Task.status == status)
    
    if assigned_to:
        query = query.filter(Task.assigned_to == uuid.UUID(assigned_to))
    
    tasks = query.order_by(Task.created_at.desc()).all()
    
    filename = f"tasks_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.{format}"
    
    if format == "xlsx":
        # Создаем Excel файл
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        worksheet = workbook.add_worksheet("Отчет по задачам")
        
        # Стили
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#D7E4BC',
            'border': 1,
            'align': 'center',
            'valign': 'vcenter'
        })
        
        money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
        date_format = workbook.add_format({'num_format': 'dd.mm.yyyy hh:mm'})
        duration_format = workbook.add_format({'num_format': '0" мин"'})
        
        # Заголовки
        headers = [
            'ID задачи', 'Название', 'Тип задачи', 'Приоритет', 'Статус',
            'Помещение', 'Исполнитель', 'Создатель', 'Создано', 'Начато',
            'Завершено', 'Запланированное время', 'Фактическое время',
            'Оплата', 'Тип оплаты', 'Оплачено', 'Рейтинг качества', 'Заметки'
        ]
        
        # Записываем заголовки
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)
        
        # Записываем данные
        for row, task in enumerate(tasks, 1):
            worksheet.write(row, 0, str(task.id))
            worksheet.write(row, 1, task.title)
            worksheet.write(row, 2, task.task_type.value)
            worksheet.write(row, 3, task.priority.value)
            worksheet.write(row, 4, task.status.value)
            worksheet.write(row, 5, task.property.name if task.property else "")
            worksheet.write(row, 6, f"{task.assignee.first_name} {task.assignee.last_name}" if task.assignee else "")
            worksheet.write(row, 7, f"{task.creator.first_name} {task.creator.last_name}" if task.creator else "")
            worksheet.write(row, 8, task.created_at, date_format)
            worksheet.write(row, 9, task.started_at if task.started_at else "", date_format)
            worksheet.write(row, 10, task.completed_at if task.completed_at else "", date_format)
            worksheet.write(row, 11, task.estimated_duration or 0, duration_format)
            worksheet.write(row, 12, task.actual_duration or 0, duration_format)
            worksheet.write(row, 13, task.payment_amount or 0, money_format)
            worksheet.write(row, 14, task.payment_type or "")
            worksheet.write(row, 15, "Да" if task.is_paid else "Нет")
            worksheet.write(row, 16, task.quality_rating or "")
            worksheet.write(row, 17, task.completion_notes or "")
        
        # Автоширина колонок
        worksheet.set_column('A:A', 25)  # ID
        worksheet.set_column('B:B', 30)  # Название
        worksheet.set_column('C:E', 12)  # Тип, Приоритет, Статус
        worksheet.set_column('F:H', 20)  # Помещение, Исполнитель, Создатель
        worksheet.set_column('I:L', 15)  # Даты и время
        worksheet.set_column('M:N', 12)  # Оплата
        worksheet.set_column('O:Q', 10)  # Статусы
        worksheet.set_column('R:R', 40)  # Заметки
        
        # Итоговая строка
        total_row = len(tasks) + 2
        worksheet.write(total_row, 0, "ИТОГО:", header_format)
        worksheet.write(total_row, 13, f"=SUM(N2:N{len(tasks)+1})", money_format)
        
        workbook.close()
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    elif format == "csv":
        import csv
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Заголовки
        writer.writerow([
            'ID задачи', 'Название', 'Тип задачи', 'Приоритет', 'Статус',
            'Помещение', 'Исполнитель', 'Создатель', 'Создано', 'Начато',
            'Завершено', 'Запланированное время (мин)', 'Фактическое время (мин)',
            'Оплата', 'Тип оплаты', 'Оплачено', 'Рейтинг качества', 'Заметки'
        ])
        
        # Данные
        for task in tasks:
            writer.writerow([
                str(task.id),
                task.title,
                task.task_type.value,
                task.priority.value,
                task.status.value,
                task.property.name if task.property else "",
                f"{task.assignee.first_name} {task.assignee.last_name}" if task.assignee else "",
                f"{task.creator.first_name} {task.creator.last_name}" if task.creator else "",
                task.created_at.strftime('%d.%m.%Y %H:%M'),
                task.started_at.strftime('%d.%m.%Y %H:%M') if task.started_at else "",
                task.completed_at.strftime('%d.%m.%Y %H:%M') if task.completed_at else "",
                task.estimated_duration or 0,
                task.actual_duration or 0,
                task.payment_amount or 0,
                task.payment_type or "",
                "Да" if task.is_paid else "Нет",
                task.quality_rating or "",
                task.completion_notes or ""
            ])
        
        output.seek(0)
        content = output.getvalue().encode('utf-8-sig')
        
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


@router.get("/payroll")
async def export_payroll_report(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    user_id: Optional[str] = None,
    is_paid: Optional[bool] = None,
    format: str = Query("xlsx", regex="^(xlsx|csv)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспорт отчета по зарплате с разделением налогов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export payroll report"
        )
    
    # Базовый запрос
    query = db.query(Payroll).filter(
        and_(
            Payroll.organization_id == current_user.organization_id,
            Payroll.period_start >= start_date,
            Payroll.period_end <= end_date
        )
    )
    
    # Применяем фильтры
    if user_id:
        query = query.filter(Payroll.user_id == uuid.UUID(user_id))
    
    if is_paid is not None:
        query = query.filter(Payroll.is_paid == is_paid)
    
    payrolls = query.order_by(Payroll.period_start.desc()).all()
    
    filename = f"payroll_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.{format}"
    
    if format == "xlsx":
        # Создаем Excel файл
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        worksheet = workbook.add_worksheet("Отчет по зарплате")
        
        # Стили
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#D7E4BC',
            'border': 1,
            'align': 'center',
            'valign': 'vcenter'
        })
        
        money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
        date_format = workbook.add_format({'num_format': 'dd.mm.yyyy'})
        percent_format = workbook.add_format({'num_format': '0.00%'})
        
        # Заголовки с разделением налогов
        headers = [
            'Сотрудник', 'Роль', 'Период начала', 'Период окончания', 'Тип оплаты',
            'Базовая ставка', 'Часы работы', 'Задач выполнено', 'Оплата за задачи',
            'Премия', 'Чаевые', 'Другой доход', 'Брутто', 'Подоходный налог (10%)',
            'Социальные взносы (10%)', 'Другие вычеты', 'Нетто', 'Выплачено',
            'Дата выплаты', 'Метод оплаты', 'Заметки'
        ]
        
        # Записываем заголовки
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)
        
        # Записываем данные
        for row, payroll in enumerate(payrolls, 1):
            # Рассчитываем налоги (по 10% от брутто)
            income_tax = payroll.gross_amount * 0.10
            social_tax = payroll.gross_amount * 0.10
            other_deductions = payroll.deductions  # Другие вычеты
            
            worksheet.write(row, 0, f"{payroll.user.first_name} {payroll.user.last_name}" if payroll.user else "")
            worksheet.write(row, 1, payroll.user.role.value if payroll.user else "")
            worksheet.write(row, 2, payroll.period_start, date_format)
            worksheet.write(row, 3, payroll.period_end, date_format)
            worksheet.write(row, 4, payroll.payroll_type.value)
            worksheet.write(row, 5, payroll.base_rate or 0, money_format)
            worksheet.write(row, 6, payroll.hours_worked)
            worksheet.write(row, 7, payroll.tasks_completed)
            worksheet.write(row, 8, payroll.tasks_payment, money_format)
            worksheet.write(row, 9, payroll.bonus, money_format)
            worksheet.write(row, 10, payroll.tips, money_format)
            worksheet.write(row, 11, payroll.other_income, money_format)
            worksheet.write(row, 12, payroll.gross_amount, money_format)
            worksheet.write(row, 13, income_tax, money_format)  # Подоходный налог
            worksheet.write(row, 14, social_tax, money_format)   # Социальные взносы
            worksheet.write(row, 15, other_deductions, money_format)  # Другие вычеты
            worksheet.write(row, 16, payroll.net_amount, money_format)
            worksheet.write(row, 17, "Да" if payroll.is_paid else "Нет")
            worksheet.write(row, 18, payroll.paid_at if payroll.paid_at else "", date_format)
            worksheet.write(row, 19, payroll.payment_method or "")
            worksheet.write(row, 20, payroll.notes or "")
        
        # Автоширина колонок
        worksheet.set_column('A:B', 20)  # Сотрудник, Роль
        worksheet.set_column('C:D', 12)  # Даты
        worksheet.set_column('E:E', 15)  # Тип оплаты
        worksheet.set_column('F:Q', 12)  # Финансовые поля
        worksheet.set_column('R:T', 15)  # Статусы и заметки
        
        # Итоговая строка
        total_row = len(payrolls) + 2
        worksheet.write(total_row, 0, "ИТОГО:", header_format)
        # Брутто
        worksheet.write(total_row, 12, f"=SUM(M2:M{len(payrolls)+1})", money_format)
        # Подоходный налог
        worksheet.write(total_row, 13, f"=SUM(N2:N{len(payrolls)+1})", money_format)
        # Социальные взносы
        worksheet.write(total_row, 14, f"=SUM(O2:O{len(payrolls)+1})", money_format)
        # Другие вычеты
        worksheet.write(total_row, 15, f"=SUM(P2:P{len(payrolls)+1})", money_format)
        # Нетто
        worksheet.write(total_row, 16, f"=SUM(Q2:Q{len(payrolls)+1})", money_format)
        
        workbook.close()
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    elif format == "csv":
        import csv
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Заголовки
        writer.writerow([
            'Сотрудник', 'Роль', 'Период начала', 'Период окончания', 'Тип оплаты',
            'Базовая ставка', 'Часы работы', 'Задач выполнено', 'Оплата за задачи',
            'Премия', 'Чаевые', 'Другой доход', 'Брутто', 'Подоходный налог (10%)',
            'Социальные взносы (10%)', 'Другие вычеты', 'Нетто', 'Выплачено',
            'Дата выплаты', 'Метод оплаты', 'Заметки'
        ])
        
        # Данные
        for payroll in payrolls:
            # Рассчитываем налоги
            income_tax = payroll.gross_amount * 0.10
            social_tax = payroll.gross_amount * 0.10
            other_deductions = payroll.deductions
            
            writer.writerow([
                f"{payroll.user.first_name} {payroll.user.last_name}" if payroll.user else "",
                payroll.user.role.value if payroll.user else "",
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
                payroll.gross_amount,
                income_tax,
                social_tax,
                other_deductions,
                payroll.net_amount,
                "Да" if payroll.is_paid else "Нет",
                payroll.paid_at.strftime('%d.%m.%Y') if payroll.paid_at else "",
                payroll.payment_method or "",
                payroll.notes or ""
            ])
        
        output.seek(0)
        content = output.getvalue().encode('utf-8-sig')
        
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )