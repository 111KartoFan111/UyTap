# backend/routers/reports.py
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import uuid
import io
import xlsxwriter

from models.database import get_db
from models.models import User, UserRole
from schemas.reports import (
    FinancialSummaryReport, PropertyOccupancyReport, 
    EmployeePerformanceReport, ClientAnalyticsReport
)
from utils.dependencies import get_current_active_user
from services.auth_service import AuthService
from services.reports_service import ReportsService

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
    
    # Если период не указан, берем текущий месяц
    if not period_start:
        now = datetime.now(timezone.utc)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    if not period_end:
        next_month = period_start.replace(month=period_start.month + 1)
        period_end = next_month - timedelta(seconds=1)
    
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
    
    # Генерируем отчет
    report = ReportsService.generate_financial_summary(
        db=db,
        organization_id=current_user.organization_id,
        start_date=start_date,
        end_date=end_date
    )
    
    if format == "xlsx":
        # Создаем Excel файл
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet("Финансовый отчет")
        
        # Стили
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#D7E4BC',
            'border': 1
        })
        money_format = workbook.add_format({'num_format': '#,##0.00 ₸'})
        
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
        worksheet.write(row, 0, 'Общие расходы')
        worksheet.write(row, 1, report.total_expenses, money_format)
        
        row += 1
        worksheet.write(row, 0, 'Расходы на персонал')
        worksheet.write(row, 1, report.staff_expenses, money_format)
        
        row += 1
        worksheet.write(row, 0, 'Чистая прибыль')
        worksheet.write(row, 1, report.net_profit, money_format)
        
        row += 2
        worksheet.write(row, 0, 'Загруженность', header_format)
        worksheet.write(row, 1, f'{report.occupancy_rate:.1f}%')
        
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
        
        filename = f"financial_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.xlsx"
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    elif format == "pdf":
        # Генерируем PDF (здесь можно использовать reportlab или weasyprint)
        pdf_content = ReportsService.generate_financial_pdf(report, start_date, end_date)
        
        filename = f"financial_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.pdf"
        
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

