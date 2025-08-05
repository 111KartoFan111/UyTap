# backend/services/reports_service.py - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
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
    """Исправленный сервис для генерации отчетов и аналитики"""
    
    @staticmethod
    def debug_report_data(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Отладочная информация о данных для отчетов"""
        
        debug_info = {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "duration_days": (end_date - start_date).days
            },
            "data_counts": {},
            "sample_data": {},
            "date_ranges": {}
        }
        
        # Проверяем все основные таблицы
        tables_to_check = [
            ("rentals", Rental),
            ("clients", Client),
            ("properties", Property),
            ("tasks", Task),
            ("room_orders", RoomOrder),
            ("payrolls", Payroll),
            ("users", User)
        ]
        
        for table_name, model in tables_to_check:
            # Общее количество записей в организации
            total_count = db.query(model).filter(
                model.organization_id == organization_id
            ).count()
            
            debug_info["data_counts"][f"{table_name}_total"] = total_count
            
            if hasattr(model, 'created_at'):
                # Записи за период
                period_count = db.query(model).filter(
                    and_(
                        model.organization_id == organization_id,
                        model.created_at >= start_date,
                        model.created_at <= end_date
                    )
                ).count()
                debug_info["data_counts"][f"{table_name}_period"] = period_count
                
                # Диапазон дат в таблице
                date_range = db.query(
                    func.min(model.created_at),
                    func.max(model.created_at)
                ).filter(model.organization_id == organization_id).first()
                
                debug_info["date_ranges"][table_name] = {
                    "min_date": date_range[0].isoformat() if date_range[0] else None,
                    "max_date": date_range[1].isoformat() if date_range[1] else None
                }
                
                # Последние 3 записи для примера
                sample_records = db.query(model).filter(
                    model.organization_id == organization_id
                ).order_by(desc(model.created_at)).limit(3).all()
                
                debug_info["sample_data"][table_name] = [
                    {
                        "id": str(record.id),
                        "created_at": record.created_at.isoformat() if record.created_at else None,
                        "details": ReportsService._get_record_details(record)
                    }
                    for record in sample_records
                ]
        
        # Специальная проверка для платежей (paid_amount в аренде)
        rental_payments = db.query(
            func.sum(Rental.paid_amount),
            func.count(Rental.id),
            func.avg(Rental.paid_amount)
        ).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.paid_amount > 0
            )
        ).first()
        
        debug_info["payments"] = {
            "total_paid_amount": float(rental_payments[0] or 0),
            "rentals_with_payments": rental_payments[1] or 0,
            "average_payment": float(rental_payments[2] or 0)
        }
        
        return debug_info
    
    @staticmethod
    def _get_record_details(record) -> Dict[str, Any]:
        """Получить детали записи для отладки"""
        details = {}
        
        if isinstance(record, Rental):
            details = {
                "total_amount": record.total_amount,
                "paid_amount": record.paid_amount,
                "is_active": record.is_active,
                "start_date": record.start_date.isoformat() if record.start_date else None,
                "end_date": record.end_date.isoformat() if record.end_date else None
            }
        elif isinstance(record, Client):
            details = {
                "name": f"{record.first_name} {record.last_name}",
                "total_rentals": record.total_rentals,
                "total_spent": record.total_spent
            }
        elif isinstance(record, Property):
            details = {
                "name": record.name,
                "status": record.status.value if record.status else None,
                "is_active": record.is_active
            }
        elif isinstance(record, Task):
            details = {
                "title": record.title,
                "status": record.status.value if record.status else None,
                "payment_amount": record.payment_amount
            }
        
        return details
    
    @staticmethod
    def debug_payroll_data(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Отладка данных зарплат"""
        
        print(f"🔍 Отладка зарплат для организации {organization_id}")
        print(f"📅 Отчетный период: {start_date} - {end_date}")
        
        # Получаем все зарплаты в организации
        all_payrolls = db.query(Payroll).filter(
            Payroll.organization_id == organization_id
        ).all()
        
        debug_info = {
            "total_payrolls": len(all_payrolls),
            "paid_payrolls": len([p for p in all_payrolls if p.is_paid]),
            "unpaid_payrolls": len([p for p in all_payrolls if not p.is_paid]),
            "payroll_details": [],
            "period_analysis": {
                "report_start": start_date.isoformat(),
                "report_end": end_date.isoformat(),
                "overlapping_payrolls": 0,
                "total_expense_in_period": 0
            }
        }
        
        total_expense = 0
        overlapping_count = 0
        
        for payroll in all_payrolls:
            # Убираем часовой пояс для сравнения
            payroll_start = payroll.period_start.replace(tzinfo=None) if payroll.period_start.tzinfo else payroll.period_start
            payroll_end = payroll.period_end.replace(tzinfo=None) if payroll.period_end.tzinfo else payroll.period_end
            report_start = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
            report_end = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
            
            # Проверяем пересечение
            has_overlap = payroll_start <= report_end and payroll_end >= report_start
            
            payroll_detail = {
                "id": str(payroll.id),
                "user_name": f"{payroll.user.first_name} {payroll.user.last_name}" if payroll.user else "Unknown",
                "period_start": payroll_start.isoformat(),
                "period_end": payroll_end.isoformat(),
                "net_amount": payroll.net_amount,
                "is_paid": payroll.is_paid,
                "has_overlap": has_overlap,
                "expense_in_period": 0
            }
            
            if has_overlap and payroll.is_paid:
                overlapping_count += 1
                
                # Вычисляем пересечение
                overlap_start = max(payroll_start, report_start)
                overlap_end = min(payroll_end, report_end)
                
                if overlap_end > overlap_start:
                    overlap_days = (overlap_end - overlap_start).days + 1
                    total_payroll_days = (payroll_end - payroll_start).days + 1
                    
                    if total_payroll_days > 0:
                        proportion = overlap_days / total_payroll_days
                        expense_for_period = payroll.net_amount * proportion
                        total_expense += expense_for_period
                        payroll_detail["expense_in_period"] = expense_for_period
                        payroll_detail["proportion"] = proportion
                        payroll_detail["overlap_days"] = overlap_days
                        payroll_detail["total_payroll_days"] = total_payroll_days
            
            debug_info["payroll_details"].append(payroll_detail)
        
        debug_info["period_analysis"]["overlapping_payrolls"] = overlapping_count
        debug_info["period_analysis"]["total_expense_in_period"] = total_expense
        
        print(f"📊 Найдено {overlapping_count} пересекающихся зарплат")
        print(f"💰 Общие расходы за период: {total_expense}")
        
        return debug_info
    
    @staticmethod
    def generate_financial_summary(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> FinancialSummaryReport:
        """УНИФИЦИРОВАННАЯ генерация финансового отчета"""
        
        print(f"🔍 Генерация унифицированного финансового отчета для организации {organization_id}")
        print(f"📅 Период: {start_date} - {end_date}")
        
        # ИСПРАВЛЕНО: Используем тот же метод расчета выручки, что и в отчете по помещениям
        rental_revenue = 0
        
        # Получаем все аренды, которые пересекаются с отчетным периодом
        rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.start_date < end_date,  # Аренда пересекается с периодом
                Rental.end_date > start_date,
                Rental.paid_amount > 0
            )
        ).all()
        
        print(f"🏠 Найдено аренд с пересечением периода: {len(rentals)}")
        
        for rental in rentals:
            # Пропорциональный расчет дохода (как в отчете по помещениям)
            overlap_start = max(rental.start_date.replace(tzinfo=None), start_date.replace(tzinfo=None))
            overlap_end = min(rental.end_date.replace(tzinfo=None), end_date.replace(tzinfo=None))
            
            if overlap_end > overlap_start:
                days_in_period = (overlap_end - overlap_start).days + 1
                total_rental_days = (rental.end_date - rental.start_date).days + 1
                
                if total_rental_days > 0:
                    revenue_per_day = rental.paid_amount / total_rental_days
                    period_revenue = revenue_per_day * days_in_period
                    rental_revenue += period_revenue
                    
                    print(f"  💰 Аренда {rental.id}: {rental.paid_amount} ₸ за {total_rental_days} дней, в периоде {days_in_period} дней = {period_revenue:.2f} ₸")
        
        print(f"💰 Итого выручка от аренды: {rental_revenue}")
        
        # ИСПРАВЛЕНО: Заказы в номер - используем тот же принцип пересечения
        orders_revenue_query = db.query(func.sum(RoomOrder.total_amount)).filter(
            and_(
                RoomOrder.organization_id == organization_id,
                RoomOrder.is_paid == True,
                RoomOrder.created_at >= start_date,
                RoomOrder.created_at <= end_date
            )
        )
        orders_revenue = orders_revenue_query.scalar() or 0.0
        
        print(f"🛎️ Выручка от заказов: {orders_revenue}")
        
        total_revenue = rental_revenue + orders_revenue
        print(f"💵 Общая выручка: {total_revenue}")
        
        # ИСПРАВЛЕНО: Расходы на персонал - правильный расчет с пересечением периодов
        all_payrolls = db.query(Payroll).filter(
            and_(
                Payroll.organization_id == organization_id,
                Payroll.is_paid == True
            )
        ).all()
        
        staff_expenses = 0
        print(f"💼 Всего зарплат в организации: {len(all_payrolls)}")
        
        for payroll in all_payrolls:
            # Убираем часовой пояс для сравнения
            payroll_start = payroll.period_start.replace(tzinfo=None) if payroll.period_start.tzinfo else payroll.period_start
            payroll_end = payroll.period_end.replace(tzinfo=None) if payroll.period_end.tzinfo else payroll.period_end
            report_start = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
            report_end = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
            
            # Проверяем пересечение периодов
            if payroll_start <= report_end and payroll_end >= report_start:
                # Вычисляем пересечение
                overlap_start = max(payroll_start, report_start)
                overlap_end = min(payroll_end, report_end)
                
                if overlap_end > overlap_start:
                    # Длительность пересечения
                    overlap_days = (overlap_end - overlap_start).days + 1
                    # Длительность всего периода зарплаты
                    total_payroll_days = (payroll_end - payroll_start).days + 1
                    
                    if total_payroll_days > 0:
                        # Пропорциональная часть зарплаты
                        proportion = overlap_days / total_payroll_days
                        expense_for_period = payroll.net_amount * proportion
                        staff_expenses += expense_for_period
                        
                        print(f"💰 Зарплата {payroll.id}: {payroll.net_amount} ₸ (пропорция: {proportion:.2f}, добавлено: {expense_for_period:.2f})")
        
        print(f"👥 Расходы на персонал: {staff_expenses}")
        
        # ИСПРАВЛЕНО: Расходы на материалы
        try:
            from models.extended_models import InventoryMovement
            material_expenses_query = db.query(func.sum(InventoryMovement.total_cost)).filter(
                and_(
                    InventoryMovement.organization_id == organization_id,
                    InventoryMovement.movement_type == "out",
                    InventoryMovement.created_at >= start_date,
                    InventoryMovement.created_at <= end_date,
                    InventoryMovement.total_cost > 0
                )
            )
            material_expenses = material_expenses_query.scalar() or 0.0
        except Exception as e:
            print(f"⚠️ Ошибка при получении расходов на материалы: {e}")
            material_expenses = 0.0
        
        print(f"📦 Расходы на материалы: {material_expenses}")
        
        total_expenses = staff_expenses + material_expenses
        net_profit = total_revenue - total_expenses
        
        print(f"📊 Общие расходы: {total_expenses}")
        print(f"💡 Чистая прибыль: {net_profit}")
        
        # ИСПРАВЛЕНО: Используем унифицированный расчет загруженности
        occupancy_rate = ReportsService._calculate_unified_occupancy_rate(
            db, organization_id, start_date, end_date
        )
        
        # Количество помещений
        properties_count = db.query(Property).filter(
            and_(
                Property.organization_id == organization_id,
                Property.is_active == True
            )
        ).count()
        
        # ИСПРАВЛЕНО: Активные аренды на текущий момент
        now = datetime.now(timezone.utc)
        active_rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.is_active == True,
                Rental.start_date <= now,
                Rental.end_date >= now
            )
        ).count()
        
        print(f"🏢 Помещений: {properties_count}, Активных аренд: {active_rentals}")
        print(f"📈 Загруженность: {occupancy_rate}%")
        
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
    def _calculate_unified_occupancy_rate(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """ЕДИНЫЙ метод расчета загруженности для всех отчетов"""
        
        print(f"📊 Расчет унифицированной загруженности помещений")
        print(f"📅 Период: {start_date} - {end_date}")
        
        # Получаем отчет по загруженности помещений (используем существующий проверенный метод)
        occupancy_reports = ReportsService.generate_property_occupancy_report(
            db, organization_id, start_date, end_date
        )
        
        if not occupancy_reports:
            print("⚠️ Нет данных по помещениям")
            return 0.0
        
        # Взвешенное среднее по общему количеству дней
        total_days = sum(report.total_days for report in occupancy_reports)
        total_occupied_days = sum(report.occupied_days for report in occupancy_reports)
        
        print(f"🎯 Общих дней: {total_days}, занятых дней: {total_occupied_days}")
        
        if total_days == 0:
            return 0.0
        
        unified_occupancy_rate = round((total_occupied_days / total_days) * 100, 2)
        print(f"📈 Унифицированная загруженность: {unified_occupancy_rate}%")
        
        return unified_occupancy_rate

    @staticmethod
    def get_unified_revenue_for_period(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """ЕДИНЫЙ метод расчета выручки для всех отчетов"""
        
        total_revenue = 0
        
        # Получаем все аренды, которые пересекаются с отчетным периодом
        rentals = db.query(Rental).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.start_date < end_date,
                Rental.end_date > start_date,
                Rental.paid_amount > 0
            )
        ).all()
        
        for rental in rentals:
            # Пропорциональный расчет дохода по пересечению
            overlap_start = max(rental.start_date.replace(tzinfo=None), start_date.replace(tzinfo=None))
            overlap_end = min(rental.end_date.replace(tzinfo=None), end_date.replace(tzinfo=None))
            
            if overlap_end > overlap_start:
                days_in_period = (overlap_end - overlap_start).days + 1
                total_rental_days = (rental.end_date - rental.start_date).days + 1
                
                if total_rental_days > 0:
                    revenue_per_day = rental.paid_amount / total_rental_days
                    total_revenue += revenue_per_day * days_in_period
        
        return total_revenue

    # Обновляем отчет по помещениям, чтобы использовать ту же логику
    @staticmethod
    def generate_property_occupancy_report(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        property_id: Optional[uuid.UUID] = None
    ) -> List[PropertyOccupancyReport]:
        """Отчет по загруженности с унифицированной логикой"""
        
        query = db.query(Property).filter(
            and_(
                Property.organization_id == organization_id,
                Property.is_active == True
            )
        )
        
        if property_id:
            query = query.filter(Property.id == property_id)
        
        properties = query.all()
        reports = []
        
        period_days = (end_date - start_date).days + 1
        
        for prop in properties:
            # Используем тот же метод расчета выручки
            property_revenue = ReportsService._get_property_revenue_for_period(
                db, prop.id, organization_id, start_date, end_date
            )
            
            # Расчет занятых дней (без изменений)
            occupied_days = ReportsService._get_property_occupied_days(
                db, prop.id, start_date, end_date
            )
            
            occupancy_rate = (occupied_days / period_days * 100) if period_days > 0 else 0
            occupancy_rate = min(occupancy_rate, 100.0)  # Ограничиваем 100%
            
            reports.append(PropertyOccupancyReport(
                property_id=str(prop.id),
                property_name=prop.name,
                property_number=prop.number,
                total_days=period_days,
                occupied_days=occupied_days,
                occupancy_rate=round(occupancy_rate, 2),
                revenue=round(property_revenue, 2)
            ))
        
        return sorted(reports, key=lambda x: x.occupancy_rate, reverse=True)

    @staticmethod
    def _get_property_revenue_for_period(
        db: Session,
        property_id: uuid.UUID,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """Получить выручку помещения за период"""
        
        rentals = db.query(Rental).filter(
            and_(
                Rental.property_id == property_id,
                Rental.organization_id == organization_id,
                Rental.start_date < end_date,
                Rental.end_date > start_date,
                Rental.paid_amount > 0
            )
        ).all()
        
        total_revenue = 0
        
        for rental in rentals:
            overlap_start = max(rental.start_date.replace(tzinfo=None), start_date.replace(tzinfo=None))
            overlap_end = min(rental.end_date.replace(tzinfo=None), end_date.replace(tzinfo=None))
            
            if overlap_end > overlap_start:
                days_in_period = (overlap_end - overlap_start).days + 1
                total_rental_days = (rental.end_date - rental.start_date).days + 1
                
                if total_rental_days > 0:
                    revenue_per_day = rental.paid_amount / total_rental_days
                    total_revenue += revenue_per_day * days_in_period
        
        return total_revenue

    @staticmethod
    def generate_employee_performance_report(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        role: Optional[UserRole] = None,
        user_id: Optional[uuid.UUID] = None
    ) -> List[EmployeePerformanceReport]:
        """ИСПРАВЛЕННАЯ генерация отчета по производительности сотрудников"""
        
        print(f"👥 Генерация отчета по производительности сотрудников")
        print(f"📅 Период: {start_date} - {end_date}")
        
        query = db.query(User).filter(User.organization_id == organization_id)
        
        if role:
            query = query.filter(User.role == role)
        
        if user_id:
            query = query.filter(User.id == user_id)
        
        employees = query.all()
        print(f"👤 Найдено сотрудников: {len(employees)}")
        
        reports = []
        
        for employee in employees:
            print(f"🔍 Анализ сотрудника: {employee.first_name} {employee.last_name}")
            
            # Выполненные задачи за период
            completed_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == employee.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= start_date,
                    Task.completed_at <= end_date
                )
            ).all()
            
            print(f"✅ Выполненных задач: {len(completed_tasks)}")
            
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
            
            # ИСПРАВЛЕНО: Правильный расчет заработка
            total_earnings = 0
            
            # 1. Получаем ВСЕ зарплаты сотрудника
            all_payrolls = db.query(Payroll).filter(
                and_(
                    Payroll.user_id == employee.id,
                    Payroll.organization_id == organization_id,
                    Payroll.is_paid == True
                )
            ).all()
            
            print(f"💰 Всего зарплат у сотрудника: {len(all_payrolls)}")
            
            # 2. Фильтруем зарплаты с пересечением периодов
            for payroll in all_payrolls:
                # Убираем часовой пояс для сравнения
                payroll_start = payroll.period_start.replace(tzinfo=None) if payroll.period_start.tzinfo else payroll.period_start
                payroll_end = payroll.period_end.replace(tzinfo=None) if payroll.period_end.tzinfo else payroll.period_end
                report_start = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
                report_end = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
                
                # Проверяем пересечение периодов
                if payroll_start <= report_end and payroll_end >= report_start:
                    # Вычисляем пересечение
                    overlap_start = max(payroll_start, report_start)
                    overlap_end = min(payroll_end, report_end)
                    
                    if overlap_end > overlap_start:
                        # Длительность пересечения
                        overlap_days = (overlap_end - overlap_start).days + 1
                        # Длительность всего периода зарплаты
                        total_payroll_days = (payroll_end - payroll_start).days + 1
                        
                        if total_payroll_days > 0:
                            # Пропорциональная часть зарплаты
                            proportion = overlap_days / total_payroll_days
                            earnings_for_period = payroll.net_amount * proportion
                            total_earnings += earnings_for_period
                            
                            print(f"💵 Зарплата {payroll.id}: {payroll.net_amount} ₸ (пропорция: {proportion:.2f}, добавлено: {earnings_for_period:.2f})")
            
            # 3. Дополнительный заработок из задач
            task_earnings = sum(task.payment_amount or 0 for task in completed_tasks if task.is_paid)
            if task_earnings > 0:
                total_earnings += task_earnings
                print(f"🎯 Доплата за задачи: {task_earnings}")
            
            # 4. Проверяем операции зарплаты (если есть)
            try:
                from models.payroll_operation import PayrollOperation
                operation_earnings = db.query(func.sum(PayrollOperation.amount)).filter(
                    and_(
                        PayrollOperation.user_id == employee.id,
                        PayrollOperation.organization_id == organization_id,
                        PayrollOperation.created_at >= start_date,
                        PayrollOperation.created_at <= end_date,
                        PayrollOperation.is_applied == True,
                        PayrollOperation.operation_type.in_(['bonus', 'overtime', 'allowance'])
                    )
                ).scalar() or 0
                
                if operation_earnings > 0:
                    total_earnings += operation_earnings
                    print(f"🎁 Дополнительные выплаты: {operation_earnings}")
                    
            except (ImportError, Exception) as e:
                print(f"⚠️ Не удалось получить операции зарплаты: {e}")
                operation_earnings = 0
            
            print(f"💎 Итого заработок сотрудника {employee.first_name}: {total_earnings:.2f} ₸")
            
            reports.append(EmployeePerformanceReport(
                user_id=str(employee.id),
                user_name=f"{employee.first_name} {employee.last_name}",
                role=employee.role.value,
                tasks_completed=len(completed_tasks),
                average_completion_time=avg_completion_time,
                quality_rating=round(avg_quality, 2) if avg_quality else None,
                earnings=total_earnings
            ))
        
        print(f"📊 Сформирован отчет по {len(reports)} сотрудникам")
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
        """ИСПРАВЛЕННОЕ вычисление коэффициента загруженности помещений"""
        
        print(f"📊 Расчет загруженности помещений")
        print(f"📅 Период: {start_date} - {end_date}")
        
        # Получаем активные помещения
        active_properties = db.query(Property).filter(
            and_(
                Property.organization_id == organization_id,
                Property.is_active == True
            )
        ).all()
        
        total_properties = len(active_properties)
        print(f"🏢 Активных помещений: {total_properties}")
        
        if total_properties == 0:
            return 0.0
        
        # Общее количество дней в периоде
        total_days = (end_date - start_date).days + 1  # +1 чтобы включить последний день
        if total_days <= 0:
            return 0.0
        
        print(f"📅 Дней в периоде: {total_days}")
        
        # Общее количество доступных дней (помещения × дни)
        total_available_days = total_properties * total_days
        print(f"🎯 Общее количество доступных дней: {total_available_days}")
        
        # Считаем занятые дни для каждого помещения
        total_occupied_days = 0
        
        for prop in active_properties:
            print(f"🔍 Анализ помещения: {prop.name}")
            
            # Получаем аренды для этого помещения, которые пересекаются с периодом
            rentals = db.query(Rental).filter(
                and_(
                    Rental.property_id == prop.id,
                    Rental.organization_id == organization_id,
                    # Аренда пересекается с отчетным периодом
                    Rental.start_date < end_date,
                    Rental.end_date > start_date
                )
            ).all()
            
            print(f"📝 Найдено аренд для помещения: {len(rentals)}")
            
            property_occupied_days = 0
            rental_periods = []
            
            for rental in rentals:
                # Убираем часовой пояс для вычислений
                rental_start = rental.start_date.replace(tzinfo=None) if rental.start_date.tzinfo else rental.start_date
                rental_end = rental.end_date.replace(tzinfo=None) if rental.end_date.tzinfo else rental.end_date
                period_start = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
                period_end = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
                
                # Пересечение аренды с отчетным периодом
                overlap_start = max(rental_start, period_start)
                overlap_end = min(rental_end, period_end)
                
                if overlap_end > overlap_start:
                    overlap_days = (overlap_end - overlap_start).days + 1
                    rental_periods.append((overlap_start, overlap_end, overlap_days))
                    print(f"  ⏰ Аренда {rental.id}: {overlap_start} - {overlap_end} ({overlap_days} дней)")
            
            # ИСПРАВЛЕНО: Объединяем пересекающиеся периоды аренды 
            # чтобы избежать двойного подсчета одних и тех же дней
            if rental_periods:
                # Сортируем периоды по дате начала
                rental_periods.sort(key=lambda x: x[0])
                
                merged_periods = []
                current_start, current_end, _ = rental_periods[0]
                
                for start, end, _ in rental_periods[1:]:
                    if start <= current_end:
                        # Периоды пересекаются или соприкасаются - объединяем
                        current_end = max(current_end, end)
                    else:
                        # Новый период - сохраняем предыдущий и начинаем новый
                        merged_periods.append((current_start, current_end))
                        current_start, current_end = start, end
                
                # Добавляем последний период
                merged_periods.append((current_start, current_end))
                
                # Подсчитываем общее количество занятых дней
                for start, end in merged_periods:
                    period_days = (end - start).days + 1
                    property_occupied_days += period_days
                    print(f"  📊 Объединенный период: {start} - {end} ({period_days} дней)")
            
            # Проверяем, что не превышаем максимум дней для помещения
            max_days_for_property = total_days
            if property_occupied_days > max_days_for_property:
                print(f"⚠️ Занятых дней ({property_occupied_days}) больше максимума ({max_days_for_property}), обрезаем")
                property_occupied_days = max_days_for_property
            
            total_occupied_days += property_occupied_days
            print(f"  🎯 Итого занятых дней для помещения: {property_occupied_days}")
        
        print(f"📈 Общее количество занятых дней: {total_occupied_days}")
        print(f"📈 Общее количество доступных дней: {total_available_days}")
        
        # Коэффициент загруженности в процентах
        occupancy_rate = (total_occupied_days / total_available_days) * 100
        
        # Ограничиваем максимум 100%
        if occupancy_rate > 100:
            print(f"⚠️ Загруженность превышает 100% ({occupancy_rate:.2f}%), ограничиваем до 100%")
            occupancy_rate = 100.0
        
        print(f"🎯 Итоговая загруженность: {occupancy_rate:.2f}%")
        return round(occupancy_rate, 2)
    
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
    def _get_property_occupied_days(
        db: Session,
        property_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> int:
        """
        Подсчет количества дней, когда помещение было занято в указанном периоде
        
        Args:
            db: Сессия базы данных
            property_id: ID помещения
            start_date: Начало периода
            end_date: Конец периода
            
        Returns:
            Количество занятых дней
        """
        
        # Получаем все аренды для этого помещения, которые пересекаются с отчетным периодом
        rentals = db.query(Rental).filter(
            and_(
                Rental.property_id == property_id,
                # Аренда пересекается с отчетным периодом
                Rental.start_date < end_date,
                Rental.end_date > start_date
            )
        ).all()
        
        if not rentals:
            return 0
        
        # Собираем все периоды занятости
        occupied_periods = []
        
        for rental in rentals:
            # Убираем часовой пояс для вычислений
            rental_start = rental.start_date.replace(tzinfo=None) if rental.start_date.tzinfo else rental.start_date
            rental_end = rental.end_date.replace(tzinfo=None) if rental.end_date.tzinfo else rental.end_date
            period_start = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
            period_end = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
            
            # Пересечение аренды с отчетным периодом
            overlap_start = max(rental_start, period_start)
            overlap_end = min(rental_end, period_end)
            
            if overlap_end > overlap_start:
                occupied_periods.append((overlap_start, overlap_end))
        
        if not occupied_periods:
            return 0
        
        # Объединяем пересекающиеся периоды чтобы избежать двойного подсчета
        # Сортируем периоды по дате начала
        occupied_periods.sort(key=lambda x: x[0])
        
        merged_periods = []
        current_start, current_end = occupied_periods[0]
        
        for start, end in occupied_periods[1:]:
            if start <= current_end:
                # Периоды пересекаются или соприкасаются - объединяем
                current_end = max(current_end, end)
            else:
                # Новый период - сохраняем предыдущий и начинаем новый
                merged_periods.append((current_start, current_end))
                current_start, current_end = start, end
        
        # Добавляем последний период
        merged_periods.append((current_start, current_end))
        
        # Подсчитываем общее количество занятых дней
        total_occupied_days = 0
        for start, end in merged_periods:
            days = (end - start).days + 1  # +1 чтобы включить последний день
            total_occupied_days += days
        
        return total_occupied_days