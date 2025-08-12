# backend/services/comprehensive_report_service.py
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc, or_
import uuid
import xlsxwriter
import io
import xml.etree.ElementTree as ET
from xml.dom import minidom

from models.extended_models import (
    Organization, User, Property, Rental, Task, Payroll, 
    Inventory, InventoryMovement, PropertyStatus, TaskStatus
)
from models.acquiring_models import AcquiringSettings
from schemas.comprehensive_report import (
    ComprehensiveReportRequest, ComprehensiveReportResponse,
    StaffPayrollDetail, InventoryMovementDetail, PropertyRevenueDetail,
    AdministrativeExpense,AcquiringAnalysisReport
)

class ComprehensiveReportService:
    """Сервис для генерации полного комплексного отчета"""
    
    @staticmethod
    def generate_comprehensive_report(
        db: Session,
        organization_id: uuid.UUID,
        request: ComprehensiveReportRequest
    ) -> ComprehensiveReportResponse:
        """Генерация полного отчета с детализацией"""
        
        print(f"🏢 Генерация полного отчета для организации {organization_id}")
        print(f"📅 Период: {request.start_date} - {request.end_date}")
        
        # Получаем информацию об организации
        organization = db.query(Organization).filter(
            Organization.id == organization_id
        ).first()
        
        if not organization:
            raise ValueError("Organization not found")
        
        # Получаем настройки эквайринга
        acquiring_settings = db.query(AcquiringSettings).filter(
            AcquiringSettings.organization_id == organization_id
        ).first()
        
        # Детализация зарплат
        staff_payroll = ComprehensiveReportService._generate_staff_payroll_details(
            db, organization_id, request.start_date, request.end_date
        )
        
        # Товары и материалы
        inventory_movements = ComprehensiveReportService._generate_inventory_details(
            db, organization_id, request.start_date, request.end_date
        )
        
        # Аренда помещений с эквайрингом
        property_revenues = ComprehensiveReportService._generate_property_revenue_details(
            db, organization_id, request.start_date, request.end_date, acquiring_settings
        )
        
        # Административные расходы
        administrative_expenses = ComprehensiveReportService._generate_administrative_expenses(
            db, organization_id, request.start_date, request.end_date, 
            request.utility_bills_amount, request.additional_admin_expenses,
            acquiring_settings
        )
        
        # Сводки
        payroll_summary = {
            "total_gross": sum(p.gross_amount for p in staff_payroll),
            "total_income_tax": sum(p.income_tax for p in staff_payroll),
            "total_social_tax": sum(p.social_tax for p in staff_payroll),
            "total_net": sum(p.net_amount for p in staff_payroll),
            "paid_count": len([p for p in staff_payroll if p.is_paid]),
            "unpaid_count": len([p for p in staff_payroll if not p.is_paid])
        }
        
        inventory_summary = {
            "total_incoming_cost": sum(i.incoming_cost for i in inventory_movements),
            "total_outgoing_cost": sum(i.outgoing_cost for i in inventory_movements),
            "total_profit": sum(i.net_profit for i in inventory_movements),
            "total_items": len(inventory_movements)
        }
        
        property_summary = {
            "total_revenue": sum(p.total_revenue for p in property_revenues),
            "total_cash": sum(p.cash_payments for p in property_revenues),
            "total_card": sum(p.card_payments for p in property_revenues),
            "total_commission": sum(p.acquiring_commission_amount for p in property_revenues),
            "net_revenue": sum(p.net_revenue_after_commission for p in property_revenues),
            "avg_occupancy": sum(p.occupancy_rate for p in property_revenues) / len(property_revenues) if property_revenues else 0
        }
        
        administrative_summary = {
            "total_admin_expenses": sum(a.amount for a in administrative_expenses),
            "utility_bills": request.utility_bills_amount,
            "bank_commissions": sum(a.amount for a in administrative_expenses if a.category == "bank_commission"),
            "other_expenses": sum(a.amount for a in administrative_expenses if a.category == "other")
        }
        
        # Итоговые показатели
        total_revenue = property_summary["total_revenue"] + inventory_summary["total_profit"]
        total_expenses = (
            payroll_summary["total_net"] + 
            inventory_summary["total_outgoing_cost"] + 
            administrative_summary["total_admin_expenses"]
        )
        net_profit = total_revenue - total_expenses
        
        # Статистика эквайринга
        acquiring_statistics = ComprehensiveReportService._generate_acquiring_statistics(
            property_revenues, acquiring_settings
        )
        
        return ComprehensiveReportResponse(
            organization_name=organization.name,
            report_period={
                "start_date": request.start_date,
                "end_date": request.end_date
            },
            staff_payroll=staff_payroll,
            payroll_summary=payroll_summary,
            inventory_movements=inventory_movements,
            inventory_summary=inventory_summary,
            property_revenues=property_revenues,
            property_summary=property_summary,
            administrative_expenses=administrative_expenses,
            administrative_summary=administrative_summary,
            total_revenue=total_revenue,
            total_expenses=total_expenses,
            net_profit=net_profit,
            acquiring_statistics=acquiring_statistics,
            generated_at=datetime.now(timezone.utc)
        )
    
    @staticmethod
    def _generate_staff_payroll_details(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> List[StaffPayrollDetail]:
        """Генерация детализации по зарплатам"""
        
        # Получаем все зарплаты с пересечением периода
        payrolls = db.query(Payroll).filter(
            and_(
                Payroll.organization_id == organization_id,
                Payroll.period_start < end_date,
                Payroll.period_end > start_date
            )
        ).all()
        
        payroll_details = []
        
        for payroll in payrolls:
            user = payroll.user
            if not user:
                continue
            
            # Рассчитываем налоги отдельно (примерные ставки для КЗ)
            income_tax_rate = 0.10  # 10% подоходный налог
            social_tax_rate = 0.095  # 9.5% социальный налог
            
            income_tax = payroll.gross_amount * income_tax_rate
            social_tax = payroll.gross_amount * social_tax_rate
            total_calculated_deductions = income_tax + social_tax + payroll.deductions
            
            # Если налоги уже включены в общую сумму налогов
            if payroll.taxes > 0:
                # Распределяем пропорционально
                tax_ratio = income_tax / (income_tax + social_tax) if (income_tax + social_tax) > 0 else 0.5
                income_tax = payroll.taxes * tax_ratio
                social_tax = payroll.taxes * (1 - tax_ratio)
            
            payroll_details.append(StaffPayrollDetail(
                user_id=str(user.id),
                name=f"{user.first_name} {user.last_name}",
                role=user.role.value,
                base_salary=payroll.base_rate or 0,
                task_payments=payroll.tasks_payment,
                bonuses=payroll.bonus + payroll.tips,
                other_income=payroll.other_income,
                gross_amount=payroll.gross_amount,
                income_tax=income_tax,
                social_tax=social_tax,
                total_deductions=total_calculated_deductions,
                net_amount=payroll.net_amount,
                is_paid=payroll.is_paid,
                paid_date=payroll.paid_at
            ))
        
        return sorted(payroll_details, key=lambda x: x.gross_amount, reverse=True)

    @staticmethod
    def _generate_inventory_details(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> List[InventoryMovementDetail]:
        """Генерация детализации по товарам С УЧЕТОМ ЭКВАЙРИНГА"""
        
        # Получаем все товары организации
        inventory_items = db.query(Inventory).filter(
            Inventory.organization_id == organization_id
        ).all()
        
        inventory_details = []
        
        for item in inventory_items:
            movements = db.query(InventoryMovement).filter(
                and_(
                    InventoryMovement.inventory_id == item.id,
                    InventoryMovement.created_at >= start_date,
                    InventoryMovement.created_at <= end_date
                )
            ).all()
            
            if not movements:
                continue
            
            # Разделяем движения
            incoming_movements = [m for m in movements if m.movement_type == "in"]
            outgoing_movements = [m for m in movements if m.movement_type in ["out", "sale"]]
            sales_movements = [m for m in movements if m.movement_type == "sale"]
            
            # НОВОЕ: Учитываем эквайринг в продажах
            gross_sales_revenue = sum(m.total_selling_amount or 0 for m in sales_movements)
            acquiring_commission = sum(m.acquiring_commission_amount or 0 for m in sales_movements)
            net_sales_revenue = sum(m.net_selling_amount or 0 for m in sales_movements)
            
            # Прибыль с учетом комиссии эквайринга
            cost_of_goods_sold = sum(m.total_purchase_cost or 0 for m in sales_movements)
            net_profit = net_sales_revenue - cost_of_goods_sold
            
            # Маржа с учетом комиссии
            profit_margin = (net_profit / net_sales_revenue * 100) if net_sales_revenue > 0 else 0
            
            inventory_details.append(InventoryMovementDetail(
                inventory_id=str(item.id),
                item_name=item.name,
                category=item.category or "Общее",
                unit=item.unit,
                incoming_quantity=sum(m.quantity for m in incoming_movements),
                outgoing_quantity=sum(abs(m.quantity) for m in outgoing_movements),
                current_stock=item.current_stock,
                incoming_cost=sum(m.total_purchase_cost or 0 for m in incoming_movements),
                outgoing_cost=cost_of_goods_sold,
                selling_revenue=net_sales_revenue,  # ЧИСТАЯ выручка после комиссии
                gross_profit=net_profit,
                profit_margin=round(profit_margin, 2),
                net_profit=net_profit,
                # НОВЫЕ ПОЛЯ
                gross_sales_revenue=gross_sales_revenue,
                acquiring_commission=acquiring_commission,
                commission_rate=round(acquiring_commission / gross_sales_revenue * 100, 2) if gross_sales_revenue > 0 else 0
            ))
        
        return sorted(inventory_details, key=lambda x: x.net_profit, reverse=True)
    

    @staticmethod
    def _generate_inventory_details_with_acquiring(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> List[InventoryMovementDetail]:
        """Генерация детализации товаров с полным учетом эквайринга"""
        
        inventory_items = db.query(Inventory).filter(
            Inventory.organization_id == organization_id
        ).all()
        
        inventory_details = []
        
        for item in inventory_items:
            movements = db.query(InventoryMovement).filter(
                and_(
                    InventoryMovement.inventory_id == item.id,
                    InventoryMovement.created_at >= start_date,
                    InventoryMovement.created_at <= end_date
                )
            ).all()
            
            if not movements:
                continue
            
            # Разделяем движения по типам
            incoming_movements = [m for m in movements if m.movement_type == "in"]
            outgoing_movements = [m for m in movements if m.movement_type in ["out", "sale"]]
            sales_movements = [m for m in movements if m.movement_type == "sale"]
            
            # ПОДРОБНЫЙ АНАЛИЗ ПРОДАЖ ПО СПОСОБАМ ОПЛАТЫ
            cash_sales = [s for s in sales_movements if s.payment_method == "cash"]
            card_sales = [s for s in sales_movements if s.payment_method == "card"]
            qr_sales = [s for s in sales_movements if s.payment_method == "qr_code"]
            
            # Суммы по способам оплаты
            cash_sales_amount = sum(s.total_selling_amount or 0 for s in cash_sales)
            card_sales_amount = sum(s.total_selling_amount or 0 for s in card_sales)
            qr_sales_amount = sum(s.total_selling_amount or 0 for s in qr_sales)
            
            # Валовая выручка (до комиссий)
            gross_sales_revenue = cash_sales_amount + card_sales_amount + qr_sales_amount
            
            # Комиссии эквайринга
            acquiring_commission = sum(s.acquiring_commission_amount or 0 for s in sales_movements)
            
            # Чистая выручка (после комиссий)
            net_sales_revenue = sum(s.net_selling_amount or 0 for s in sales_movements)
            
            # Себестоимость и прибыль
            cost_of_goods_sold = sum(s.total_purchase_cost or 0 for s in sales_movements)
            net_profit = net_sales_revenue - cost_of_goods_sold
            
            # Маржа от чистой выручки
            profit_margin = (net_profit / net_sales_revenue * 100) if net_sales_revenue > 0 else 0
            
            # Средняя ставка комиссии
            avg_commission_rate = (acquiring_commission / (card_sales_amount + qr_sales_amount) * 100) if (card_sales_amount + qr_sales_amount) > 0 else 0
            
            # Доля карточных продаж
            card_sales_percentage = ((card_sales_amount + qr_sales_amount) / gross_sales_revenue * 100) if gross_sales_revenue > 0 else 0
            
            inventory_details.append(InventoryMovementDetail(
                inventory_id=str(item.id),
                item_name=item.name,
                category=item.category or "Общее",
                unit=item.unit,
                incoming_quantity=sum(m.quantity for m in incoming_movements),
                outgoing_quantity=sum(abs(m.quantity) for m in outgoing_movements),
                current_stock=item.current_stock,
                incoming_cost=sum(m.total_purchase_cost or 0 for m in incoming_movements),
                outgoing_cost=cost_of_goods_sold,
                gross_sales_revenue=gross_sales_revenue,
                acquiring_commission=acquiring_commission,
                selling_revenue=net_sales_revenue,
                gross_profit=net_profit,
                profit_margin=round(profit_margin, 2),
                net_profit=net_profit,
                commission_rate=round(avg_commission_rate, 2),
                cash_sales_amount=cash_sales_amount,
                card_sales_amount=card_sales_amount + qr_sales_amount,
                card_sales_percentage=round(card_sales_percentage, 2),
                average_purchase_price=round(sum(m.unit_purchase_price or 0 for m in incoming_movements) / len(incoming_movements), 2) if incoming_movements else 0,
                average_selling_price=round(gross_sales_revenue / sum(abs(s.quantity) for s in sales_movements), 2) if sales_movements else 0,
                turnover_ratio=round(sum(abs(s.quantity) for s in sales_movements) / item.current_stock, 2) if item.current_stock > 0 else 0
            ))
        
        return sorted(inventory_details, key=lambda x: x.net_profit, reverse=True)
    
    @staticmethod
    def generate_acquiring_analysis_report(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> AcquiringAnalysisReport:
        """Генерация полного анализа эквайринга"""
        
        # Получаем настройки эквайринга
        acquiring_settings = db.query(AcquiringSettings).filter(
            AcquiringSettings.organization_id == organization_id
        ).first()
        
        # Анализ платежей за аренду (существующий код)
        property_revenues = ComprehensiveReportService._generate_property_revenue_details(
            db, organization_id, start_date, end_date, acquiring_settings
        )
        
        # НОВОЕ: Анализ продаж товаров
        inventory_sales = db.query(InventoryMovement).filter(
            and_(
                InventoryMovement.organization_id == organization_id,
                InventoryMovement.movement_type == "sale",
                InventoryMovement.created_at >= start_date,
                InventoryMovement.created_at <= end_date
            )
        ).all()
        
        # Агрегация данных по источникам
        rental_gross = sum(p.total_revenue for p in property_revenues)
        rental_commission = sum(p.acquiring_commission_amount for p in property_revenues)
        rental_net = sum(p.net_revenue_after_commission for p in property_revenues)
        
        inventory_gross = sum(s.total_selling_amount or 0 for s in inventory_sales)
        inventory_commission = sum(s.acquiring_commission_amount or 0 for s in inventory_sales)
        inventory_net = sum(s.net_selling_amount or 0 for s in inventory_sales)
        
        # Общие показатели
        total_gross = rental_gross + inventory_gross
        total_commission = rental_commission + inventory_commission
        total_net = rental_net + inventory_net
        
        # По способам оплаты
        cash_sales = [s for s in inventory_sales if s.payment_method == "cash"]
        card_sales = [s for s in inventory_sales if s.payment_method == "card"]
        qr_sales = [s for s in inventory_sales if s.payment_method == "qr_code"]
        
        # Анализ провайдеров
        providers_performance = []
        if acquiring_settings and acquiring_settings.providers_config:
            for provider, config in acquiring_settings.providers_config.items():
                if isinstance(config, dict) and config.get("is_enabled", False):
                    provider_rate = config.get("commission_rate", 0)
                    
                    # Транзакции этого провайдера
                    provider_inventory_sales = [s for s in inventory_sales if s.acquiring_provider == provider]
                    provider_rental_revenue = sum(p.card_payments for p in property_revenues if p.acquiring_provider == provider)
                    
                    provider_volume = sum(s.total_selling_amount or 0 for s in provider_inventory_sales) + provider_rental_revenue
                    provider_commission = sum(s.acquiring_commission_amount or 0 for s in provider_inventory_sales) + sum(p.acquiring_commission_amount for p in property_revenues if p.acquiring_provider == provider)
                    
                    providers_performance.append({
                        "provider_name": provider,
                        "display_name": config.get("display_name", provider),
                        "commission_rate": provider_rate,
                        "transaction_volume": provider_volume,
                        "commission_paid": provider_commission,
                        "transaction_count": len(provider_inventory_sales) + len([p for p in property_revenues if p.acquiring_provider == provider])
                    })
        
        # Рекомендации по оптимизации
        recommendations = []
        potential_savings = 0
        
        if providers_performance:
            # Находим провайдера с минимальной ставкой
            min_rate_provider = min(providers_performance, key=lambda x: x["commission_rate"])
            current_avg_rate = (total_commission / (total_gross - sum(s.total_selling_amount or 0 for s in cash_sales)) * 100) if total_gross > 0 else 0
            
            if current_avg_rate > min_rate_provider["commission_rate"]:
                card_volume = total_gross - sum(s.total_selling_amount or 0 for s in cash_sales)
                potential_savings = card_volume * (current_avg_rate - min_rate_provider["commission_rate"]) / 100
                
                recommendations.append(f"Переход на {min_rate_provider['display_name']} может сэкономить {potential_savings:,.0f} ₸ в месяц")
            
            # Анализ доли карточных платежей
            card_percentage = ((total_gross - sum(s.total_selling_amount or 0 for s in cash_sales)) / total_gross * 100) if total_gross > 0 else 0
            
            if card_percentage < 50:
                recommendations.append("Низкая доля безналичных платежей. Рассмотрите стимулирование карточных платежей")
            elif card_percentage > 80:
                recommendations.append("Высокая доля карточных платежей. Важно оптимизировать ставки эквайринга")
        
        return AcquiringAnalysisReport(
            period={"start_date": start_date, "end_date": end_date},
            organization_name=db.query(Organization).filter(Organization.id == organization_id).first().name,
            total_transactions=len(inventory_sales) + len(property_revenues),
            total_gross_amount=total_gross,
            total_commission_paid=total_commission,
            total_net_amount=total_net,
            average_commission_rate=round((total_commission / total_gross * 100), 2) if total_gross > 0 else 0,
            rental_payments={
                "transaction_count": len(property_revenues),
                "gross_amount": rental_gross,
                "commission_paid": rental_commission,
                "net_amount": rental_net,
                "average_commission_rate": round((rental_commission / rental_gross * 100), 2) if rental_gross > 0 else 0
            },
            inventory_sales={
                "transaction_count": len(inventory_sales),
                "gross_amount": inventory_gross,
                "commission_paid": inventory_commission,
                "net_amount": inventory_net,
                "average_commission_rate": round((inventory_commission / inventory_gross * 100), 2) if inventory_gross > 0 else 0
            },
            cash_transactions={
                "count": len(cash_sales),
                "amount": sum(s.total_selling_amount or 0 for s in cash_sales),
                "percentage": round((sum(s.total_selling_amount or 0 for s in cash_sales) / total_gross * 100), 2) if total_gross > 0 else 0
            },
            card_transactions={
                "count": len(card_sales),
                "gross_amount": sum(s.total_selling_amount or 0 for s in card_sales),
                "commission_paid": sum(s.acquiring_commission_amount or 0 for s in card_sales),
                "net_amount": sum(s.net_selling_amount or 0 for s in card_sales)
            },
            qr_transactions={
                "count": len(qr_sales),
                "gross_amount": sum(s.total_selling_amount or 0 for s in qr_sales),
                "commission_paid": sum(s.acquiring_commission_amount or 0 for s in qr_sales),
                "net_amount": sum(s.net_selling_amount or 0 for s in qr_sales)
            },
            providers_performance=providers_performance,
            optimization_recommendations=recommendations,
            potential_savings=potential_savings
        )


    @staticmethod
    def _generate_property_revenue_details(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        acquiring_settings: Optional[Any]
    ) -> List[PropertyRevenueDetail]:
        """Генерация детализации доходов по помещениям с учетом эквайринга"""
        
        properties = db.query(Property).filter(
            and_(
                Property.organization_id == organization_id,
                Property.is_active == True
            )
        ).all()
        
        # Получаем комиссию эквайринга (по умолчанию Halyk с минимальной ставкой)
        default_commission_rate = 2.0  # 2% по умолчанию
        
        if acquiring_settings and acquiring_settings.providers_config:
            # Ищем Halyk или берем минимальную ставку
            halyk_config = acquiring_settings.providers_config.get("halyk")
            if halyk_config:
                default_commission_rate = halyk_config.get("commission_rate", 2.0)
            else:
                # Берем минимальную комиссию среди всех провайдеров
                all_rates = [
                    config.get("commission_rate", 2.0) 
                    for config in acquiring_settings.providers_config.values()
                    if isinstance(config, dict) and config.get("is_enabled", False)
                ]
                if all_rates:
                    default_commission_rate = min(all_rates)
        
        property_details = []
        period_days = (end_date - start_date).days + 1
        
        for prop in properties:
            # Получаем аренды за период
            rentals = db.query(Rental).filter(
                and_(
                    Rental.property_id == prop.id,
                    Rental.start_date < end_date,
                    Rental.end_date > start_date,
                    Rental.paid_amount > 0
                )
            ).all()
            
            total_revenue = 0
            cash_payments = 0
            card_payments = 0
            
            for rental in rentals:
                # Пропорциональный доход за период
                overlap_start = max(rental.start_date.replace(tzinfo=None), start_date.replace(tzinfo=None))
                overlap_end = min(rental.end_date.replace(tzinfo=None), end_date.replace(tzinfo=None))
                
                if overlap_end > overlap_start:
                    days_in_period = (overlap_end - overlap_start).days + 1
                    total_rental_days = (rental.end_date - rental.start_date).days + 1
                    
                    if total_rental_days > 0:
                        revenue_per_day = rental.paid_amount / total_rental_days
                        period_revenue = revenue_per_day * days_in_period
                        total_revenue += period_revenue
                        
                        # Распределяем по типам оплаты (примерно 50/50 если нет точных данных)
                        # В реальной системе это должно браться из payment_method в таблице payments
                        estimated_card_payment = period_revenue * 0.6  # 60% картами
                        estimated_cash_payment = period_revenue * 0.4  # 40% наличными
                        
                        card_payments += estimated_card_payment
                        cash_payments += estimated_cash_payment
            
            # Комиссия эквайринга только с карточных платежей
            acquiring_commission_amount = card_payments * (default_commission_rate / 100)
            net_revenue_after_commission = total_revenue - acquiring_commission_amount
            
            # Загруженность помещения
            occupied_days = ComprehensiveReportService._calculate_property_occupied_days(
                db, prop.id, start_date, end_date
            )
            occupancy_rate = (occupied_days / period_days * 100) if period_days > 0 else 0
            
            property_details.append(PropertyRevenueDetail(
                property_id=str(prop.id),
                property_name=prop.name,
                property_number=prop.number,
                total_revenue=total_revenue,
                cash_payments=cash_payments,
                card_payments=card_payments,
                acquiring_commission_rate=default_commission_rate,
                acquiring_commission_amount=acquiring_commission_amount,
                net_revenue_after_commission=net_revenue_after_commission,
                occupancy_days=occupied_days,
                total_available_days=period_days,
                occupancy_rate=min(occupancy_rate, 100.0)
            ))
        
        return sorted(property_details, key=lambda x: x.total_revenue, reverse=True)
    
    @staticmethod
    def _calculate_property_occupied_days(
        db: Session,
        property_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> int:
        """Расчет занятых дней для помещения"""
        
        rentals = db.query(Rental).filter(
            and_(
                Rental.property_id == property_id,
                Rental.start_date < end_date,
                Rental.end_date > start_date
            )
        ).all()
        
        if not rentals:
            return 0
        
        occupied_periods = []
        
        for rental in rentals:
            rental_start = rental.start_date.replace(tzinfo=None) if rental.start_date.tzinfo else rental.start_date
            rental_end = rental.end_date.replace(tzinfo=None) if rental.end_date.tzinfo else rental.end_date
            period_start = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
            period_end = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
            
            overlap_start = max(rental_start, period_start)
            overlap_end = min(rental_end, period_end)
            
            if overlap_end > overlap_start:
                occupied_periods.append((overlap_start, overlap_end))
        
        # Объединяем пересекающиеся периоды
        if not occupied_periods:
            return 0
        
        occupied_periods.sort(key=lambda x: x[0])
        merged_periods = []
        current_start, current_end = occupied_periods[0]
        
        for start, end in occupied_periods[1:]:
            if start <= current_end:
                current_end = max(current_end, end)
            else:
                merged_periods.append((current_start, current_end))
                current_start, current_end = start, end
        
        merged_periods.append((current_start, current_end))
        
        total_days = sum((end - start).days + 1 for start, end in merged_periods)
        return total_days
    
    @staticmethod
    def _generate_administrative_expenses(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        utility_bills: float,
        additional_expenses: List[AdministrativeExpense],
        acquiring_settings: Optional[Any]
    ) -> List[AdministrativeExpense]:
        """Генерация административных расходов"""
        
        expenses = []
        
        # Коммунальные услуги
        if utility_bills > 0:
            expenses.append(AdministrativeExpense(
                category="utility_bills",
                description="Коммунальные услуги",
                amount=utility_bills
            ))
        
        # Банковские комиссии (рассчитываем из эквайринга)
        if acquiring_settings:
            # Примерный расчет комиссий за период
            total_card_revenue = db.query(func.sum(Rental.paid_amount)).filter(
                and_(
                    Rental.organization_id == organization_id,
                    Rental.created_at >= start_date,
                    Rental.created_at <= end_date
                )
            ).scalar() or 0
            
            # Предполагаем, что 60% оплат картами
            estimated_card_revenue = total_card_revenue * 0.6
            
            # Берем минимальную комиссию
            min_commission = 2.0
            if acquiring_settings.providers_config:
                rates = [
                    config.get("commission_rate", 2.0)
                    for config in acquiring_settings.providers_config.values()
                    if isinstance(config, dict) and config.get("is_enabled", False)
                ]
                if rates:
                    min_commission = min(rates)
            
            bank_commission = estimated_card_revenue * (min_commission / 100)
            
            if bank_commission > 0:
                expenses.append(AdministrativeExpense(
                    category="bank_commission",
                    description=f"Комиссия эквайринга ({min_commission}%)",
                    amount=bank_commission
                ))
        
        # Налоги организации (примерно)
        total_revenue = db.query(func.sum(Rental.paid_amount)).filter(
            and_(
                Rental.organization_id == organization_id,
                Rental.created_at >= start_date,
                Rental.created_at <= end_date
            )
        ).scalar() or 0
        
        # КПН (корпоративный подоходный налог) - 20% в КЗ
        corporate_tax = total_revenue * 0.20
        expenses.append(AdministrativeExpense(
            category="corporate_tax",
            description="Корпоративный подоходный налог (20%)",
            amount=corporate_tax
        ))
        
        # НДС (если применимо) - 12% в КЗ
        vat_amount = total_revenue * 0.12
        expenses.append(AdministrativeExpense(
            category="vat",
            description="НДС (12%)",
            amount=vat_amount
        ))
        
        # Дополнительные расходы от пользователя
        expenses.extend(additional_expenses)
        
        return sorted(expenses, key=lambda x: x.amount, reverse=True)
    
    @staticmethod
    def _generate_acquiring_statistics(
        property_revenues: List[PropertyRevenueDetail],
        acquiring_settings: Optional[Any]
    ) -> Dict[str, Any]:
        """Генерация статистики по эквайрингу"""
        
        total_card_payments = sum(p.card_payments for p in property_revenues)
        total_cash_payments = sum(p.cash_payments for p in property_revenues)
        total_commission = sum(p.acquiring_commission_amount for p in property_revenues)
        
        # Средневзвешенная комиссия
        avg_commission_rate = 0
        if total_card_payments > 0:
            avg_commission_rate = (total_commission / total_card_payments) * 100
        
        providers_info = {}
        if acquiring_settings and acquiring_settings.providers_config:
            for provider, config in acquiring_settings.providers_config.items():
                if isinstance(config, dict):
                    providers_info[provider] = {
                        "enabled": config.get("is_enabled", False),
                        "commission_rate": config.get("commission_rate", 0),
                        "display_name": config.get("display_name", provider)
                    }
        
        return {
            "total_payments": total_card_payments + total_cash_payments,
            "card_payments": total_card_payments,
            "cash_payments": total_cash_payments,
            "card_payment_percentage": (total_card_payments / (total_card_payments + total_cash_payments)) * 100 if (total_card_payments + total_cash_payments) > 0 else 0,
            "total_commission_paid": total_commission,
            "average_commission_rate": avg_commission_rate,
            "providers": providers_info,
            "commission_savings": 0  # Можно добавить расчет экономии при выборе оптимального провайдера
        }
    
    @staticmethod
    def export_to_xlsx(report: ComprehensiveReportResponse) -> bytes:
        """Экспорт в Excel"""
        
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        # Стили
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#D7E4BC',
            'border': 1,
            'align': 'center'
        })
        money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
        percent_format = workbook.add_format({'num_format': '0.00"%"'})
        date_format = workbook.add_format({'num_format': 'dd.mm.yyyy'})
        
        # Лист 1: Сводка
        summary_ws = workbook.add_worksheet("Общая сводка")
        
        summary_ws.write('A1', 'ПОЛНЫЙ ФИНАНСОВЫЙ ОТЧЕТ', header_format)
        summary_ws.write('A2', f'Организация: {report.organization_name}')
        summary_ws.write('A3', f'Период: {report.report_period["start_date"].strftime("%d.%m.%Y")} - {report.report_period["end_date"].strftime("%d.%m.%Y")}')
        
        row = 5
        summary_data = [
            ('Общая выручка', report.total_revenue),
            ('Общие расходы', report.total_expenses),
            ('Чистая прибыль', report.net_profit),
            ('Рентабельность', (report.net_profit / report.total_revenue * 100) if report.total_revenue > 0 else 0)
        ]
        
        summary_ws.write(row, 0, 'Основные показатели', header_format)
        for label, value in summary_data:
            row += 1
            summary_ws.write(row, 0, label)
            if 'рентабельность' in label.lower():
                summary_ws.write(row, 1, value / 100, percent_format)
            else:
                summary_ws.write(row, 1, value, money_format)
        
        # Лист 2: Зарплаты
        payroll_ws = workbook.add_worksheet("Зарплаты")
        
        payroll_headers = [
            'Сотрудник', 'Роль', 'Базовая ставка', 'За задачи', 'Премии', 
            'Прочие доходы', 'БРУТТО', 'Подоходный налог', 'Социальный налог',
            'Общие вычеты', 'НЕТТО', 'Выплачено', 'Дата выплаты'
        ]
        
        for col, header in enumerate(payroll_headers):
            payroll_ws.write(0, col, header, header_format)
        
        for row, payroll in enumerate(report.staff_payroll, 1):
            payroll_ws.write(row, 0, payroll.name)
            payroll_ws.write(row, 1, payroll.role)
            payroll_ws.write(row, 2, payroll.base_salary, money_format)
            payroll_ws.write(row, 3, payroll.task_payments, money_format)
            payroll_ws.write(row, 4, payroll.bonuses, money_format)
            payroll_ws.write(row, 5, payroll.other_income, money_format)
            payroll_ws.write(row, 6, payroll.gross_amount, money_format)
            payroll_ws.write(row, 7, payroll.income_tax, money_format)
            payroll_ws.write(row, 8, payroll.social_tax, money_format)
            payroll_ws.write(row, 9, payroll.total_deductions, money_format)
            payroll_ws.write(row, 10, payroll.net_amount, money_format)
            payroll_ws.write(row, 11, "Да" if payroll.is_paid else "Нет")
            if payroll.paid_date:
                payroll_ws.write(row, 12, payroll.paid_date, date_format)
        
        # Лист 3: Товары и материалы
        inventory_ws = workbook.add_worksheet("Товары и материалы")
        
        inventory_headers = [
            'Наименование', 'Категория', 'Ед.изм.', 'Приход кол-во', 'Расход кол-во',
            'Остаток', 'Приход стоимость', 'Расход стоимость', 'Прибыль'
        ]
        
        for col, header in enumerate(inventory_headers):
            inventory_ws.write(0, col, header, header_format)
        
        for row, item in enumerate(report.inventory_movements, 1):
            inventory_ws.write(row, 0, item.item_name)
            inventory_ws.write(row, 1, item.category)
            inventory_ws.write(row, 2, item.unit)
            inventory_ws.write(row, 3, item.incoming_quantity)
            inventory_ws.write(row, 4, item.outgoing_quantity)
            inventory_ws.write(row, 5, item.current_stock)
            inventory_ws.write(row, 6, item.incoming_cost, money_format)
            inventory_ws.write(row, 7, item.outgoing_cost, money_format)
            inventory_ws.write(row, 8, item.net_profit, money_format)
        
        # Лист 4: Аренда помещений
        property_ws = workbook.add_worksheet("Аренда помещений")
        
        property_headers = [
            'Помещение', 'Номер', 'Общая выручка', 'Наличные', 'Карты',
            'Комиссия %', 'Комиссия сумма', 'Чистая выручка', 'Занято дней',
            'Всего дней', 'Загруженность %'
        ]
        
        for col, header in enumerate(property_headers):
            property_ws.write(0, col, header, header_format)
        
        for row, prop in enumerate(report.property_revenues, 1):
            property_ws.write(row, 0, prop.property_name)
            property_ws.write(row, 1, prop.property_number)
            property_ws.write(row, 2, prop.total_revenue, money_format)
            property_ws.write(row, 3, prop.cash_payments, money_format)
            property_ws.write(row, 4, prop.card_payments, money_format)
            property_ws.write(row, 5, prop.acquiring_commission_rate / 100, percent_format)
            property_ws.write(row, 6, prop.acquiring_commission_amount, money_format)
            property_ws.write(row, 7, prop.net_revenue_after_commission, money_format)
            property_ws.write(row, 8, prop.occupancy_days)
            property_ws.write(row, 9, prop.total_available_days)
            property_ws.write(row, 10, prop.occupancy_rate / 100, percent_format)
        
        # Лист 5: Административные расходы
        admin_ws = workbook.add_worksheet("Административные расходы")
        
        admin_headers = ['Категория', 'Описание', 'Сумма']
        
        for col, header in enumerate(admin_headers):
            admin_ws.write(0, col, header, header_format)
        
        for row, expense in enumerate(report.administrative_expenses, 1):
            admin_ws.write(row, 0, expense.category)
            admin_ws.write(row, 1, expense.description)
            admin_ws.write(row, 2, expense.amount, money_format)
        
        # Лист 6: Эквайринг статистика
        acquiring_ws = workbook.add_worksheet("Эквайринг")
        
        acq_stats = report.acquiring_statistics
        acquiring_data = [
            ('Общий оборот', acq_stats['total_payments']),
            ('Оплаты картами', acq_stats['card_payments']),
            ('Наличные оплаты', acq_stats['cash_payments']),
            ('Доля карточных оплат (%)', acq_stats['card_payment_percentage']),
            ('Комиссия уплачена', acq_stats['total_commission_paid']),
            ('Средняя ставка комиссии (%)', acq_stats['average_commission_rate'])
        ]
        
        acquiring_ws.write(0, 0, 'Показатель', header_format)
        acquiring_ws.write(0, 1, 'Значение', header_format)
        
        for row, (label, value) in enumerate(acquiring_data, 1):
            acquiring_ws.write(row, 0, label)
            if '%' in label:
                acquiring_ws.write(row, 1, value / 100, percent_format)
            else:
                acquiring_ws.write(row, 1, value, money_format)
        
        # Провайдеры эквайринга
        if acq_stats.get('providers'):
            acquiring_ws.write(row + 2, 0, 'Провайдеры эквайринга', header_format)
            provider_row = row + 3
            acquiring_ws.write(provider_row, 0, 'Провайдер', header_format)
            acquiring_ws.write(provider_row, 1, 'Активен', header_format)
            acquiring_ws.write(provider_row, 2, 'Комиссия %', header_format)
            
            for provider, info in acq_stats['providers'].items():
                provider_row += 1
                acquiring_ws.write(provider_row, 0, info.get('display_name', provider))
                acquiring_ws.write(provider_row, 1, 'Да' if info.get('enabled') else 'Нет')
                acquiring_ws.write(provider_row, 2, info.get('commission_rate', 0) / 100, percent_format)
        
        # Автоширина колонок для всех листов
        for worksheet in [summary_ws, payroll_ws, inventory_ws, property_ws, admin_ws, acquiring_ws]:
            worksheet.set_column('A:Z', 15)
        
        workbook.close()
        output.seek(0)
        return output.getvalue()
    
    @staticmethod
    def export_to_xml(report: ComprehensiveReportResponse) -> bytes:
        """Экспорт в XML"""
        
        root = ET.Element("ComprehensiveReport")
        root.set("organization", report.organization_name)
        root.set("generated_at", report.generated_at.isoformat())
        
        # Период отчета
        period = ET.SubElement(root, "ReportPeriod")
        period.set("start_date", report.report_period["start_date"].isoformat())
        period.set("end_date", report.report_period["end_date"].isoformat())
        
        # Сводка
        summary = ET.SubElement(root, "Summary")
        ET.SubElement(summary, "TotalRevenue").text = str(report.total_revenue)
        ET.SubElement(summary, "TotalExpenses").text = str(report.total_expenses)
        ET.SubElement(summary, "NetProfit").text = str(report.net_profit)
        
        # Зарплаты
        payroll_section = ET.SubElement(root, "StaffPayroll")
        payroll_summary = ET.SubElement(payroll_section, "Summary")
        
        for key, value in report.payroll_summary.items():
            ET.SubElement(payroll_summary, key.title().replace('_', '')).text = str(value)
        
        payroll_details = ET.SubElement(payroll_section, "Details")
        for payroll in report.staff_payroll:
            staff_elem = ET.SubElement(payroll_details, "Staff")
            staff_elem.set("user_id", payroll.user_id)
            staff_elem.set("name", payroll.name)
            staff_elem.set("role", payroll.role)
            
            ET.SubElement(staff_elem, "BaseSalary").text = str(payroll.base_salary)
            ET.SubElement(staff_elem, "TaskPayments").text = str(payroll.task_payments)
            ET.SubElement(staff_elem, "Bonuses").text = str(payroll.bonuses)
            ET.SubElement(staff_elem, "OtherIncome").text = str(payroll.other_income)
            ET.SubElement(staff_elem, "GrossAmount").text = str(payroll.gross_amount)
            ET.SubElement(staff_elem, "IncomeTax").text = str(payroll.income_tax)
            ET.SubElement(staff_elem, "SocialTax").text = str(payroll.social_tax)
            ET.SubElement(staff_elem, "TotalDeductions").text = str(payroll.total_deductions)
            ET.SubElement(staff_elem, "NetAmount").text = str(payroll.net_amount)
            ET.SubElement(staff_elem, "IsPaid").text = str(payroll.is_paid)
            if payroll.paid_date:
                ET.SubElement(staff_elem, "PaidDate").text = payroll.paid_date.isoformat()
        
        # Товары и материалы
        inventory_section = ET.SubElement(root, "InventoryMovements")
        inventory_summary = ET.SubElement(inventory_section, "Summary")
        
        for key, value in report.inventory_summary.items():
            ET.SubElement(inventory_summary, key.title().replace('_', '')).text = str(value)
        
        inventory_details = ET.SubElement(inventory_section, "Details")
        for item in report.inventory_movements:
            item_elem = ET.SubElement(inventory_details, "Item")
            item_elem.set("inventory_id", item.inventory_id)
            item_elem.set("name", item.item_name)
            item_elem.set("category", item.category)
            item_elem.set("unit", item.unit)
            
            ET.SubElement(item_elem, "IncomingQuantity").text = str(item.incoming_quantity)
            ET.SubElement(item_elem, "OutgoingQuantity").text = str(item.outgoing_quantity)
            ET.SubElement(item_elem, "CurrentStock").text = str(item.current_stock)
            ET.SubElement(item_elem, "IncomingCost").text = str(item.incoming_cost)
            ET.SubElement(item_elem, "OutgoingCost").text = str(item.outgoing_cost)
            ET.SubElement(item_elem, "NetProfit").text = str(item.net_profit)
        
        # Аренда помещений
        property_section = ET.SubElement(root, "PropertyRevenues")
        property_summary = ET.SubElement(property_section, "Summary")
        
        for key, value in report.property_summary.items():
            ET.SubElement(property_summary, key.title().replace('_', '')).text = str(value)
        
        property_details = ET.SubElement(property_section, "Details")
        for prop in report.property_revenues:
            prop_elem = ET.SubElement(property_details, "Property")
            prop_elem.set("property_id", prop.property_id)
            prop_elem.set("name", prop.property_name)
            prop_elem.set("number", prop.property_number)
            
            ET.SubElement(prop_elem, "TotalRevenue").text = str(prop.total_revenue)
            ET.SubElement(prop_elem, "CashPayments").text = str(prop.cash_payments)
            ET.SubElement(prop_elem, "CardPayments").text = str(prop.card_payments)
            ET.SubElement(prop_elem, "AcquiringCommissionRate").text = str(prop.acquiring_commission_rate)
            ET.SubElement(prop_elem, "AcquiringCommissionAmount").text = str(prop.acquiring_commission_amount)
            ET.SubElement(prop_elem, "NetRevenueAfterCommission").text = str(prop.net_revenue_after_commission)
            ET.SubElement(prop_elem, "OccupancyDays").text = str(prop.occupancy_days)
            ET.SubElement(prop_elem, "TotalAvailableDays").text = str(prop.total_available_days)
            ET.SubElement(prop_elem, "OccupancyRate").text = str(prop.occupancy_rate)
        
        # Административные расходы
        admin_section = ET.SubElement(root, "AdministrativeExpenses")
        admin_summary = ET.SubElement(admin_section, "Summary")
        
        for key, value in report.administrative_summary.items():
            ET.SubElement(admin_summary, key.title().replace('_', '')).text = str(value)
        
        admin_details = ET.SubElement(admin_section, "Details")
        for expense in report.administrative_expenses:
            expense_elem = ET.SubElement(admin_details, "Expense")
            expense_elem.set("category", expense.category)
            
            ET.SubElement(expense_elem, "Description").text = expense.description
            ET.SubElement(expense_elem, "Amount").text = str(expense.amount)
        
        # Эквайринг статистика
        acquiring_section = ET.SubElement(root, "AcquiringStatistics")
        
        for key, value in report.acquiring_statistics.items():
            if key == "providers":
                providers_elem = ET.SubElement(acquiring_section, "Providers")
                for provider, info in value.items():
                    provider_elem = ET.SubElement(providers_elem, "Provider")
                    provider_elem.set("name", provider)
                    for info_key, info_value in info.items():
                        ET.SubElement(provider_elem, info_key.title().replace('_', '')).text = str(info_value)
            else:
                ET.SubElement(acquiring_section, key.title().replace('_', '')).text = str(value)
        
        # Форматируем XML
        rough_string = ET.tostring(root, 'utf-8')
        reparsed = minidom.parseString(rough_string)
        pretty_xml = reparsed.toprettyxml(indent="  ", encoding='utf-8')
        
        return pretty_xml