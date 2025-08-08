# backend/routers/comprehensive_reports.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel, Field
from enum import Enum 
from sqlalchemy import and_, desc

from models.database import get_db
from models.models import User, UserRole
from schemas.comprehensive_report import (
    ComprehensiveReportRequest, ComprehensiveReportResponse,
    AdministrativeExpense, ReportFormat
)
from utils.dependencies import get_current_active_user
from services.auth_service import AuthService
from services.comprehensive_report_service import ComprehensiveReportService

router = APIRouter(prefix="/api/comprehensive-reports", tags=["Comprehensive Reports"])


@router.post("/generate", response_model=ComprehensiveReportResponse)
async def generate_comprehensive_report(
    request: ComprehensiveReportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Генерировать полный комплексный отчет"""
    
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
            action="comprehensive_report_generated",
            organization_id=current_user.organization_id,
            details={
                "start_date": request.start_date.isoformat(),
                "end_date": request.end_date.isoformat(),
                "format": request.format.value,
                "utility_bills": request.utility_bills_amount,
                "admin_expenses_count": len(request.additional_admin_expenses)
            }
        )
        
        return report
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate comprehensive report: {str(e)}"
        )


@router.post("/export")
async def export_comprehensive_report(
    request: ComprehensiveReportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспортировать полный отчет в файл"""
    
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
        filename = f"comprehensive_report_{request.start_date.strftime('%Y%m%d')}_{request.end_date.strftime('%Y%m%d')}.{file_extension}"
        
        # Логируем экспорт
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="comprehensive_report_exported",
            organization_id=current_user.organization_id,
            details={
                "format": request.format.value,
                "start_date": request.start_date.isoformat(),
                "end_date": request.end_date.isoformat(),
                "filename": filename,
                "file_size": len(file_content)
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


@router.get("/preview")
async def preview_comprehensive_report(
    start_date: datetime = Query(..., description="Дата начала периода"),
    end_date: datetime = Query(..., description="Дата окончания периода"),
    utility_bills_amount: float = Query(0, ge=0, description="Сумма коммунальных услуг"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Предварительный просмотр данных для отчета"""
    
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
        
        # Возвращаем только сводные данные для preview
        preview_data = {
            "organization_name": report.organization_name,
            "report_period": report.report_period,
            "summary": {
                "total_revenue": report.total_revenue,
                "total_expenses": report.total_expenses,
                "net_profit": report.net_profit,
                "profitability_percent": (report.net_profit / report.total_revenue * 100) if report.total_revenue > 0 else 0
            },
            "payroll_summary": report.payroll_summary,
            "inventory_summary": report.inventory_summary,
            "property_summary": report.property_summary,
            "administrative_summary": report.administrative_summary,
            "acquiring_statistics": report.acquiring_statistics,
            "data_availability": {
                "staff_records": len(report.staff_payroll),
                "inventory_items": len(report.inventory_movements),
                "properties": len(report.property_revenues),
                "admin_expenses": len(report.administrative_expenses)
            }
        }
        
        return preview_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report preview: {str(e)}"
        )


@router.get("/templates/administrative-expenses")
async def get_administrative_expense_templates(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить шаблоны административных расходов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access expense templates"
        )
    
    # Предустановленные шаблоны административных расходов
    templates = [
        {
            "category": "office_supplies",
            "description": "Канцелярские товары",
            "suggested_amount": 50000,
            "frequency": "monthly"
        },
        {
            "category": "marketing",
            "description": "Реклама и маркетинг",
            "suggested_amount": 100000,
            "frequency": "monthly"
        },
        {
            "category": "legal_services",
            "description": "Юридические услуги",
            "suggested_amount": 75000,
            "frequency": "monthly"
        },
        {
            "category": "insurance",
            "description": "Страхование имущества",
            "suggested_amount": 25000,
            "frequency": "monthly"
        },
        {
            "category": "software_licenses",
            "description": "Лицензии на ПО",
            "suggested_amount": 30000,
            "frequency": "monthly"
        },
        {
            "category": "maintenance",
            "description": "Техническое обслуживание оборудования",
            "suggested_amount": 40000,
            "frequency": "monthly"
        },
        {
            "category": "telecommunications",
            "description": "Связь и интернет",
            "suggested_amount": 15000,
            "frequency": "monthly"
        },
        {
            "category": "cleaning_supplies",
            "description": "Моющие и чистящие средства",
            "suggested_amount": 20000,
            "frequency": "monthly"
        },
        {
            "category": "security",
            "description": "Охрана и безопасность",
            "suggested_amount": 80000,
            "frequency": "monthly"
        },
        {
            "category": "transport",
            "description": "Транспортные расходы",
            "suggested_amount": 35000,
            "frequency": "monthly"
        }
    ]
    
    return {
        "templates": templates,
        "note": "Суммы указаны в тенге и являются примерными. Корректируйте их в соответствии с реальными расходами вашей организации."
    }


@router.get("/statistics/export-history")
async def get_export_history(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить историю экспорта отчетов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view export history"
        )
    
    try:
        # Получаем историю действий по экспорту
        from models.models import UserAction
        
        export_actions = db.query(UserAction).filter(
            and_(
                UserAction.organization_id == current_user.organization_id,
                UserAction.action.in_([
                    "comprehensive_report_exported",
                    "comprehensive_report_generated"
                ])
            )
        ).order_by(UserAction.created_at.desc()).limit(limit).all()
        
        history = []
        for action in export_actions:
            history.append({
                "id": str(action.id),
                "action": action.action,
                "user": f"{action.user.first_name} {action.user.last_name}" if action.user else "System",
                "created_at": action.created_at,
                "details": action.details or {},
                "success": action.success
            })
        
        return {
            "history": history,
            "total_exports": len([h for h in history if h["action"] == "comprehensive_report_exported"]),
            "total_generations": len([h for h in history if h["action"] == "comprehensive_report_generated"])
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get export history: {str(e)}"
        )


@router.get("/validation/data-completeness")
async def validate_data_completeness(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Проверить полноту данных для генерации отчета"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to validate data completeness"
        )
    
    try:
        from models.extended_models import Rental, Task, Payroll, Inventory, InventoryMovement
        from models.acquiring_models import AcquiringSettings
        
        validation_results = {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "duration_days": (end_date - start_date).days + 1
            },
            "data_availability": {},
            "warnings": [],
            "recommendations": [],
            "overall_score": 0
        }
        
        # Проверяем наличие данных по аренде
        rentals_count = db.query(Rental).filter(
            and_(
                Rental.organization_id == current_user.organization_id,
                Rental.start_date < end_date,
                Rental.end_date > start_date
            )
        ).count()
        
        paid_rentals_count = db.query(Rental).filter(
            and_(
                Rental.organization_id == current_user.organization_id,
                Rental.start_date < end_date,
                Rental.end_date > start_date,
                Rental.paid_amount > 0
            )
        ).count()
        
        validation_results["data_availability"]["rentals"] = {
            "total_rentals": rentals_count,
            "paid_rentals": paid_rentals_count,
            "payment_rate": (paid_rentals_count / rentals_count * 100) if rentals_count > 0 else 0
        }
        
        if rentals_count == 0:
            validation_results["warnings"].append("Нет данных по аренде за указанный период")
        elif paid_rentals_count < rentals_count * 0.8:
            validation_results["warnings"].append(f"Только {paid_rentals_count} из {rentals_count} аренд имеют оплату")
        
        # Проверяем данные по зарплатам
        payrolls_count = db.query(Payroll).filter(
            and_(
                Payroll.organization_id == current_user.organization_id,
                Payroll.period_start < end_date,
                Payroll.period_end > start_date
            )
        ).count()
        
        paid_payrolls_count = db.query(Payroll).filter(
            and_(
                Payroll.organization_id == current_user.organization_id,
                Payroll.period_start < end_date,
                Payroll.period_end > start_date,
                Payroll.is_paid == True
            )
        ).count()
        
        validation_results["data_availability"]["payrolls"] = {
            "total_payrolls": payrolls_count,
            "paid_payrolls": paid_payrolls_count,
            "payment_rate": (paid_payrolls_count / payrolls_count * 100) if payrolls_count > 0 else 0
        }
        
        if payrolls_count == 0:
            validation_results["warnings"].append("Нет данных по зарплатам за указанный период")
        
        # Проверяем данные по товарам
        inventory_movements_count = db.query(InventoryMovement).filter(
            and_(
                InventoryMovement.organization_id == current_user.organization_id,
                InventoryMovement.created_at >= start_date,
                InventoryMovement.created_at <= end_date
            )
        ).count()
        
        validation_results["data_availability"]["inventory"] = {
            "movements_count": inventory_movements_count,
            "has_cost_data": db.query(InventoryMovement).filter(
                and_(
                    InventoryMovement.organization_id == current_user.organization_id,
                    InventoryMovement.created_at >= start_date,
                    InventoryMovement.created_at <= end_date,
                    InventoryMovement.total_cost.isnot(None),
                    InventoryMovement.total_cost > 0
                )
            ).count()
        }
        
        if inventory_movements_count == 0:
            validation_results["warnings"].append("Нет движений по товарам за указанный период")
        
        # Проверяем настройки эквайринга
        acquiring_settings = db.query(AcquiringSettings).filter(
            AcquiringSettings.organization_id == current_user.organization_id
        ).first()
        
        validation_results["data_availability"]["acquiring"] = {
            "configured": acquiring_settings is not None,
            "enabled": acquiring_settings.is_enabled if acquiring_settings else False,
            "providers_count": len(acquiring_settings.providers_config) if acquiring_settings and acquiring_settings.providers_config else 0
        }
        
        if not acquiring_settings or not acquiring_settings.is_enabled:
            validation_results["recommendations"].append("Настройте эквайринг для более точного расчета комиссий")
        
        # Рассчитываем общий балл
        score_factors = [
            (rentals_count > 0, 25),  # Есть аренды
            (paid_rentals_count > 0, 20),  # Есть оплаты
            (payrolls_count > 0, 20),  # Есть зарплаты
            (inventory_movements_count > 0, 15),  # Есть движения товаров
            (acquiring_settings and acquiring_settings.is_enabled, 10),  # Настроен эквайринг
            (len(validation_results["warnings"]) == 0, 10)  # Нет предупреждений
        ]
        
        validation_results["overall_score"] = sum(score for condition, score in score_factors if condition)
        
        # Добавляем рекомендации
        if validation_results["overall_score"] < 70:
            validation_results["recommendations"].append("Рекомендуется дополнить данные перед генерацией отчета")
        elif validation_results["overall_score"] < 90:
            validation_results["recommendations"].append("Данные в основном полные, но есть области для улучшения")
        else:
            validation_results["recommendations"].append("Данные полные и готовы для генерации качественного отчета")
        
        return validation_results
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate data completeness: {str(e)}"
        )