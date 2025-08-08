# backend/routers/reports.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
import uuid
import io
import xlsxwriter
import tempfile
import os

from models.database import get_db
from models.models import User, UserRole
from schemas.reports import (
    FinancialSummaryReport, PropertyOccupancyReport, 
    EmployeePerformanceReport, ClientAnalyticsReport
)
from utils.dependencies import get_current_active_user
from services.auth_service import AuthService
from services.reports_service import ReportsService
from models.extended_models import Payroll,Task,TaskStatus
from models.models import Organization
from sqlalchemy import and_, desc, or_ 

from services.comprehensive_report_service import ComprehensiveReportService
from schemas.comprehensive_report import (
    ComprehensiveReportRequest, ComprehensiveReportResponse,
    AdministrativeExpense, ReportFormat
)



router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/financial-summary", response_model=FinancialSummaryReport)
async def get_financial_summary(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить финансовый отчет"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view financial reports"
        )
    
    report = ReportsService.generate_financial_summary(
        db=db,
        organization_id=current_user.organization_id,
        start_date=start_date,
        end_date=end_date
    )
    
    # Логируем просмотр отчета
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="financial_report_viewed",
        organization_id=current_user.organization_id,
        details={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    
    return report


@router.get("/property-occupancy", response_model=List[PropertyOccupancyReport])
async def get_property_occupancy(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    property_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить отчет по загруженности помещений"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view occupancy reports"
        )
    
    property_uuid = uuid.UUID(property_id) if property_id else None
    
    report = ReportsService.generate_property_occupancy_report(
        db=db,
        organization_id=current_user.organization_id,
        start_date=start_date,
        end_date=end_date,
        property_id=property_uuid
    )
    
    return report


@router.get("/employee-performance", response_model=List[EmployeePerformanceReport])
async def get_employee_performance(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    role: Optional[UserRole] = None,
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить отчет по производительности сотрудников"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view employee reports"
        )
    
    # Если обычный сотрудник запрашивает свою статистику
    if user_id and current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        if uuid.UUID(user_id) != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only view your own performance"
            )
    
    user_uuid = uuid.UUID(user_id) if user_id else None
    
    report = ReportsService.generate_employee_performance_report(
        db=db,
        organization_id=current_user.organization_id,
        start_date=start_date,
        end_date=end_date,
        role=role,
        user_id=user_uuid
    )
    
    return report


