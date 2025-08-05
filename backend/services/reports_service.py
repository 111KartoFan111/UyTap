# backend/services/reports_service.py
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, text
import uuid
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import black, darkblue, gray
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from models.extended_models import (
    Property, Rental, Client, Task, RoomOrder, Payroll, User, Organization,
    PropertyStatus, TaskStatus, OrderStatus, PayrollType, UserRole
)
from schemas.reports import (
    FinancialSummaryReport, PropertyOccupancyReport, 
    EmployeePerformanceReport, ClientAnalyticsReport
)


class ReportsService:
    """Сервис для генерации отчетов и аналитики"""
    
    @staticmethod
    def generate_financial_summary(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> FinancialSummaryReport:
        """Генерация финансового сводного отчета"""
        
        # Доходы от аренды
        rental_revenue = db.query(func.sum(Rental.paid_amount)).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.created_at >= start_date,
                Rental.created_at <= end_date
            )
        ).scalar() or 0.0
        
        # Доходы от заказов в номер
        orders_revenue = db.query(func.sum(RoomOrder.total_amount)).filter(
            and_(
                RoomOrder.organization_id == organization_id,
                RoomOrder.is_paid == True,
                RoomOrder.requested_at >= start_date,
                RoomOrder.requested_at <= end_date
            )
        ).scalar() or 0.0
        
        # Общая выручка
        total_revenue = rental_revenue + orders_revenue
        
        # Расходы на персонал
        staff_expenses = db.query(func.sum(Payroll.net_amount)).filter(
            and_(
                Payroll.organization_id == organization_id,
                Payroll.period_start >= start_date,
                Payroll.period_end <= end_date,
                Payroll.is_paid == True
            )
        ).scalar() or 0.0
        
        # Расходы на материалы (через движения инвентаря)
        from models.extended_models import InventoryMovement
        material_expenses = db.query(func.sum(InventoryMovement.total_cost)).filter(
            and_(
                InventoryMovement.organization_id == organization_id,
                InventoryMovement.movement_type == "out",
                InventoryMovement.created_at >= start_date,
                InventoryMovement.created_at <= end_date
            )
        ).scalar() or 0.0
        
        # Общие расходы
        total_expenses = staff_expenses + material_expenses
        
        # Чистая прибыль
        net_profit = total_revenue - total_expenses
        
        # Загруженность помещений
        occupancy_rate = ReportsService._calculate_occupancy_rate(
            db, organization_id, start_date, end_date
        )
        
        # Количество помещений
        properties_count = db.query(Property).filter(
            Property.organization_id == organization_id
        ).count()
        
        # Активные аренды
        active_rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.is_active == True
            )
        ).count()
        
        return FinancialSummaryReport(
            period_start=start_date,
            period_end=end_date,
            total_revenue=total_revenue,
            rental_revenue=rental_revenue,
            orders_revenue=orders_revenue,
            total_expenses=total_expenses,
            staff_expenses=staff_expenses,
            material_expenses=material_expenses,
            net_profit=net_profit,
            occupancy_rate=occupancy_rate,
            properties_count=properties_count,
            active_rentals=active_rentals
        )
    
    @staticmethod
    def generate_property_occupancy_report(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        property_id: Optional[uuid.UUID] = None
    ) -> List[PropertyOccupancyReport]:
        """Генерация отчета по загруженности помещений"""
        
        query = db.query(Property).filter(Property.organization_id == organization_id)
        
        if property_id:
            query = query.filter(Property.id == property_id)
        
        properties = query.all()
        reports = []
        
        period_days = (end_date - start_date).days
        
        for prop in properties:
            # Находим все аренды для данного помещения в указанный период
            rentals = db.query(Rental).filter(
                and_(
                    Rental.property_id == prop.id,
                    or_(
                        and_(Rental.start_date <= start_date, Rental.end_date > start_date),
                        and_(Rental.start_date < end_date, Rental.end_date >= end_date),
                        and_(Rental.start_date >= start_date, Rental.end_date <= end_date)
                    )
                )
            ).all()
            
            # Вычисляем занятые дни
            occupied_days = 0
            for rental in rentals:
                overlap_start = max(rental.start_date, start_date)
                overlap_end = min(rental.end_date, end_date)
                if overlap_end > overlap_start:
                    occupied_days += (overlap_end - overlap_start).days
            
            # Вычисляем доходы
            revenue = sum(
                rental.paid_amount for rental in rentals
                if rental.start_date >= start_date and rental.end_date <= end_date
            )
            
            # Коэффициент загруженности
            occupancy_rate = (occupied_days / period_days * 100) if period_days > 0 else 0
            
            reports.append(PropertyOccupancyReport(
                property_id=str(prop.id),
                property_name=prop.name,
                property_number=prop.number,
                total_days=period_days,
                occupied_days=occupied_days,
                occupancy_rate=round(occupancy_rate, 2),
                revenue=revenue
            ))
        
        return sorted(reports, key=lambda x: x.occupancy_rate, reverse=True)
    

    @staticmethod
    def generate_employee_performance_report(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        role: Optional[UserRole] = None,
        user_id: Optional[uuid.UUID] = None
    ) -> List[EmployeePerformanceReport]:
        """Генерация отчета по производительности сотрудников"""
        
        query = db.query(User).filter(User.organization_id == organization_id)
        
        if role:
            query = query.filter(User.role == role)
        
        if user_id:
            query = query.filter(User.id == user_id)
        
        employees = query.all()
        reports = []
        
        for employee in employees:
            # Выполненные задачи
            completed_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == employee.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= start_date,
                    Task.completed_at <= end_date
                )
            ).all()
            
            # Среднее время выполнения
            avg_completion_time = None
            if completed_tasks:
                completion_times = [
                    task.actual_duration for task in completed_tasks
                    if task.actual_duration is not None
                ]
                if completion_times:
                    avg_completion_time = sum(completion_times) / len(completion_times)
            
            # Средний рейтинг качества
            quality_ratings = [
                task.quality_rating for task in completed_tasks
                if task.quality_rating is not None
            ]
            avg_quality = sum(quality_ratings) / len(quality_ratings) if quality_ratings else None
            
            # ИСПРАВЛЕНО: Заработок берем из ЗАРПЛАТ за период, а не только из задач
            total_earnings = 0
            
            # 1. Заработок из зарплат за период
            payroll_earnings = db.query(func.sum(Payroll.net_amount)).filter(
                and_(
                    Payroll.user_id == employee.id,
                    Payroll.organization_id == organization_id,
                    # Проверяем пересечение периодов зарплаты с отчетным периодом
                    or_(
                        # Зарплата полностью в периоде
                        and_(
                            Payroll.period_start >= start_date,
                            Payroll.period_end <= end_date
                        ),
                        # Зарплата начинается в периоде
                        and_(
                            Payroll.period_start >= start_date,
                            Payroll.period_start <= end_date
                        ),
                        # Зарплата заканчивается в периоде
                        and_(
                            Payroll.period_end >= start_date,
                            Payroll.period_end <= end_date
                        ),
                        # Зарплата охватывает весь период
                        and_(
                            Payroll.period_start <= start_date,
                            Payroll.period_end >= end_date
                        )
                    ),
                    Payroll.is_paid == True  # Только выплаченные зарплаты
                )
            ).scalar() or 0
            
            # 2. Дополнительный заработок из задач (если есть индивидуальные доплаты)
            task_earnings = sum(task.payment_amount or 0 for task in completed_tasks if task.is_paid)
            
            # 3. Операции зарплаты за период (премии, штрафы и т.д.)
            try:
                from models.extended_models import PayrollOperation
                operation_earnings = db.query(func.sum(PayrollOperation.amount)).filter(
                    and_(
                        PayrollOperation.user_id == employee.id,
                        PayrollOperation.organization_id == organization_id,
                        PayrollOperation.created_at >= start_date,
                        PayrollOperation.created_at <= end_date,
                        PayrollOperation.is_applied == True,
                        PayrollOperation.operation_type.in_(['bonus', 'overtime', 'allowance'])  # Только доходы
                    )
                ).scalar() or 0
            except ImportError:
                operation_earnings = 0
            
            total_earnings = payroll_earnings + task_earnings + operation_earnings
            
            reports.append(EmployeePerformanceReport(
                user_id=str(employee.id),
                user_name=f"{employee.first_name} {employee.last_name}",
                role=employee.role.value,
                tasks_completed=len(completed_tasks),
                average_completion_time=avg_completion_time,
                quality_rating=round(avg_quality, 2) if avg_quality else None,
                earnings=total_earnings
            ))
        
        return sorted(reports, key=lambda x: x.earnings, reverse=True)
    

    @staticmethod
    def get_payroll_period_earnings(
        db: Session,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """
        Получить заработок пользователя за период с учетом пересечения периодов зарплаты
        """
        
        # Находим все зарплаты, которые пересекаются с отчетным периодом
        payrolls = db.query(Payroll).filter(
            and_(
                Payroll.user_id == user_id,
                Payroll.organization_id == organization_id,
                Payroll.is_paid == True,
                # Пересечение периодов
                or_(
                    and_(Payroll.period_start <= end_date, Payroll.period_end >= start_date)
                )
            )
        ).all()
        
        total_earnings = 0
        
        for payroll in payrolls:
            # Вычисляем пересечение периодов
            overlap_start = max(payroll.period_start, start_date)
            overlap_end = min(payroll.period_end, end_date)
            
            if overlap_end > overlap_start:
                # Длительность пересечения
                overlap_days = (overlap_end - overlap_start).days + 1
                # Длительность всего периода зарплаты
                total_days = (payroll.period_end - payroll.period_start).days + 1
                
                # Пропорциональная часть зарплаты
                if total_days > 0:
                    proportion = overlap_days / total_days
                    earnings_for_period = payroll.net_amount * proportion
                    total_earnings += earnings_for_period
                else:
                    # Если период зарплаты = 1 день и он в нашем периоде
                    total_earnings += payroll.net_amount
        
        return total_earnings

    @staticmethod
    def generate_client_analytics_report(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> ClientAnalyticsReport:
        """Генерация аналитического отчета по клиентам"""
        
        # Общее количество клиентов
        total_clients = db.query(Client).filter(
            Client.organization_id == organization_id
        ).count()
        
        # Новые клиенты за период
        new_clients = db.query(Client).filter(
            and_(
                Client.organization_id == organization_id,
                Client.created_at >= start_date,
                Client.created_at <= end_date
            )
        ).count()
        
        # Постоянные клиенты (более одной аренды)
        returning_clients_query = db.query(Client.id).filter(
            Client.organization_id == organization_id
        ).join(Rental).group_by(Client.id).having(func.count(Rental.id) > 1)
        
        returning_clients = returning_clients_query.count()
        
        # Аренды за период
        rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.created_at >= start_date,
                Rental.created_at <= end_date
            )
        ).all()
        
        # Средняя продолжительность пребывания
        avg_stay_duration = 0
        if rentals:
            total_duration = sum(
                (rental.end_date - rental.start_date).days
                for rental in rentals
            )
            avg_stay_duration = total_duration / len(rentals)
        
        # Средние траты
        avg_spending = 0
        if rentals:
            total_spending = sum(rental.total_amount for rental in rentals)
            avg_spending = total_spending / len(rentals)
        
        # Топ клиенты по тратам
        top_clients_data = db.query(
            Client.id,
            Client.first_name,
            Client.last_name,
            func.sum(Rental.total_amount).label('total_spent'),
            func.avg((func.extract('epoch', Rental.end_date) - func.extract('epoch', Rental.start_date)) / 86400).label('avg_duration')
        ).join(Rental).filter(
            and_(
                Client.organization_id == organization_id,
                Rental.created_at >= start_date,
                Rental.created_at <= end_date
            )
        ).group_by(Client.id, Client.first_name, Client.last_name).order_by(
            desc('total_spent')
        ).limit(10).all()
        
        top_clients = [
            {
                "client_id": str(client.id),
                "client_name": f"{client.first_name} {client.last_name}",
                "spending": float(client.total_spent or 0),
                "stay_duration": float(client.avg_duration or 0)
            }
            for client in top_clients_data
        ]
        
        # Источники клиентов
        client_sources = db.query(
            Client.source,
            func.count(Client.id).label('count')
        ).filter(
            and_(
                Client.organization_id == organization_id,
                Client.created_at >= start_date,
                Client.created_at <= end_date
            )
        ).group_by(Client.source).all()
        
        sources_dict = {
            (source.source or "unknown"): source.count 
            for source in client_sources
        }
        
        return ClientAnalyticsReport(
            total_clients=total_clients,
            new_clients=new_clients,
            returning_clients=returning_clients,
            average_stay_duration=round(avg_stay_duration, 2),
            average_spending=round(avg_spending, 2),
            top_clients=top_clients,
            client_sources=sources_dict
        )
    
    @staticmethod
    def get_user_payroll(
        db: Session,
        user_id: uuid.UUID,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, Any]:
        """Получить зарплатную ведомость пользователя"""
        
        payroll = db.query(Payroll).filter(
            and_(
                Payroll.user_id == user_id,
                Payroll.period_start >= period_start,
                Payroll.period_end <= period_end
            )
        ).first()
        
        if not payroll:
            return {
                "period_start": period_start,
                "period_end": period_end,
                "payroll_type": "not_found",
                "base_rate": 0,
                "hours_worked": 0,
                "tasks_completed": 0,
                "tasks_payment": 0,
                "bonus": 0,
                "tips": 0,
                "other_income": 0,
                "deductions": 0,
                "taxes": 0,
                "gross_amount": 0,
                "net_amount": 0,
                "is_paid": False,
                "breakdown": []
            }
        
        # Детализация задач
        tasks = db.query(Task).filter(
            and_(
                Task.assigned_to == user_id,
                Task.status == TaskStatus.COMPLETED,
                Task.is_paid == True,
                Task.completed_at >= period_start,
                Task.completed_at <= period_end
            )
        ).all()
        
        task_breakdown = [
            {
                "task_id": str(task.id),
                "title": task.title,
                "task_type": task.task_type.value,
                "completed_at": task.completed_at,
                "payment_amount": task.payment_amount,
                "quality_rating": task.quality_rating
            }
            for task in tasks
        ]
        
        return {
            "period_start": payroll.period_start,
            "period_end": payroll.period_end,
            "payroll_type": payroll.payroll_type.value,
            "base_rate": payroll.base_rate or 0,
            "hours_worked": payroll.hours_worked,
            "tasks_completed": payroll.tasks_completed,
            "tasks_payment": payroll.tasks_payment,
            "bonus": payroll.bonus,
            "tips": payroll.tips,
            "other_income": payroll.other_income,
            "deductions": payroll.deductions,
            "taxes": payroll.taxes,
            "gross_amount": payroll.gross_amount,
            "net_amount": payroll.net_amount,
            "is_paid": payroll.is_paid,
            "paid_at": payroll.paid_at,
            "breakdown": task_breakdown
        }
    
    @staticmethod
    def generate_dashboard_summary(
        db: Session,
        organization_id: uuid.UUID,
        user_role: UserRole
    ) -> Dict[str, Any]:
        """Генерация сводки для дашборда"""
        
        today = datetime.now(timezone.utc)
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        summary = {
            "organization_stats": {},
            "today_stats": {},
            "month_stats": {},
            "user_specific": {}
        }
        
        # Статистика организации
        summary["organization_stats"] = {
            "total_properties": db.query(Property).filter(
                Property.organization_id == organization_id
            ).count(),
            "active_rentals": db.query(Rental).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.is_active == True
                )
            ).count(),
            "total_clients": db.query(Client).filter(
                Client.organization_id == organization_id
            ).count(),
            "total_staff": db.query(User).filter(
                User.organization_id == organization_id
            ).count()
        }
        
        # Статистика за сегодня
        today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        summary["today_stats"] = {
            "new_bookings": db.query(Rental).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.created_at >= today_start,
                    Rental.created_at < today_end
                )
            ).count(),
            "check_ins": db.query(Rental).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.check_in_time >= today_start,
                    Rental.check_in_time < today_end
                )
            ).count(),
            "check_outs": db.query(Rental).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.check_out_time >= today_start,
                    Rental.check_out_time < today_end
                )
            ).count(),
            "completed_tasks": db.query(Task).filter(
                and_(
                    Task.organization_id == organization_id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= today_start,
                    Task.completed_at < today_end
                )
            ).count()
        }
        
        # Статистика за месяц
        summary["month_stats"] = {
            "revenue": db.query(func.sum(Rental.paid_amount)).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.created_at >= month_start
                )
            ).scalar() or 0,
            "new_clients": db.query(Client).filter(
                and_(
                    Client.organization_id == organization_id,
                    Client.created_at >= month_start
                )
            ).count(),
            "occupancy_rate": ReportsService._calculate_occupancy_rate(
                db, organization_id, month_start, today
            )
        }
        
        # Специфичная для роли информация
        if user_role in [UserRole.CLEANER, UserRole.TECHNICAL_STAFF]:
            # Для исполнителей - их задачи
            user_tasks = db.query(Task).filter(
                and_(
                    Task.organization_id == organization_id,
                    Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
                )
            ).count()
            
            summary["user_specific"] = {
                "pending_tasks": user_tasks,
                "completed_today": db.query(Task).filter(
                    and_(
                        Task.organization_id == organization_id,
                        Task.status == TaskStatus.COMPLETED,
                        Task.completed_at >= today_start,
                        Task.completed_at < today_end
                    )
                ).count()
            }
        
        elif user_role == UserRole.ACCOUNTANT:
            # Для бухгалтера - финансовая информация
            summary["user_specific"] = {
                "unpaid_invoices": db.query(Rental).filter(
                    and_(
                        Rental.organization_id == organization_id,
                        Rental.paid_amount < Rental.total_amount
                    )
                ).count(),
                "pending_payrolls": db.query(Payroll).filter(
                    and_(
                        Payroll.organization_id == organization_id,
                        Payroll.is_paid == False
                    )
                ).count()
            }
        
        return summary
    
    @staticmethod
    def _calculate_occupancy_rate(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """Вычислить коэффициент загруженности помещений"""
        
        # Общее количество помещений
        total_properties = db.query(Property).filter(
            Property.organization_id == organization_id
        ).count()
        
        if total_properties == 0:
            return 0.0
        
        # Общее количество дней в периоде
        total_days = (end_date - start_date).days
        if total_days <= 0:
            return 0.0
        
        # Общее количество доступных дней (помещения × дни)
        total_available_days = total_properties * total_days
        
        # Занятые дни
        rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                or_(
                    and_(Rental.start_date <= start_date, Rental.end_date > start_date),
                    and_(Rental.start_date < end_date, Rental.end_date >= end_date),
                    and_(Rental.start_date >= start_date, Rental.end_date <= end_date)
                )
            )
        ).all()
        
        occupied_days = 0
        for rental in rentals:
            overlap_start = max(rental.start_date, start_date)
            overlap_end = min(rental.end_date, end_date)
            if overlap_end > overlap_start:
                occupied_days += (overlap_end - overlap_start).days
        
        # Коэффициент загруженности в процентах
        return round((occupied_days / total_available_days) * 100, 2)
    
    @staticmethod
    def generate_financial_pdf(
        report: FinancialSummaryReport,
        start_date: datetime,
        end_date: datetime
    ) -> bytes:
        """Генерация PDF финансового отчета"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Заголовок
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            textColor=darkblue
        )
        
        story.append(Paragraph("Финансовый отчет", title_style))
        story.append(Paragraph(f"Период: {start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Таблица с данными
        data = [
            ['Показатель', 'Сумма (₸)'],
            ['Общая выручка', f"{report.total_revenue:,.2f}"],
            ['Выручка от аренды', f"{report.rental_revenue:,.2f}"],
            ['Выручка от заказов', f"{report.orders_revenue:,.2f}"],
            ['Общие расходы', f"{report.total_expenses:,.2f}"],
            ['Расходы на персонал', f"{report.staff_expenses:,.2f}"],
            ['Расходы на материалы', f"{report.material_expenses:,.2f}"],
            ['Чистая прибыль', f"{report.net_profit:,.2f}"],
        ]
        
        table = Table(data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        story.append(table)
        story.append(Spacer(1, 20))
        
        # Дополнительная информация
        additional_data = [
            ['Показатель', 'Значение'],
            ['Загруженность помещений', f"{report.occupancy_rate:.1f}%"],
            ['Количество помещений', str(report.properties_count)],
            ['Активные аренды', str(report.active_rentals)],
        ]
        
        additional_table = Table(additional_data, colWidths=[3*inch, 2*inch])
        additional_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightblue),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        story.append(additional_table)
        
        # Построение документа
        doc.build(story)
        buffer.seek(0)
        
        return buffer.getvalue()
    
    @staticmethod
    def export_data_to_excel(
        db: Session,
        organization_id: uuid.UUID,
        data_type: str,
        start_date: datetime,
        end_date: datetime
    ) -> bytes:
        """Экспорт данных в Excel"""
        
        output = io.BytesIO()
        
        if data_type == "rentals":
            # Экспорт аренд
            rentals = db.query(Rental).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.created_at >= start_date,
                    Rental.created_at <= end_date
                )
            ).all()
            
            import xlsxwriter
            workbook = xlsxwriter.Workbook(output)
            worksheet = workbook.add_worksheet("Аренды")
            
            # Заголовки
            headers = [
                'ID', 'Помещение', 'Клиент', 'Тип аренды', 'Дата начала', 
                'Дата окончания', 'Сумма', 'Оплачено', 'Статус'
            ]
            
            for col, header in enumerate(headers):
                worksheet.write(0, col, header)
            
            # Данные
            for row, rental in enumerate(rentals, 1):
                worksheet.write(row, 0, str(rental.id))
                worksheet.write(row, 1, rental.property.name if rental.property else "")
                worksheet.write(row, 2, f"{rental.client.first_name} {rental.client.last_name}" if rental.client else "")
                worksheet.write(row, 3, rental.rental_type.value)
                worksheet.write(row, 4, rental.start_date.strftime('%d.%m.%Y'))
                worksheet.write(row, 5, rental.end_date.strftime('%d.%m.%Y'))
                worksheet.write(row, 6, rental.total_amount)
                worksheet.write(row, 7, rental.paid_amount)
                worksheet.write(row, 8, "Активна" if rental.is_active else "Завершена")
            
            workbook.close()
        
        elif data_type == "tasks":
            # Экспорт задач
            tasks = db.query(Task).filter(
                and_(
                    Task.organization_id == organization_id,
                    Task.created_at >= start_date,
                    Task.created_at <= end_date
                )
            ).all()
            
            import xlsxwriter
            workbook = xlsxwriter.Workbook(output)
            worksheet = workbook.add_worksheet("Задачи")
            
            # Заголовки
            headers = [
                'ID', 'Название', 'Тип', 'Приоритет', 'Статус', 'Исполнитель',
                'Создано', 'Завершено', 'Оплата', 'Рейтинг'
            ]
            
            for col, header in enumerate(headers):
                worksheet.write(0, col, header)
            
            # Данные
            for row, task in enumerate(tasks, 1):
                worksheet.write(row, 0, str(task.id))
                worksheet.write(row, 1, task.title)
                worksheet.write(row, 2, task.task_type.value)
                worksheet.write(row, 3, task.priority.value)
                worksheet.write(row, 4, task.status.value)
                worksheet.write(row, 5, f"{task.assignee.first_name} {task.assignee.last_name}" if task.assignee else "")
                worksheet.write(row, 6, task.created_at.strftime('%d.%m.%Y %H:%M'))
                worksheet.write(row, 7, task.completed_at.strftime('%d.%m.%Y %H:%M') if task.completed_at else "")
                worksheet.write(row, 8, task.payment_amount or 0)
                worksheet.write(row, 9, task.quality_rating or "")
            
            workbook.close()
        
        elif data_type == "clients":
            # Экспорт клиентов
            clients = db.query(Client).filter(
                and_(
                    Client.organization_id == organization_id,
                    Client.created_at >= start_date,
                    Client.created_at <= end_date
                )
            ).all()
            
            import xlsxwriter
            workbook = xlsxwriter.Workbook(output)
            worksheet = workbook.add_worksheet("Клиенты")
            
            # Заголовки
            headers = [
                'ID', 'Имя', 'Фамилия', 'Телефон', 'Email', 'Источник',
                'Всего аренд', 'Общие траты', 'Дата регистрации', 'Последний визит'
            ]
            
            for col, header in enumerate(headers):
                worksheet.write(0, col, header)
            
            # Данные
            for row, client in enumerate(clients, 1):
                worksheet.write(row, 0, str(client.id))
                worksheet.write(row, 1, client.first_name)
                worksheet.write(row, 2, client.last_name)
                worksheet.write(row, 3, client.phone or "")
                worksheet.write(row, 4, client.email or "")
                worksheet.write(row, 5, client.source or "")
                worksheet.write(row, 6, client.total_rentals)
                worksheet.write(row, 7, client.total_spent)
                worksheet.write(row, 8, client.created_at.strftime('%d.%m.%Y'))
                worksheet.write(row, 9, client.last_visit.strftime('%d.%m.%Y') if client.last_visit else "")
            
            workbook.close()
        
        elif data_type == "payroll":
            # Экспорт зарплат
            payrolls = db.query(Payroll).filter(
                and_(
                    Payroll.organization_id == organization_id,
                    Payroll.period_start >= start_date,
                    Payroll.period_end <= end_date
                )
            ).all()
            
            import xlsxwriter
            workbook = xlsxwriter.Workbook(output)
            worksheet = workbook.add_worksheet("Зарплаты")
            
            # Заголовки
            headers = [
                'Сотрудник', 'Период начала', 'Период окончания', 'Тип оплаты',
                'Базовая ставка', 'Часы', 'Задач выполнено', 'К доплате за задачи',
                'Премия', 'Чаевые', 'Другой доход', 'Вычеты', 'Налоги',
                'Брутто', 'Нетто', 'Выплачено'
            ]
            
            for col, header in enumerate(headers):
                worksheet.write(0, col, header)
            
            # Данные
            for row, payroll in enumerate(payrolls, 1):
                worksheet.write(row, 0, f"{payroll.user.first_name} {payroll.user.last_name}" if payroll.user else "")
                worksheet.write(row, 1, payroll.period_start.strftime('%d.%m.%Y'))
                worksheet.write(row, 2, payroll.period_end.strftime('%d.%m.%Y'))
                worksheet.write(row, 3, payroll.payroll_type.value)
                worksheet.write(row, 4, payroll.base_rate or 0)
                worksheet.write(row, 5, payroll.hours_worked)
                worksheet.write(row, 6, payroll.tasks_completed)
                worksheet.write(row, 7, payroll.tasks_payment)
                worksheet.write(row, 8, payroll.bonus)
                worksheet.write(row, 9, payroll.tips)
                worksheet.write(row, 10, payroll.other_income)
                worksheet.write(row, 11, payroll.deductions)
                worksheet.write(row, 12, payroll.taxes)
                worksheet.write(row, 13, payroll.gross_amount)
                worksheet.write(row, 14, payroll.net_amount)
                worksheet.write(row, 15, "Да" if payroll.is_paid else "Нет")
            
            workbook.close()
        
        output.seek(0)
        return output.getvalue()
    
    @staticmethod
    def generate_monthly_summary_report(
        db: Session,
        organization_id: uuid.UUID,
        year: int,
        month: int
    ) -> Dict[str, Any]:
        """Генерация месячного сводного отчета"""
        
        # Определяем даты начала и конца месяца
        start_date = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        # Финансовые показатели
        financial = ReportsService.generate_financial_summary(
            db, organization_id, start_date, end_date
        )
        
        # Статистика по помещениям
        properties_stats = {}
        properties = db.query(Property).filter(
            Property.organization_id == organization_id
        ).all()
        
        for prop in properties:
            rentals_count = db.query(Rental).filter(
                and_(
                    Rental.property_id == prop.id,
                    Rental.created_at >= start_date,
                    Rental.created_at < end_date
                )
            ).count()
            
            revenue = db.query(func.sum(Rental.paid_amount)).filter(
                and_(
                    Rental.property_id == prop.id,
                    Rental.created_at >= start_date,
                    Rental.created_at < end_date
                )
            ).scalar() or 0
            
            properties_stats[prop.name] = {
                "rentals_count": rentals_count,
                "revenue": revenue,
                "status": prop.status.value
            }
        
        # Статистика по персоналу
        staff_stats = {}
        staff_members = db.query(User).filter(
            User.organization_id == organization_id
        ).all()
        
        for staff in staff_members:
            completed_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == staff.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= start_date,
                    Task.completed_at < end_date
                )
            ).count()
            
            payroll = db.query(Payroll).filter(
                and_(
                    Payroll.user_id == staff.id,
                    Payroll.period_start >= start_date,
                    Payroll.period_end < end_date
                )
            ).first()
            
            staff_stats[f"{staff.first_name} {staff.last_name}"] = {
                "role": staff.role.value,
                "tasks_completed": completed_tasks,
                "salary": payroll.net_amount if payroll else 0
            }
        
        # Топ клиенты месяца
        top_clients = db.query(
            Client.first_name,
            Client.last_name,
            func.sum(Rental.total_amount).label('total_spent')
        ).join(Rental).filter(
            and_(
                Client.organization_id == organization_id,
                Rental.created_at >= start_date,
                Rental.created_at < end_date
            )
        ).group_by(Client.id, Client.first_name, Client.last_name).order_by(
            desc('total_spent')
        ).limit(5).all()
        
        top_clients_data = [
            {
                "name": f"{client.first_name} {client.last_name}",
                "spent": float(client.total_spent)
            }
            for client in top_clients
        ]
        
        # Сравнение с предыдущим месяцем
        prev_month = month - 1 if month > 1 else 12
        prev_year = year if month > 1 else year - 1
        prev_start = datetime(prev_year, prev_month, 1, tzinfo=timezone.utc)
        
        if prev_month == 12:
            prev_end = datetime(prev_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            prev_end = datetime(prev_year, prev_month + 1, 1, tzinfo=timezone.utc)
        
        prev_revenue = db.query(func.sum(Rental.paid_amount)).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.created_at >= prev_start,
                Rental.created_at < prev_end
            )
        ).scalar() or 0
        
        revenue_change = ((financial.total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        
        return {
            "period": {
                "year": year,
                "month": month,
                "start_date": start_date,
                "end_date": end_date
            },
            "financial_summary": {
                "total_revenue": financial.total_revenue,
                "total_expenses": financial.total_expenses,
                "net_profit": financial.net_profit,
                "occupancy_rate": financial.occupancy_rate,
                "revenue_change_percent": round(revenue_change, 2)
            },
            "properties_performance": properties_stats,
            "staff_performance": staff_stats,
            "top_clients": top_clients_data,
            "key_metrics": {
                "new_bookings": db.query(Rental).filter(
                    and_(
                        Rental.organization_id == organization_id,
                        Rental.created_at >= start_date,
                        Rental.created_at < end_date
                    )
                ).count(),
                "new_clients": db.query(Client).filter(
                    and_(
                        Client.organization_id == organization_id,
                        Client.created_at >= start_date,
                        Client.created_at < end_date
                    )
                ).count(),
                "completed_tasks": db.query(Task).filter(
                    and_(
                        Task.organization_id == organization_id,
                        Task.status == TaskStatus.COMPLETED,
                        Task.completed_at >= start_date,
                        Task.completed_at < end_date
                    )
                ).count()
            }
        }
    
    @staticmethod
    def generate_custom_report(
        db: Session,
        organization_id: uuid.UUID,
        report_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Генерация пользовательского отчета по конфигурации"""
        
        start_date = datetime.fromisoformat(report_config["start_date"])
        end_date = datetime.fromisoformat(report_config["end_date"])
        
        report_data = {
            "config": report_config,
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "sections": {}
        }
        
        # Финансовый раздел
        if report_config.get("include_financial", False):
            financial = ReportsService.generate_financial_summary(
                db, organization_id, start_date, end_date
            )
            report_data["sections"]["financial"] = financial.dict()
        
        # Раздел помещений
        if report_config.get("include_properties", False):
            property_filter = report_config.get("property_filter")
            
            if property_filter and property_filter.get("property_ids"):
                property_ids = [uuid.UUID(pid) for pid in property_filter["property_ids"]]
                properties_report = []
                
                for prop_id in property_ids:
                    occupancy = ReportsService.generate_property_occupancy_report(
                        db, organization_id, start_date, end_date, prop_id
                    )
                    if occupancy:
                        properties_report.extend(occupancy)
            else:
                properties_report = ReportsService.generate_property_occupancy_report(
                    db, organization_id, start_date, end_date
                )
            
            report_data["sections"]["properties"] = [prop.dict() for prop in properties_report]
        
        # Раздел персонала
        if report_config.get("include_staff", False):
            staff_filter = report_config.get("staff_filter")
            role_filter = None
            user_filter = None
            
            if staff_filter:
                if staff_filter.get("role"):
                    role_filter = UserRole(staff_filter["role"])
                if staff_filter.get("user_id"):
                    user_filter = uuid.UUID(staff_filter["user_id"])
            
            staff_report = ReportsService.generate_employee_performance_report(
                db, organization_id, start_date, end_date, role_filter, user_filter
            )
            report_data["sections"]["staff"] = [emp.dict() for emp in staff_report]
        
        # Раздел клиентов
        if report_config.get("include_clients", False):
            clients_report = ReportsService.generate_client_analytics_report(
                db, organization_id, start_date, end_date
            )
            report_data["sections"]["clients"] = clients_report.dict()
        
        # Дополнительные метрики
        if report_config.get("include_metrics", False):
            metrics = {
                "total_bookings": db.query(Rental).filter(
                    and_(
                        Rental.organization_id == organization_id,
                        Rental.created_at >= start_date,
                        Rental.created_at <= end_date
                    )
                ).count(),
                "average_booking_value": db.query(func.avg(Rental.total_amount)).filter(
                    and_(
                        Rental.organization_id == organization_id,
                        Rental.created_at >= start_date,
                        Rental.created_at <= end_date
                    )
                ).scalar() or 0,
                "cancellation_rate": ReportsService._calculate_cancellation_rate(
                    db, organization_id, start_date, end_date
                ),
                "customer_satisfaction": ReportsService._calculate_avg_satisfaction(
                    db, organization_id, start_date, end_date
                )
            }
            report_data["sections"]["metrics"] = metrics
        
        return report_data
    
    @staticmethod
    def _calculate_cancellation_rate(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """Вычислить процент отмен"""
        
        total_bookings = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.created_at >= start_date,
                Rental.created_at <= end_date
            )
        ).count()
        
        if total_bookings == 0:
            return 0.0
        
        cancelled_bookings = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.created_at >= start_date,
                Rental.created_at <= end_date,
                Rental.is_active == False,
                Rental.notes.like('%Отменено%')
            )
        ).count()
        
        return round((cancelled_bookings / total_bookings) * 100, 2)
    
    @staticmethod
    def _calculate_avg_satisfaction(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Optional[float]:
        """Вычислить среднее удовлетворение клиентов"""
        
        # Основываемся на рейтингах качества выполненных задач
        avg_rating = db.query(func.avg(Task.quality_rating)).filter(
            and_(
                Task.organization_id == organization_id,
                Task.status == TaskStatus.COMPLETED,
                Task.quality_rating.isnot(None),
                Task.completed_at >= start_date,
                Task.completed_at <= end_date
            )
        ).scalar()
        
        return round(avg_rating, 2) if avg_rating else None
    
    @staticmethod
    def generate_forecast_report(
        db: Session,
        organization_id: uuid.UUID,
        forecast_months: int = 3
    ) -> Dict[str, Any]:
        """Генерация прогнозного отчета"""
        
        # Анализируем данные за последние 12 месяцев для прогноза
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=365)
        
        # Исторические данные по месяцам
        monthly_data = []
        current_date = start_date
        
        while current_date < end_date:
            month_end = current_date.replace(day=28) + timedelta(days=4)
            month_end = month_end - timedelta(days=month_end.day)
            
            month_revenue = db.query(func.sum(Rental.paid_amount)).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.created_at >= current_date,
                    Rental.created_at <= month_end
                )
            ).scalar() or 0
            
            month_bookings = db.query(Rental).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.created_at >= current_date,
                    Rental.created_at <= month_end
                )
            ).count()
            
            monthly_data.append({
                "month": current_date.strftime("%Y-%m"),
                "revenue": month_revenue,
                "bookings": month_bookings
            })
            
            # Переход к следующему месяцу
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        # Простой прогноз на основе линейного тренда
        if len(monthly_data) >= 3:
            recent_months = monthly_data[-3:]
            avg_revenue = sum(m["revenue"] for m in recent_months) / len(recent_months)
            avg_bookings = sum(m["bookings"] for m in recent_months) / len(recent_months)
            
            # Тренд (упрощенный)
            revenue_trend = (recent_months[-1]["revenue"] - recent_months[0]["revenue"]) / len(recent_months)
            bookings_trend = (recent_months[-1]["bookings"] - recent_months[0]["bookings"]) / len(recent_months)
        else:
            avg_revenue = monthly_data[-1]["revenue"] if monthly_data else 0
            avg_bookings = monthly_data[-1]["bookings"] if monthly_data else 0
            revenue_trend = 0
            bookings_trend = 0
        
        # Прогноз на следующие месяцы
        forecast_data = []
        base_revenue = avg_revenue
        base_bookings = avg_bookings
        
        for i in range(1, forecast_months + 1):
            # Учитываем сезонность (упрощенно)
            forecast_month = (end_date.month + i - 1) % 12 + 1
            seasonal_multiplier = ReportsService._get_seasonal_multiplier_for_month(forecast_month)
            
            predicted_revenue = (base_revenue + revenue_trend * i) * seasonal_multiplier
            predicted_bookings = int((base_bookings + bookings_trend * i) * seasonal_multiplier)
            
            forecast_data.append({
                "month": forecast_month,
                "predicted_revenue": max(0, predicted_revenue),
                "predicted_bookings": max(0, predicted_bookings)
            })
        
        return {
            "historical_data": monthly_data,
            "forecast_data": forecast_data,
            "analysis": {
                "revenue_trend": "increasing" if revenue_trend > 0 else "decreasing" if revenue_trend < 0 else "stable",
                "bookings_trend": "increasing" if bookings_trend > 0 else "decreasing" if bookings_trend < 0 else "stable",
                "avg_monthly_revenue": avg_revenue,
                "avg_monthly_bookings": avg_bookings
            },
            "recommendations": ReportsService._generate_recommendations(
                monthly_data, forecast_data, revenue_trend, bookings_trend
            )
        }
    
    @staticmethod
    def _get_seasonal_multiplier_for_month(month: int) -> float:
        """Получить сезонный коэффициент для месяца"""
        # Высокий сезон: июнь-август
        if month in [6, 7, 8]:
            return 1.3
        # Средний сезон: апрель-май, сентябрь-октябрь
        elif month in [4, 5, 9, 10]:
            return 1.1
        # Низкий сезон: остальные месяцы
        else:
            return 0.8
    
    @staticmethod
    def _generate_recommendations(
        historical_data: List[Dict],
        forecast_data: List[Dict],
        revenue_trend: float,
        bookings_trend: float
    ) -> List[str]:
        """Генерация рекомендаций на основе данных"""
        
        recommendations = []
        
        if revenue_trend < 0:
            recommendations.append("Рассмотрите пересмотр ценовой политики или улучшение маркетинга")
            recommendations.append("Проанализируйте причины снижения доходов")
        
        if bookings_trend < 0:
            recommendations.append("Усильте маркетинговые усилия для привлечения клиентов")
            recommendations.append("Рассмотрите специальные предложения и акции")
        
        if len(historical_data) > 6:
            recent_avg = sum(m["revenue"] for m in historical_data[-3:]) / 3
            older_avg = sum(m["revenue"] for m in historical_data[-6:-3]) / 3
            
            if recent_avg > older_avg * 1.1:
                recommendations.append("Отличная динамика роста! Продолжайте текущую стратегию")
            elif recent_avg < older_avg * 0.9:
                recommendations.append("Необходимо принять меры для восстановления роста")
        
        # Проверяем сезонность
        summer_months = [m for m in historical_data if int(m["month"].split("-")[1]) in [6, 7, 8]]
        winter_months = [m for m in historical_data if int(m["month"].split("-")[1]) in [12, 1, 2]]
        
        if summer_months and winter_months:
            summer_avg = sum(m["revenue"] for m in summer_months) / len(summer_months)
            winter_avg = sum(m["revenue"] for m in winter_months) / len(winter_months)
            
            if summer_avg > winter_avg * 1.5:
                recommendations.append("Высокая сезонность - рассмотрите специальные предложения в низкий сезон")
        
        if not recommendations:
            recommendations.append("Показатели стабильны - продолжайте мониторинг ключевых метрик")
        
        return recommendations
    @staticmethod
    def export_property_occupancy_excel(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        property_id: Optional[uuid.UUID] = None
    ) -> bytes:
        """Экспорт отчета по загруженности помещений в Excel"""
        
        # Генерируем отчет
        report = ReportsService.generate_property_occupancy_report(
            db, organization_id, start_date, end_date, property_id
        )
        
        output = io.BytesIO()
        
        try:
            import xlsxwriter
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
            
            # Заголовок
            worksheet.write('A1', 'Отчет по загруженности помещений', header_format)
            worksheet.write('A2', f'Период: {start_date.strftime("%d.%m.%Y")} - {end_date.strftime("%d.%m.%Y")}')
            
            # Заголовки таблицы
            headers = ['Помещение', 'Номер', 'Всего дней', 'Занято дней', 'Загруженность %', 'Выручка']
            for col, header in enumerate(headers):
                worksheet.write(3, col, header, header_format)
            
            # Данные
            for row, prop in enumerate(report, 4):
                worksheet.write(row, 0, prop.property_name)
                worksheet.write(row, 1, prop.property_number)
                worksheet.write(row, 2, prop.total_days)
                worksheet.write(row, 3, prop.occupied_days)
                worksheet.write(row, 4, prop.occupancy_rate / 100, percent_format)
                worksheet.write(row, 5, prop.revenue, money_format)
            
            # Итоговая строка
            if report:
                total_row = len(report) + 4
                worksheet.write(total_row, 0, 'ИТОГО:', header_format)
                worksheet.write(total_row, 1, '', header_format)
                worksheet.write(total_row, 2, sum(p.total_days for p in report), header_format)
                worksheet.write(total_row, 3, sum(p.occupied_days for p in report), header_format)
                avg_occupancy = sum(p.occupancy_rate for p in report) / len(report) if report else 0
                worksheet.write(total_row, 4, avg_occupancy / 100, percent_format)
                worksheet.write(total_row, 5, sum(p.revenue for p in report), money_format)
            
            # Автоширина колонок
            worksheet.set_column('A:A', 25)
            worksheet.set_column('B:B', 12)
            worksheet.set_column('C:D', 15)
            worksheet.set_column('E:E', 18)
            worksheet.set_column('F:F', 18)
            
            workbook.close()
            output.seek(0)
            return output.getvalue()
            
        except ImportError:
            raise Exception("xlsxwriter не установлен")
        except Exception as e:
            raise Exception(f"Ошибка создания Excel файла: {str(e)}")

    @staticmethod
    def export_client_analytics_excel(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> bytes:
        """Экспорт клиентской аналитики в Excel"""
        
        # Генерируем отчет
        report = ReportsService.generate_client_analytics_report(
            db, organization_id, start_date, end_date
        )
        
        output = io.BytesIO()
        
        try:
            import xlsxwriter
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
            
            # Заголовок
            worksheet.write('A1', 'Клиентская аналитика', header_format)
            worksheet.write('A2', f'Период: {start_date.strftime("%d.%m.%Y")} - {end_date.strftime("%d.%m.%Y")}')
            
            # Основная статистика
            row = 4
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
                worksheet.write(row, 1, '', header_format)
                worksheet.write(row, 2, '', header_format)
                
                row += 1
                worksheet.write(row, 0, 'Имя клиента', header_format)
                worksheet.write(row, 1, 'Потрачено', header_format)
                worksheet.write(row, 2, 'Средняя длительность (дни)', header_format)
                
                for client in report.top_clients[:10]:
                    row += 1
                    worksheet.write(row, 0, client['client_name'])
                    worksheet.write(row, 1, client['spending'], money_format)
                    worksheet.write(row, 2, f"{client['stay_duration']:.1f}")
            
            # Источники клиентов
            if report.client_sources:
                row += 3
                worksheet.write(row, 0, 'Источники клиентов', header_format)
                worksheet.write(row, 1, '', header_format)
                
                row += 1
                worksheet.write(row, 0, 'Источник', header_format)
                worksheet.write(row, 1, 'Количество клиентов', header_format)
                
                for source, count in report.client_sources.items():
                    row += 1
                    worksheet.write(row, 0, source if source != 'unknown' else 'Неизвестно')
                    worksheet.write(row, 1, count)
            
            # Автоширина колонок
            worksheet.set_column('A:A', 35)
            worksheet.set_column('B:B', 20)
            worksheet.set_column('C:C', 25)
            
            workbook.close()
            output.seek(0)
            return output.getvalue()
            
        except ImportError:
            raise Exception("xlsxwriter не установлен")
        except Exception as e:
            raise Exception(f"Ошибка создания Excel файла: {str(e)}")

    @staticmethod
    def export_employee_performance_excel(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        role: Optional[UserRole] = None,
        user_id: Optional[uuid.UUID] = None
    ) -> bytes:
        """Экспорт отчета по производительности сотрудников в Excel"""
        
        # Генерируем отчет
        report = ReportsService.generate_employee_performance_report(
            db, organization_id, start_date, end_date, role, user_id
        )
        
        output = io.BytesIO()
        
        try:
            import xlsxwriter
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
            number_format = workbook.add_format({'num_format': '0.00'})
            
            # Заголовок
            worksheet.write('A1', 'Отчет по производительности сотрудников', header_format)
            worksheet.write('A2', f'Период: {start_date.strftime("%d.%m.%Y")} - {end_date.strftime("%d.%m.%Y")}')
            
            # Заголовки таблицы
            headers = ['Сотрудник', 'Роль', 'Задач выполнено', 'Среднее время (мин)', 'Рейтинг качества', 'Заработано']
            for col, header in enumerate(headers):
                worksheet.write(3, col, header, header_format)
            
            # Данные
            for row, emp in enumerate(report, 4):
                worksheet.write(row, 0, emp.user_name)
                
                # Переводим роли на русский
                role_translations = {
                    'admin': 'Администратор',
                    'manager': 'Менеджер',
                    'technical_staff': 'Технический персонал',
                    'cleaner': 'Уборщик',
                    'accountant': 'Бухгалтер',
                    'storekeeper': 'Кладовщик'
                }
                worksheet.write(row, 1, role_translations.get(emp.role, emp.role))
                worksheet.write(row, 2, emp.tasks_completed)
                worksheet.write(row, 3, emp.average_completion_time or 0, number_format)
                worksheet.write(row, 4, emp.quality_rating or 0, number_format)
                worksheet.write(row, 5, emp.earnings, money_format)
            
            # Итоговая строка
            if report:
                total_row = len(report) + 4
                worksheet.write(total_row, 0, 'ИТОГО:', header_format)
                worksheet.write(total_row, 1, f'{len(report)} сотрудников', header_format)
                worksheet.write(total_row, 2, sum(e.tasks_completed for e in report), header_format)
                
                # Средние значения
                avg_time = sum(e.average_completion_time or 0 for e in report) / len(report) if report else 0
                worksheet.write(total_row, 3, avg_time, number_format)
                
                ratings = [e.quality_rating for e in report if e.quality_rating]
                avg_rating = sum(ratings) / len(ratings) if ratings else 0
                worksheet.write(total_row, 4, avg_rating, number_format)
                
                worksheet.write(total_row, 5, sum(e.earnings for e in report), money_format)
            
            # Автоширина колонок
            worksheet.set_column('A:A', 25)
            worksheet.set_column('B:B', 20)
            worksheet.set_column('C:C', 18)
            worksheet.set_column('D:D', 20)
            worksheet.set_column('E:E', 18)
            worksheet.set_column('F:F', 18)
            
            workbook.close()
            output.seek(0)
            return output.getvalue()
            
        except ImportError:
            raise Exception("xlsxwriter не установлен")
        except Exception as e:
            raise Exception(f"Ошибка создания Excel файла: {str(e)}")

    # Также добавить проверку на наличие данных
    @staticmethod
    def validate_export_data(report_data, report_type: str):

        """Валидация данных перед экспортом"""
        
        if not report_data:
            raise ValueError(f"Нет данных для экспорта отчета '{report_type}'")
        
        if isinstance(report_data, list) and len(report_data) == 0:
            raise ValueError(f"Отчет '{report_type}' не содержит данных за указанный период")
        
        return True