@router.get("/client-analytics", response_model=ClientAnalyticsReport)
async def get_client_analytics(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить аналитику по клиентам"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view client analytics"
        )
    
    report = ReportsService.generate_client_analytics_report(
        db=db,
        organization_id=current_user.organization_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return report


@router.get("/my-payroll")
async def get_my_payroll(
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить свою зарплатную ведомость"""

    now = datetime.now(timezone.utc)

    if not period_start:
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if not period_end:
        # Безопасный переход на следующий месяц
        if period_start.month == 12:
            period_end = period_start.replace(
                year=period_start.year + 1, month=1
            )
        else:
            period_end = period_start.replace(month=period_start.month + 1)

        period_end = period_end - timedelta(microseconds=1)  # конец месяца

    # 🔍 Отладочная печать
    print("💬 period_start:", period_start)
    print("💬 period_end:", period_end)

    payroll = ReportsService.get_user_payroll(
        db=db,
        user_id=current_user.id,
        period_start=period_start,
        period_end=period_end
    )

    return payroll

@router.get("/financial-summary/export")
async def export_financial_summary(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    format: str = Query("xlsx", regex="^(xlsx|pdf)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспортировать финансовый отчет"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export financial reports"
        )
    
    try:
        # Генерируем отчет
        report = ReportsService.generate_financial_summary(
            db=db,
            organization_id=current_user.organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        filename = f"financial_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.{format}"
        
        if format == "xlsx":
            # Создаем Excel файл
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet("Финансовый отчет")
            
            # Стили
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#D7E4BC',
                'border': 1,
                'align': 'center'
            })
            money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
            
            # Заголовок
            worksheet.write('A1', 'Финансовый отчет', header_format)
            worksheet.write('A2', f'Период: {start_date.strftime("%d.%m.%Y")} - {end_date.strftime("%d.%m.%Y")}')
            
            # Данные
            row = 4
            worksheet.write(row, 0, 'Показатель', header_format)
            worksheet.write(row, 1, 'Сумма', header_format)
            
            row += 1
            worksheet.write(row, 0, 'Общая выручка')
            worksheet.write(row, 1, report.total_revenue, money_format)
            
            row += 1
            worksheet.write(row, 0, 'Выручка от аренды')
            worksheet.write(row, 1, report.rental_revenue, money_format)
            
            row += 1
            worksheet.write(row, 0, 'Выручка от заказов')
            worksheet.write(row, 1, report.orders_revenue, money_format)
            
            row += 1
            worksheet.write(row, 0, 'Общие расходы')
            worksheet.write(row, 1, report.total_expenses, money_format)
            
            row += 1
            worksheet.write(row, 0, 'Расходы на персонал')
            worksheet.write(row, 1, report.staff_expenses, money_format)
            
            row += 1
            worksheet.write(row, 0, 'Расходы на материалы')
            worksheet.write(row, 1, report.material_expenses, money_format)
            
            row += 1
            worksheet.write(row, 0, 'Чистая прибыль')
            worksheet.write(row, 1, report.net_profit, money_format)
            
            row += 2
            worksheet.write(row, 0, 'Загруженность', header_format)
            worksheet.write(row, 1, f'{report.occupancy_rate:.1f}%')
            
            row += 1
            worksheet.write(row, 0, 'Количество помещений')
            worksheet.write(row, 1, report.properties_count)
            
            row += 1
            worksheet.write(row, 0, 'Активные аренды')
            worksheet.write(row, 1, report.active_rentals)
            
            # Автоширина колонок
            worksheet.set_column('A:A', 25)
            worksheet.set_column('B:B', 15)
            
            workbook.close()
            output.seek(0)
            
            # Логируем экспорт
            AuthService.log_user_action(
                db=db,
                user_id=current_user.id,
                action="financial_report_exported",
                organization_id=current_user.organization_id,
                details={
                    "format": format,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            )
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        elif format == "pdf":
            # Генерируем PDF
            organization = db.query(Organization).get(current_user.organization_id)
            organization_name = organization.name if organization else "Неизвестная организация"

            pdf_content = ReportsService.generate_financial_pdf(
                report=report,
                start_date=start_date,
                end_date=end_date,
                organization_name=organization_name,
                user_fullname=current_user.first_name + " " + current_user.last_name
            )
            
            return Response(
                content=pdf_content,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export report: {str(e)}"
        )


@router.get("/property-occupancy/export")
async def export_property_occupancy(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    property_id: Optional[str] = None,
    format: str = Query("xlsx", regex="^(xlsx|pdf)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспортировать отчет по загруженности помещений"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export occupancy reports"
        )
    
    try:
        property_uuid = uuid.UUID(property_id) if property_id else None
        
        # Генерируем отчет
        report = ReportsService.generate_property_occupancy_report(
            db=db,
            organization_id=current_user.organization_id,
            start_date=start_date,
            end_date=end_date,
            property_id=property_uuid
        )
        
        filename = f"property_occupancy_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.{format}"
        
        if format == "xlsx":
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet("Загруженность помещений")
            
            # Стили
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#D7E4BC',
                'border': 1,
                'align': 'center'
            })
            percent_format = workbook.add_format({'num_format': '0.00"%"'})
            money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
            
            # Заголовки
            headers = ['Помещение', 'Номер', 'Всего дней', 'Занято дней', 'Загруженность %', 'Выручка']
            for col, header in enumerate(headers):
                worksheet.write(0, col, header, header_format)
            
            # Данные
            for row, prop in enumerate(report, 1):
                worksheet.write(row, 0, prop.property_name)
                worksheet.write(row, 1, prop.property_number)
                worksheet.write(row, 2, prop.total_days)
                worksheet.write(row, 3, prop.occupied_days)
                worksheet.write(row, 4, prop.occupancy_rate / 100, percent_format)
                worksheet.write(row, 5, prop.revenue, money_format)
            
            # Автоширина
            worksheet.set_column('A:A', 20)
            worksheet.set_column('B:B', 10)
            worksheet.set_column('C:D', 12)
            worksheet.set_column('E:E', 15)
            worksheet.set_column('F:F', 15)
            
            workbook.close()
            output.seek(0)
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export occupancy report: {str(e)}"
        )


@router.get("/client-analytics/export")
async def export_client_analytics(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    format: str = Query("xlsx", regex="^(xlsx|pdf)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспортировать клиентскую аналитику"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export client analytics"
        )
    
    try:
        # Генерируем отчет
        report = ReportsService.generate_client_analytics_report(
            db=db,
            organization_id=current_user.organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        filename = f"client_analytics_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.{format}"
        
        if format == "xlsx":
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet("Клиентская аналитика")
            
            # Стили
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#D7E4BC',
                'border': 1,
                'align': 'center'
            })
            money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
            
            # Основная статистика
            row = 0
            worksheet.write(row, 0, 'Клиентская аналитика', header_format)
            worksheet.write(row, 1, f'Период: {start_date.strftime("%d.%m.%Y")} - {end_date.strftime("%d.%m.%Y")}')
            
            row += 2
            worksheet.write(row, 0, 'Показатель', header_format)
            worksheet.write(row, 1, 'Значение', header_format)
            
            stats = [
                ('Всего клиентов', report.total_clients),
                ('Новые клиенты', report.new_clients),
                ('Постоянные клиенты', report.returning_clients),
                ('Средняя продолжительность пребывания (дни)', f'{report.average_stay_duration:.1f}'),
                ('Средние траты', f'{report.average_spending:,.2f} ₸')
            ]
            
            for stat_name, stat_value in stats:
                row += 1
                worksheet.write(row, 0, stat_name)
                worksheet.write(row, 1, stat_value)
            
            # Топ клиенты
            if report.top_clients:
                row += 3
                worksheet.write(row, 0, 'Топ клиенты', header_format)
                row += 1
                worksheet.write(row, 0, 'Имя', header_format)
                worksheet.write(row, 1, 'Потрачено', header_format)
                worksheet.write(row, 2, 'Средняя длительность пребывания', header_format)
                
                for client in report.top_clients[:10]:
                    row += 1
                    worksheet.write(row, 0, client['client_name'])
                    worksheet.write(row, 1, client['spending'], money_format)
                    worksheet.write(row, 2, f"{client['stay_duration']:.1f} дней")
            
            # Источники клиентов
            if report.client_sources:
                row += 3
                worksheet.write(row, 0, 'Источники клиентов', header_format)
                row += 1
                worksheet.write(row, 0, 'Источник', header_format)
                worksheet.write(row, 1, 'Количество', header_format)
                
                for source, count in report.client_sources.items():
                    row += 1
                    worksheet.write(row, 0, source)
                    worksheet.write(row, 1, count)
            
            # Автоширина
            worksheet.set_column('A:A', 30)
            worksheet.set_column('B:B', 20)
            worksheet.set_column('C:C', 25)
            
            workbook.close()
            output.seek(0)
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export client analytics: {str(e)}"
        )


@router.get("/employee-performance/export")
async def export_employee_performance(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    role: Optional[UserRole] = None,
    user_id: Optional[str] = None,
    format: str = Query("xlsx", regex="^(xlsx|pdf)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспортировать отчет по производительности сотрудников"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export employee reports"
        )
    
    try:
        user_uuid = uuid.UUID(user_id) if user_id else None
        
        # Генерируем отчет
        report = ReportsService.generate_employee_performance_report(
            db=db,
            organization_id=current_user.organization_id,
            start_date=start_date,
            end_date=end_date,
            role=role,
            user_id=user_uuid
        )
        
        filename = f"employee_performance_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.{format}"
        
        if format == "xlsx":
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet("Производительность сотрудников")
            
            # Стили
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#D7E4BC',
                'border': 1,
                'align': 'center'
            })
            money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
            
            # Заголовки
            headers = ['Сотрудник', 'Роль', 'Задач выполнено', 'Среднее время (мин)', 'Рейтинг качества', 'Заработано']
            for col, header in enumerate(headers):
                worksheet.write(0, col, header, header_format)
            
            # Данные
            for row, emp in enumerate(report, 1):
                worksheet.write(row, 0, emp.user_name)
                worksheet.write(row, 1, emp.role)
                worksheet.write(row, 2, emp.tasks_completed)
                worksheet.write(row, 3, emp.average_completion_time or 0)
                worksheet.write(row, 4, emp.quality_rating or 0)
                worksheet.write(row, 5, emp.earnings, money_format)
            
            # Автоширина
            worksheet.set_column('A:A', 20)
            worksheet.set_column('B:B', 15)
            worksheet.set_column('C:E', 12)
            worksheet.set_column('F:F', 15)
            
            workbook.close()
            output.seek(0)
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    
@router.get("/debug/data-sources")
async def debug_report_data_sources(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отладочная информация о данных для отчетов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for debug information"
        )
    
    debug_info = ReportsService.debug_report_data(
        db=db,
        organization_id=current_user.organization_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return debug_info


@router.get("/debug/employee-earnings/{user_id}")
async def debug_employee_earnings(
    user_id: str,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отладочная информация о заработке конкретного сотрудника"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for debug information"
        )
    
    try:
        user_uuid = uuid.UUID(user_id)
        
        # Получаем информацию о пользователе
        user = db.query(User).filter(
            and_(
                User.id == user_uuid,
                User.organization_id == current_user.organization_id
            )
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Получаем все зарплаты пользователя за период
        payrolls = db.query(Payroll).filter(
            and_(
                Payroll.user_id == user_uuid,
                Payroll.organization_id == current_user.organization_id,
                or_(
                    and_(Payroll.period_start >= start_date, Payroll.period_end <= end_date),
                    and_(Payroll.period_start <= end_date, Payroll.period_end >= start_date)
                )
            )
        ).all()
        
        # Получаем задачи пользователя за период
        tasks = db.query(Task).filter(
            and_(
                Task.assigned_to == user_uuid,
                Task.organization_id == current_user.organization_id,
                Task.completed_at >= start_date,
                Task.completed_at <= end_date,
                Task.status == TaskStatus.COMPLETED
            )
        ).all()
        
        # Рассчитываем заработок по новой логике
        accurate_earnings = ReportsService.get_payroll_period_earnings(
            db, user_uuid, current_user.organization_id, start_date, end_date
        )
        
        debug_data = {
            "user_info": {
                "id": str(user.id),
                "name": f"{user.first_name} {user.last_name}",
                "role": user.role.value,
                "email": user.email
            },
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "payrolls": [
                {
                    "id": str(p.id),
                    "period_start": p.period_start.isoformat(),
                    "period_end": p.period_end.isoformat(),
                    "gross_amount": p.gross_amount,
                    "net_amount": p.net_amount,
                    "is_paid": p.is_paid,
                    "paid_at": p.paid_at.isoformat() if p.paid_at else None
                }
                for p in payrolls
            ],
            "tasks": [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                    "payment_amount": t.payment_amount or 0,
                    "is_paid": t.is_paid
                }
                for t in tasks
            ],
            "earnings_calculation": {
                "accurate_earnings": accurate_earnings,
                "payroll_total": sum(p.net_amount for p in payrolls if p.is_paid),
                "tasks_total": sum(t.payment_amount or 0 for t in tasks if t.is_paid),
                "payrolls_count": len(payrolls),
                "paid_payrolls_count": len([p for p in payrolls if p.is_paid]),
                "tasks_count": len(tasks)
            }
        }
        
        return debug_data
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/general-statistics/export")
async def export_general_statistics(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    format: str = Query("xlsx", regex="^(xlsx|pdf)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспортировать общую статистику"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export general statistics"
        )
    
    try:
        # Собираем все данные для общей статистики
        financial_report = ReportsService.generate_financial_summary(
            db=db, organization_id=current_user.organization_id,
            start_date=start_date, end_date=end_date
        )
        
        occupancy_report = ReportsService.generate_property_occupancy_report(
            db=db, organization_id=current_user.organization_id,
            start_date=start_date, end_date=end_date
        )
        
        client_report = ReportsService.generate_client_analytics_report(
            db=db, organization_id=current_user.organization_id,
            start_date=start_date, end_date=end_date
        )
        
        employee_report = ReportsService.generate_employee_performance_report(
            db=db, organization_id=current_user.organization_id,
            start_date=start_date, end_date=end_date
        )
        
        filename = f"general_statistics_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.{format}"
        
        if format == "xlsx":
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            
            # Общая информация
            summary_ws = workbook.add_worksheet("Общая статистика")
            
            # Стили
            header_format = workbook.add_format({
                'bold': True, 'bg_color': '#D7E4BC', 'border': 1, 'align': 'center'
            })
            money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
            percent_format = workbook.add_format({'num_format': '0.00"%"'})
            
            # Заголовок
            summary_ws.write('A1', 'ОБЩАЯ СТАТИСТИКА', header_format)
            summary_ws.write('A2', f'Период: {start_date.strftime("%d.%m.%Y")} - {end_date.strftime("%d.%m.%Y")}')
            
            # Финансовые показатели
            row = 4
            summary_ws.write(row, 0, 'ФИНАНСОВЫЕ ПОКАЗАТЕЛИ', header_format)
            row += 1
            
            financial_data = [
                ('Общая выручка', financial_report.total_revenue),
                ('Выручка от аренды', financial_report.rental_revenue),
                ('Выручка от заказов', financial_report.orders_revenue),
                ('Общие расходы', financial_report.total_expenses),
                ('Расходы на персонал', financial_report.staff_expenses),
                ('Расходы на материалы', financial_report.material_expenses),
                ('Чистая прибыль', financial_report.net_profit),
                ('Рентабельность (%)', (financial_report.net_profit / financial_report.total_revenue * 100) if financial_report.total_revenue > 0 else 0)
            ]
            
            for label, value in financial_data:
                summary_ws.write(row, 0, label)
                if 'рентабельность' in label.lower():
                    summary_ws.write(row, 1, value / 100, percent_format)
                else:
                    summary_ws.write(row, 1, value, money_format)
                row += 1
            
            # Показатели помещений
            row += 1
            summary_ws.write(row, 0, 'ПОКАЗАТЕЛИ ПОМЕЩЕНИЙ', header_format)
            row += 1
            
            avg_occupancy = sum(p.occupancy_rate for p in occupancy_report) / len(occupancy_report) if occupancy_report else 0
            total_revenue_properties = sum(p.revenue for p in occupancy_report)
            
            property_data = [
                ('Всего помещений', len(occupancy_report)),
                ('Средняя загруженность (%)', avg_occupancy),
                ('Общая выручка от помещений', total_revenue_properties),
                ('Активные аренды', financial_report.active_rentals)
            ]
            
            for label, value in property_data:
                summary_ws.write(row, 0, label)
                if 'загруженность' in label.lower():
                    summary_ws.write(row, 1, value / 100, percent_format)
                elif isinstance(value, float) and 'выручка' in label.lower():
                    summary_ws.write(row, 1, value, money_format)
                else:
                    summary_ws.write(row, 1, value)
                row += 1
            
            # Клиентские показатели
            row += 1
            summary_ws.write(row, 0, 'КЛИЕНТСКИЕ ПОКАЗАТЕЛИ', header_format)
            row += 1
            
            client_data = [
                ('Всего клиентов', client_report.total_clients),
                ('Новые клиенты', client_report.new_clients),
                ('Постоянные клиенты', client_report.returning_clients),
                ('Средний чек', client_report.average_spending),
                ('Средняя длительность пребывания (дни)', client_report.average_stay_duration)
            ]
            
            for label, value in client_data:
                summary_ws.write(row, 0, label)
                if 'чек' in label.lower() or 'средн' in label.lower() and 'дни' not in label.lower():
                    summary_ws.write(row, 1, value, money_format)
                else:
                    summary_ws.write(row, 1, value)
                row += 1
            
            # Показатели персонала
            row += 1
            summary_ws.write(row, 0, 'ПОКАЗАТЕЛИ ПЕРСОНАЛА', header_format)
            row += 1
            
            total_tasks = sum(emp.tasks_completed for emp in employee_report)
            total_earnings = sum(emp.earnings for emp in employee_report)
            avg_quality = sum(emp.quality_rating or 0 for emp in employee_report) / len([e for e in employee_report if e.quality_rating]) if employee_report else 0
            
            staff_data = [
                ('Всего сотрудников', len(employee_report)),
                ('Выполнено задач', total_tasks),
                ('Общие выплаты', total_earnings),
                ('Средняя оценка качества', avg_quality)
            ]
            
            for label, value in staff_data:
                summary_ws.write(row, 0, label)
                if 'выплаты' in label.lower():
                    summary_ws.write(row, 1, value, money_format)
                else:
                    summary_ws.write(row, 1, value)
                row += 1
            
            # Автоширина колонок
            summary_ws.set_column('A:A', 35)
            summary_ws.set_column('B:B', 20)
            
            workbook.close()
            output.seek(0)
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export general statistics: {str(e)}"
        )


@router.get("/comparative-analysis/export")
async def export_comparative_analysis(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    format: str = Query("xlsx", regex="^(xlsx|pdf)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспортировать сравнительную аналитику"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export comparative analysis"
        )
    
    try:
        # Текущий период
        current_report = ReportsService.generate_financial_summary(
            db=db, organization_id=current_user.organization_id,
            start_date=start_date, end_date=end_date
        )
        
        # Предыдущий период (такой же длительности)
        period_duration = end_date - start_date
        prev_end_date = start_date - timedelta(days=1)
        prev_start_date = prev_end_date - period_duration
        
        previous_report = ReportsService.generate_financial_summary(
            db=db, organization_id=current_user.organization_id,
            start_date=prev_start_date, end_date=prev_end_date
        )
        
        filename = f"comparative_analysis_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.{format}"
        
        if format == "xlsx":
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet("Сравнительная аналитика")
            
            # Стили
            header_format = workbook.add_format({
                'bold': True, 'bg_color': '#D7E4BC', 'border': 1, 'align': 'center'
            })
            money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
            percent_format = workbook.add_format({'num_format': '0.00"%"'})
            positive_format = workbook.add_format({'color': 'green', 'bold': True})
            negative_format = workbook.add_format({'color': 'red', 'bold': True})
            
            # Заголовок
            worksheet.write('A1', 'СРАВНИТЕЛЬНАЯ АНАЛИТИКА', header_format)
            worksheet.write('A2', f'Текущий период: {start_date.strftime("%d.%m.%Y")} - {end_date.strftime("%d.%m.%Y")}')
            worksheet.write('A3', f'Предыдущий период: {prev_start_date.strftime("%d.%m.%Y")} - {prev_end_date.strftime("%d.%m.%Y")}')
            
            # Заголовки таблицы
            headers = ['Показатель', 'Текущий период', 'Предыдущий период', 'Изменение', 'Изменение %']
            for col, header in enumerate(headers):
                worksheet.write(4, col, header, header_format)
            
            # Данные для сравнения
            comparison_data = [
                ('Общая выручка', current_report.total_revenue, previous_report.total_revenue),
                ('Выручка от аренды', current_report.rental_revenue, previous_report.rental_revenue),
                ('Общие расходы', current_report.total_expenses, previous_report.total_expenses),
                ('Чистая прибыль', current_report.net_profit, previous_report.net_profit),
                ('Загруженность (%)', current_report.occupancy_rate, previous_report.occupancy_rate),
                ('Активные аренды', current_report.active_rentals, previous_report.active_rentals)
            ]
            
            row = 5
            for label, current_val, prev_val in comparison_data:
                worksheet.write(row, 0, label)
                
                # Текущий период
                if 'загруженность' in label.lower():
                    worksheet.write(row, 1, current_val / 100, percent_format)
                    worksheet.write(row, 2, prev_val / 100, percent_format)
                elif isinstance(current_val, (int, float)) and 'аренды' not in label.lower():
                    worksheet.write(row, 1, current_val, money_format)
                    worksheet.write(row, 2, prev_val, money_format)
                else:
                    worksheet.write(row, 1, current_val)
                    worksheet.write(row, 2, prev_val)
                
                # Изменение
                change = current_val - prev_val
                change_percent = (change / prev_val * 100) if prev_val != 0 else 0
                
                # Форматирование изменений
                change_format = positive_format if change >= 0 else negative_format
                
                if 'загруженность' in label.lower():
                    worksheet.write(row, 3, change, change_format)
                elif isinstance(change, (int, float)) and 'аренды' not in label.lower():
                    worksheet.write(row, 3, change, money_format)
                else:
                    worksheet.write(row, 3, change, change_format)
                
                worksheet.write(row, 4, change_percent / 100, percent_format)
                
                row += 1
            
            # Автоширина колонок
            worksheet.set_column('A:A', 25)
            worksheet.set_column('B:E', 18)
            
            workbook.close()
            output.seek(0)
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export comparative analysis: {str(e)}"
        )
    
# Добавить в backend/routers/reports.py

@router.get("/debug/earnings-strategies/{user_id}")
async def test_earnings_strategies(
    user_id: str,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Тестирование разных стратегий расчета earnings"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        user_uuid = uuid.UUID(user_id)
        
        strategies_result = ReportsService.calculate_earnings_with_strategy(
            db=db,
            user_id=user_uuid,
            organization_id=current_user.organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "user_id": user_id,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "analysis": strategies_result,
            "recommendation": {
                "current_method": strategies_result["strategies"]["simple"],
                "improved_method": strategies_result["strategies"]["monthly_grouped"],
                "difference": strategies_result["strategies"]["monthly_grouped"] - strategies_result["strategies"]["simple"],
                "suggested_strategy": "monthly_grouped" if strategies_result["payrolls_count"] > 2 else "simple"
            }
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/debug/cleanup-duplicate-payrolls")
async def cleanup_duplicate_payrolls(
    user_id: str,
    dry_run: bool = Query(True, description="Только показать, что будет удалено"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Очистка дублирующих зарплат (ОСТОРОЖНО!)"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(status_code=403, detail="Only admins can cleanup payrolls")
    
    try:
        user_uuid = uuid.UUID(user_id)
        
        # Находим все зарплаты пользователя
        all_payrolls = db.query(Payroll).filter(
            and_(
                Payroll.user_id == user_uuid,
                Payroll.organization_id == current_user.organization_id
            )
        ).order_by(Payroll.period_start, desc(Payroll.net_amount), desc(Payroll.created_at)).all()
        
        # Группируем по месяцам
        monthly_groups = {}
        for payroll in all_payrolls:
            month_key = payroll.period_start.strftime("%Y-%m")
            if month_key not in monthly_groups:
                monthly_groups[month_key] = []
            monthly_groups[month_key].append(payroll)
        
        # Находим дубликаты
        duplicates_to_remove = []
        kept_payrolls = []
        
        for month_key, month_payrolls in monthly_groups.items():
            if len(month_payrolls) > 1:
                # Оставляем самую большую и новую
                sorted_payrolls = sorted(
                    month_payrolls,
                    key=lambda p: (p.net_amount, p.created_at),
                    reverse=True
                )
                
                kept_payrolls.append(sorted_payrolls[0])
                duplicates_to_remove.extend(sorted_payrolls[1:])
            else:
                kept_payrolls.extend(month_payrolls)
        
        cleanup_result = {
            "user_id": user_id,
            "total_payrolls": len(all_payrolls),
            "duplicates_found": len(duplicates_to_remove),
            "will_keep": len(kept_payrolls),
            "dry_run": dry_run,
            "duplicates_details": [
                {
                    "id": str(p.id),
                    "period": f"{p.period_start} - {p.period_end}",
                    "amount": p.net_amount,
                    "created_at": p.created_at.isoformat()
                }
                for p in duplicates_to_remove
            ]
        }
        
        if not dry_run and duplicates_to_remove:
            # РЕАЛЬНОЕ УДАЛЕНИЕ (ОСТОРОЖНО!)
            for payroll in duplicates_to_remove:
                db.delete(payroll)
            
            db.commit()
            cleanup_result["deleted"] = len(duplicates_to_remove)
            cleanup_result["message"] = f"Deleted {len(duplicates_to_remove)} duplicate payrolls"
        else:
            cleanup_result["message"] = f"Found {len(duplicates_to_remove)} duplicates (dry run mode)"
        
        return cleanup_result
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    


@router.post("/comprehensive/generate", response_model=ComprehensiveReportResponse)
async def generate_comprehensive_report_v2(
    request: ComprehensiveReportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Генерировать полный комплексный отчет (v2)"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to generate comprehensive reports"
        )
    
    try:
        report = ComprehensiveReportService.generate_comprehensive_report(
            db=db,
            organization_id=current_user.organization_id,
            request=request
        )
        
        # Логируем создание отчета
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="comprehensive_report_v2_generated",
            organization_id=current_user.organization_id,
            details={
                "start_date": request.start_date.isoformat(),
                "end_date": request.end_date.isoformat(),
                "format": request.format.value,
                "utility_bills": request.utility_bills_amount,
                "admin_expenses_count": len(request.additional_admin_expenses),
                "total_revenue": report.total_revenue,
                "total_expenses": report.total_expenses,
                "net_profit": report.net_profit
            }
        )
        
        return report
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate comprehensive report: {str(e)}"
        )


@router.post("/comprehensive/export")
async def export_comprehensive_report_v2(
    request: ComprehensiveReportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспортировать полный отчет в файл (xlsx/xml)"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export comprehensive reports"
        )
    
    try:
        # Генерируем отчет
        report = ComprehensiveReportService.generate_comprehensive_report(
            db=db,
            organization_id=current_user.organization_id,
            request=request
        )
        
        # Экспортируем в нужном формате
        if request.format == ReportFormat.XLSX:
            file_content = ComprehensiveReportService.export_to_xlsx(report)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            file_extension = "xlsx"
        elif request.format == ReportFormat.XML:
            file_content = ComprehensiveReportService.export_to_xml(report)
            media_type = "application/xml"
            file_extension = "xml"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported export format: {request.format}"
            )
        
        # Генерируем имя файла
        org_name = report.organization_name.replace(" ", "_").replace("/", "_")
        filename = f"comprehensive_report_{org_name}_{request.start_date.strftime('%Y%m%d')}_{request.end_date.strftime('%Y%m%d')}.{file_extension}"
        
        # Логируем экспорт
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="comprehensive_report_v2_exported",
            organization_id=current_user.organization_id,
            details={
                "format": request.format.value,
                "start_date": request.start_date.isoformat(),
                "end_date": request.end_date.isoformat(),
                "filename": filename,
                "file_size": len(file_content),
                "total_revenue": report.total_revenue,
                "total_expenses": report.total_expenses,
                "net_profit": report.net_profit,
                "sections": {
                    "staff_count": len(report.staff_payroll),
                    "inventory_items": len(report.inventory_movements),
                    "properties": len(report.property_revenues),
                    "admin_expenses": len(report.administrative_expenses)
                }
            }
        )
        
        return Response(
            content=file_content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export comprehensive report: {str(e)}"
        )


@router.get("/comprehensive/preview")
async def preview_comprehensive_report_data(
    start_date: datetime = Query(..., description="Дата начала периода"),
    end_date: datetime = Query(..., description="Дата окончания периода"),
    utility_bills_amount: float = Query(0, ge=0, description="Сумма коммунальных услуг"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Предварительный просмотр данных для комплексного отчета"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to preview comprehensive reports"
        )
    
    try:
        # Создаем базовый запрос для предварительного просмотра
        preview_request = ComprehensiveReportRequest(
            start_date=start_date,
            end_date=end_date,
            utility_bills_amount=utility_bills_amount,
            format=ReportFormat.XLSX,  # Формат не важен для preview
            additional_admin_expenses=[]
        )
        
        # Генерируем сокращенную версию отчета
        report = ComprehensiveReportService.generate_comprehensive_report(
            db=db,
            organization_id=current_user.organization_id,
            request=preview_request
        )
        
        # Возвращаем детальный preview с топ-показателями
        preview_data = {
            "organization_name": report.organization_name,
            "report_period": {
                "start_date": start_date,
                "end_date": end_date,
                "duration_days": (end_date - start_date).days + 1
            },
            "financial_overview": {
                "total_revenue": report.total_revenue,
                "total_expenses": report.total_expenses,
                "net_profit": report.net_profit,
                "profitability_percent": round((report.net_profit / report.total_revenue * 100), 2) if report.total_revenue > 0 else 0,
                "expense_ratio": round((report.total_expenses / report.total_revenue * 100), 2) if report.total_revenue > 0 else 0
            },
            "sections_summary": {
                "payroll": {
                    **report.payroll_summary,
                    "employees_count": len(report.staff_payroll),
                    "avg_salary": round(report.payroll_summary["total_net"] / len(report.staff_payroll), 2) if report.staff_payroll else 0,
                    "top_earner": max(report.staff_payroll, key=lambda x: x.net_amount).name if report.staff_payroll else None
                },
                "inventory": {
                    **report.inventory_summary,
                    "items_count": len(report.inventory_movements),
                    "profit_margin": round((report.inventory_summary["total_profit"] / report.inventory_summary["total_outgoing_cost"] * 100), 2) if report.inventory_summary["total_outgoing_cost"] > 0 else 0,
                    "most_profitable_item": max(report.inventory_movements, key=lambda x: x.net_profit).item_name if report.inventory_movements else None
                },
                "properties": {
                    **report.property_summary,
                    "properties_count": len(report.property_revenues),
                    "best_performer": max(report.property_revenues, key=lambda x: x.total_revenue).property_name if report.property_revenues else None,
                    "commission_rate": round((report.property_summary["total_commission"] / report.property_summary["total_card"] * 100), 2) if report.property_summary["total_card"] > 0 else 0
                },
                "administrative": {
                    **report.administrative_summary,
                    "expenses_count": len(report.administrative_expenses),
                    "largest_expense": max(report.administrative_expenses, key=lambda x: x.amount).description if report.administrative_expenses else None,
                    "admin_to_revenue_ratio": round((report.administrative_summary["total_admin_expenses"] / report.total_revenue * 100), 2) if report.total_revenue > 0 else 0
                }
            },
            "acquiring_overview": {
                "card_payment_share": round(report.acquiring_statistics["card_payment_percentage"], 2),
                "commission_amount": report.acquiring_statistics["total_commission_paid"],
                "effective_commission_rate": round(report.acquiring_statistics["average_commission_rate"], 2)
            },
            "data_quality": {
                "staff_records": len(report.staff_payroll),
                "inventory_items": len(report.inventory_movements),
                "properties_analyzed": len(report.property_revenues),
                "admin_expenses": len(report.administrative_expenses),
                "completeness_score": ComprehensiveReportService._calculate_completeness_score(report)
            },
            "recommendations": ComprehensiveReportService._generate_business_recommendations(report)
        }
        
        return preview_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report preview: {str(e)}"
        )


@router.get("/comprehensive/templates/expenses")
async def get_administrative_expense_templates_v2(
    current_user: User = Depends(get_current_active_user)
):
    """Получить расширенные шаблоны административных расходов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access expense templates"
        )
    
    # Расширенные шаблоны с учетом специфики бизнеса в КЗ
    templates = {
        "operational": [
            {"category": "utility_bills", "description": "Коммунальные услуги (электричество, вода, отопление)", "amount": 150000, "frequency": "monthly"},
            {"category": "internet_phone", "description": "Интернет и телефонная связь", "amount": 25000, "frequency": "monthly"},
            {"category": "cleaning_supplies", "description": "Моющие и чистящие средства", "amount": 35000, "frequency": "monthly"},
            {"category": "office_supplies", "description": "Канцелярские товары и офисные принадлежности", "amount": 20000, "frequency": "monthly"},
            {"category": "maintenance", "description": "Техническое обслуживание оборудования", "amount": 50000, "frequency": "monthly"}
        ],
        "administrative": [
            {"category": "legal_services", "description": "Юридические услуги и консультации", "amount": 80000, "frequency": "monthly"},
            {"category": "accounting_services", "description": "Бухгалтерские услуги", "amount": 120000, "frequency": "monthly"},
            {"category": "bank_services", "description": "Банковское обслуживание (РКО, переводы)", "amount": 15000, "frequency": "monthly"},
            {"category": "insurance", "description": "Страхование имущества и ответственности", "amount": 45000, "frequency": "monthly"},
            {"category": "licenses", "description": "Лицензии и разрешения", "amount": 30000, "frequency": "monthly"}
        ],
        "marketing": [
            {"category": "advertising", "description": "Реклама в интернете и СМИ", "amount": 100000, "frequency": "monthly"},
            {"category": "social_media", "description": "Продвижение в социальных сетях", "amount": 40000, "frequency": "monthly"},
            {"category": "website", "description": "Обслуживание и развитие сайта", "amount": 25000, "frequency": "monthly"},
            {"category": "printing", "description": "Печатная реклама и материалы", "amount": 20000, "frequency": "monthly"}
        ],
        "security": [
            {"category": "security_services", "description": "Охранные услуги", "amount": 90000, "frequency": "monthly"},
            {"category": "alarm_system", "description": "Обслуживание сигнализации", "amount": 15000, "frequency": "monthly"},
            {"category": "video_surveillance", "description": "Система видеонаблюдения", "amount": 20000, "frequency": "monthly"}
        ],
        "taxes_fees": [
            {"category": "property_tax", "description": "Налог на имущество", "amount": 200000, "frequency": "quarterly"},
            {"category": "land_tax", "description": "Земельный налог", "amount": 50000, "frequency": "quarterly"},
            {"category": "environmental_fee", "description": "Экологические сборы", "amount": 10000, "frequency": "quarterly"},
            {"category": "waste_disposal", "description": "Вывоз и утилизация отходов", "amount": 25000, "frequency": "monthly"}
        ]
    }
    
    return {
        "templates": templates,
        "currency": "KZT",
        "note": "Суммы являются примерными и рассчитаны для средней организации в сфере аренды помещений в Казахстане. Корректируйте значения в соответствии с реальными расходами.",
        "total_estimated_monthly": sum(
            item["amount"] for category in templates.values() 
            for item in category if item["frequency"] == "monthly"
        ),
        "total_estimated_quarterly": sum(
            item["amount"] for category in templates.values() 
            for item in category if item["frequency"] == "quarterly"
        )
    }