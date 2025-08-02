# services/payroll_extended_service.py
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func,or_
import uuid

from models.database import get_db
from models.extended_models import User, UserRole, Task, TaskStatus
from models.payroll_template import PayrollTemplate, PayrollTemplateStatus
from models.payroll_operation import PayrollOperation, PayrollOperationType
from models.extended_models import Payroll, PayrollType
from schemas.payroll_template import PayrollTemplateCreate, PayrollTemplateUpdate
from schemas.payroll_operation import PayrollOperationCreate


class PayrollExtendedService:
    """Расширенный сервис для управления зарплатами с шаблонами и операциями"""
    
    @staticmethod
    def create_payroll_template(
        db: Session,
        template_data: PayrollTemplateCreate,
        organization_id: uuid.UUID,
        created_by: uuid.UUID
    ) -> PayrollTemplate:
        """Создать шаблон зарплаты для сотрудника"""
        
        template = PayrollTemplate(
            id=uuid.uuid4(),
            organization_id=organization_id,
            **template_data.dict(),
            status=PayrollTemplateStatus.ACTIVE,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        return template
    
    @staticmethod
    def auto_generate_monthly_payrolls(
        db: Session,
        organization_id: uuid.UUID,
        year: int,
        month: int
    ) -> List[Payroll]:
        """Автоматическое создание зарплат на основе шаблонов"""
        
        # Определяем период
        period_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        
        # Получаем все активные шаблоны
        templates = db.query(PayrollTemplate).filter(
            and_(
                PayrollTemplate.organization_id == organization_id,
                PayrollTemplate.status == PayrollTemplateStatus.ACTIVE,
                PayrollTemplate.effective_from <= period_start,
                or_(
                    PayrollTemplate.effective_until.is_(None),
                    PayrollTemplate.effective_until >= period_end
                )
            )
        ).all()
        
        payrolls_created = []
        
        for template in templates:
            # Проверяем, нет ли уже зарплаты за этот период
            existing_payroll = db.query(Payroll).filter(
                and_(
                    Payroll.user_id == template.user_id,
                    Payroll.period_start == period_start,
                    Payroll.period_end == period_end
                )
            ).first()
            
            if existing_payroll:
                continue
            
            # Создаем зарплату на основе шаблона
            payroll = PayrollExtendedService._create_payroll_from_template(
                db, template, period_start, period_end
            )
            
            if payroll:
                payrolls_created.append(payroll)
        
        return payrolls_created
    
    @staticmethod
    def _create_payroll_from_template(
        db: Session,
        template: PayrollTemplate,
        period_start: datetime,
        period_end: datetime
    ) -> Optional[Payroll]:
        """Создать зарплату на основе шаблона"""
        
        # Получаем выполненные задачи за период (если включены в шаблон)
        tasks_payment = 0
        tasks_completed = 0
        
        if template.include_task_payments:
            completed_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == template.user_id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= period_start,
                    Task.completed_at <= period_end,
                    Task.is_paid == True
                )
            ).all()
            
            tasks_completed = len(completed_tasks)
            tasks_payment = sum(
                (task.payment_amount or 0) + (template.task_payment_rate or 0) 
                for task in completed_tasks
            )
        
        # Применяем автоматические надбавки
        allowances_total = sum(template.automatic_allowances.values())
        
        # Применяем автоматические вычеты
        deductions_total = sum(template.automatic_deductions.values())
        
        # Получаем операции за период
        operations = db.query(PayrollOperation).filter(
            and_(
                PayrollOperation.user_id == template.user_id,
                PayrollOperation.apply_to_period_start <= period_end,
                PayrollOperation.apply_to_period_end >= period_start,
                PayrollOperation.is_applied == False
            )
        ).all()
        
        # Применяем операции
        bonus_total = 0
        penalty_total = 0
        overtime_total = 0
        other_income = 0
        additional_deductions = 0
        
        for operation in operations:
            if operation.operation_type == PayrollOperationType.BONUS:
                bonus_total += operation.amount
            elif operation.operation_type == PayrollOperationType.PENALTY:
                penalty_total += abs(operation.amount)  # Штрафы всегда положительные в вычетах
            elif operation.operation_type == PayrollOperationType.OVERTIME:
                overtime_total += operation.amount
            elif operation.operation_type in [
                PayrollOperationType.ALLOWANCE, 
                PayrollOperationType.COMMISSION,
                PayrollOperationType.HOLIDAY_PAY
            ]:
                other_income += operation.amount
            elif operation.operation_type == PayrollOperationType.DEDUCTION:
                additional_deductions += abs(operation.amount)
        
        # Рассчитываем базовую сумму
        base_amount = template.base_rate
        
        # Рассчитываем брутто
        gross_amount = (
            base_amount +
            tasks_payment +
            allowances_total +
            bonus_total +
            overtime_total +
            other_income
        )
        
        # Рассчитываем вычеты
        total_deductions = (
            deductions_total +
            penalty_total +
            additional_deductions
        )
        
        # Рассчитываем налоги
        taxes = gross_amount * template.tax_rate
        social_contributions = gross_amount * template.social_rate
        
        # Итоговые суммы
        net_amount = gross_amount - total_deductions - taxes - social_contributions
        
        # Создаем зарплату
        payroll = Payroll(
            id=uuid.uuid4(),
            organization_id=template.organization_id,
            user_id=template.user_id,
            period_start=period_start,
            period_end=period_end,
            payroll_type=template.payroll_type,
            base_rate=base_amount,
            tasks_completed=tasks_completed,
            tasks_payment=tasks_payment,
            bonus=bonus_total,
            other_income=allowances_total + overtime_total + other_income,
            deductions=total_deductions,
            taxes=taxes + social_contributions,
            gross_amount=gross_amount,
            net_amount=max(0, net_amount),  # Не может быть отрицательной
            template_id=template.id,
            generated_from_template=True,
            operations_summary={
                "allowances": allowances_total,
                "overtime": overtime_total,
                "penalties": penalty_total,
                "operations_count": len(operations)
            }
        )
        
        db.add(payroll)
        
        # Отмечаем операции как примененные
        for operation in operations:
            operation.is_applied = True
            operation.applied_at = datetime.now(timezone.utc)
            operation.payroll_id = payroll.id
        
        db.commit()
        db.refresh(payroll)
        
        return payroll
    
    @staticmethod
    def add_payroll_operation(
        db: Session,
        operation_data: PayrollOperationCreate,
        organization_id: uuid.UUID,
        created_by: uuid.UUID
    ) -> PayrollOperation:
        """Добавить операцию с зарплатой"""
        
        operation = PayrollOperation(
            id=uuid.uuid4(),
            organization_id=organization_id,
            created_by=created_by,
            **operation_data.dict(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        db.add(operation)
        db.commit()
        db.refresh(operation)
        
        return operation
    
    @staticmethod
    def recalculate_payroll_with_operations(db: Session, payroll: Payroll):
        """Пересчитать зарплату с учетом всех операций"""
        
        # Получаем шаблон если есть
        template = None
        if payroll.template_id:
            template = db.query(PayrollTemplate).filter(
                PayrollTemplate.id == payroll.template_id
            ).first()
        
        # Получаем неприменённые операции за период
        operations = db.query(PayrollOperation).filter(
            and_(
                PayrollOperation.user_id == payroll.user_id,
                PayrollOperation.apply_to_period_start <= payroll.period_end,
                PayrollOperation.apply_to_period_end >= payroll.period_start,
                PayrollOperation.is_applied == False
            )
        ).all()
        
        # Сбрасываем примененные операции для этой зарплаты
        old_operations = db.query(PayrollOperation).filter(
            PayrollOperation.payroll_id == payroll.id
        ).all()
        
        for op in old_operations:
            op.is_applied = False
            op.applied_at = None
            op.payroll_id = None
        
        # Базовые значения из текущей зарплаты
        base_amount = payroll.base_rate or 0
        tasks_payment = payroll.tasks_payment
        base_bonus = payroll.bonus
        base_other_income = payroll.other_income
        base_deductions = payroll.deductions
        
        # Применяем новые операции
        additional_bonus = 0
        additional_penalties = 0
        additional_overtime = 0
        additional_income = 0
        additional_deductions = 0
        
        for operation in operations:
            if operation.operation_type == PayrollOperationType.BONUS:
                additional_bonus += operation.amount
            elif operation.operation_type == PayrollOperationType.PENALTY:
                additional_penalties += abs(operation.amount)
            elif operation.operation_type == PayrollOperationType.OVERTIME:
                additional_overtime += operation.amount
            elif operation.operation_type in [
                PayrollOperationType.ALLOWANCE,
                PayrollOperationType.COMMISSION,
                PayrollOperationType.HOLIDAY_PAY,
                PayrollOperationType.VACATION_PAY,
                PayrollOperationType.SICK_LEAVE
            ]:
                additional_income += operation.amount
            elif operation.operation_type == PayrollOperationType.DEDUCTION:
                additional_deductions += abs(operation.amount)
            elif operation.operation_type == PayrollOperationType.ADVANCE:
                # Аванс - это предварительная выплата, вычитается из итоговой суммы
                additional_deductions += abs(operation.amount)
        
        # Пересчитываем суммы
        payroll.bonus = base_bonus + additional_bonus
        payroll.other_income = base_other_income + additional_overtime + additional_income
        payroll.deductions = base_deductions + additional_penalties + additional_deductions
        
        # Применяем налоги (если есть шаблон, используем его ставки)
        tax_rate = template.tax_rate if template else 0.1
        social_rate = template.social_rate if template else 0.1
        
        payroll.gross_amount = (
            base_amount +
            tasks_payment +
            payroll.bonus +
            payroll.other_income
        )
        
        gross_for_tax = payroll.gross_amount - payroll.deductions
        payroll.taxes = gross_for_tax * tax_rate + gross_for_tax * social_rate
        
        payroll.net_amount = max(0, payroll.gross_amount - payroll.deductions - payroll.taxes)
        payroll.updated_at = datetime.now(timezone.utc)
        
        # Обновляем сводку операций
        payroll.operations_summary = {
            "bonus_operations": additional_bonus,
            "penalty_operations": additional_penalties,
            "overtime_operations": additional_overtime,
            "other_income_operations": additional_income,
            "deduction_operations": additional_deductions,
            "operations_applied": len(operations)
        }
        
        # Отмечаем операции как примененные
        for operation in operations:
            operation.is_applied = True
            operation.applied_at = datetime.now(timezone.utc)
            operation.payroll_id = payroll.id
        
        db.commit()
    
    @staticmethod
    def create_quick_bonus(
        db: Session,
        user_id: uuid.UUID,
        amount: float,
        reason: str,
        organization_id: uuid.UUID,
        created_by: uuid.UUID,
        apply_to_current_month: bool = True
    ) -> PayrollOperation:
        """Быстро добавить премию"""
        
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
            user_id=str(user_id),
            operation_type=PayrollOperationType.BONUS,
            amount=amount,
            title=f"Премия: {reason}",
            reason=reason,
            apply_to_period_start=period_start,
            apply_to_period_end=period_end
        )
        
        return PayrollExtendedService.add_payroll_operation(
            db, operation_data, organization_id, created_by
        )
    
    @staticmethod
    def create_quick_penalty(
        db: Session,
        user_id: uuid.UUID,
        amount: float,
        reason: str,
        organization_id: uuid.UUID,
        created_by: uuid.UUID,
        apply_to_current_month: bool = True
    ) -> PayrollOperation:
        """Быстро добавить штраф"""
        
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
            user_id=str(user_id),
            operation_type=PayrollOperationType.PENALTY,
            amount=-abs(amount),  # Штрафы всегда отрицательные
            title=f"Штраф: {reason}",
            reason=reason,
            apply_to_period_start=period_start,
            apply_to_period_end=period_end
        )
        
        return PayrollExtendedService.add_payroll_operation(
            db, operation_data, organization_id, created_by
        )
    
    @staticmethod
    def create_overtime_payment(
        db: Session,
        user_id: uuid.UUID,
        hours: float,
        hourly_rate: Optional[float],
        description: str,
        organization_id: uuid.UUID,
        created_by: uuid.UUID
    ) -> PayrollOperation:
        """Добавить сверхурочные"""
        
        # Получаем шаблон пользователя для расчета ставки
        template = db.query(PayrollTemplate).filter(
            and_(
                PayrollTemplate.user_id == user_id,
                PayrollTemplate.status == PayrollTemplateStatus.ACTIVE
            )
        ).first()
        
        if not template:
            raise ValueError("User has no active payroll template")
        
        # Рассчитываем оплату
        if hourly_rate is None:
            # Месячная ставка / 160 часов
            hourly_rate = template.base_rate / 160
        
        overtime_amount = hours * hourly_rate * template.overtime_rate_multiplier
        
        now = datetime.now(timezone.utc)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        if now.month == 12:
            period_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            period_end = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(seconds=1)
        
        operation_data = PayrollOperationCreate(
            user_id=str(user_id),
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
        
        return PayrollExtendedService.add_payroll_operation(
            db, operation_data, organization_id, created_by
        )
    
    @staticmethod
    def get_user_payroll_summary(
        db: Session,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        months_back: int = 6
    ) -> Dict[str, Any]:
        """Получить сводку по зарплате пользователя"""
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=months_back * 30)
        
        # Получаем зарплаты
        payrolls = db.query(Payroll).filter(
            and_(
                Payroll.user_id == user_id,
                Payroll.organization_id == organization_id,
                Payroll.period_start >= start_date
            )
        ).order_by(desc(Payroll.period_start)).all()
        
        # Получаем операции
        operations = db.query(PayrollOperation).filter(
            and_(
                PayrollOperation.user_id == user_id,
                PayrollOperation.organization_id == organization_id,
                PayrollOperation.apply_to_period_start >= start_date
            )
        ).order_by(desc(PayrollOperation.created_at)).all()
        
        # Получаем активный шаблон
        template = db.query(PayrollTemplate).filter(
            and_(
                PayrollTemplate.user_id == user_id,
                PayrollTemplate.status == PayrollTemplateStatus.ACTIVE
            )
        ).first()
        
        # Группируем операции по типам
        operations_by_type = {}
        for op in operations:
            op_type = op.operation_type.value
            if op_type not in operations_by_type:
                operations_by_type[op_type] = []
            operations_by_type[op_type].append({
                "id": str(op.id),
                "amount": op.amount,
                "title": op.title,
                "created_at": op.created_at,
                "is_applied": op.is_applied
            })
        
        # Статистика
        total_gross = sum(p.gross_amount for p in payrolls)
        total_net = sum(p.net_amount for p in payrolls)
        avg_net = total_net / len(payrolls) if payrolls else 0
        
        return {
            "user_id": str(user_id),
            "current_template": {
                "id": str(template.id) if template else None,
                "name": template.name if template else None,
                "base_rate": template.base_rate if template else 0,
                "payroll_type": template.payroll_type.value if template else None
            } if template else None,
            "period_summary": {
                "months_analyzed": months_back,
                "payrolls_count": len(payrolls),
                "total_gross": total_gross,
                "total_net": total_net,
                "average_net": avg_net
            },
            "recent_payrolls": [
                {
                    "id": str(p.id),
                    "period": p.period_start.strftime("%Y-%m"),
                    "gross_amount": p.gross_amount,
                    "net_amount": p.net_amount,
                    "is_paid": p.is_paid
                }
                for p in payrolls[:6]
            ],
            "operations_by_type": operations_by_type,
            "pending_operations": len([op for op in operations if not op.is_applied])
        }
    
    @staticmethod
    def apply_recurring_operations(db: Session, organization_id: uuid.UUID):
        """Применить повторяющиеся операции"""
        
        now = datetime.now(timezone.utc)
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Находим операции, которые должны повториться в этом месяце
        recurring_operations = db.query(PayrollOperation).filter(
            and_(
                PayrollOperation.organization_id == organization_id,
                PayrollOperation.is_recurring == True,
                PayrollOperation.apply_to_period_start < current_month_start
            )
        ).all()
        
        for original_op in recurring_operations:
            # Проверяем, не создавали ли уже операцию на этот месяц
            existing_op = db.query(PayrollOperation).filter(
                and_(
                    PayrollOperation.user_id == original_op.user_id,
                    PayrollOperation.operation_type == original_op.operation_type,
                    PayrollOperation.title == original_op.title,
                    PayrollOperation.apply_to_period_start >= current_month_start
                )
            ).first()
            
            if existing_op:
                continue
            
            # Создаем новую операцию на текущий месяц
            if current_month_start.month == 12:
                next_month_start = datetime(current_month_start.year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                next_month_start = current_month_start.replace(month=current_month_start.month + 1)
            
            current_month_end = next_month_start - timedelta(seconds=1)
            
            new_operation = PayrollOperation(
                id=uuid.uuid4(),
                organization_id=original_op.organization_id,
                user_id=original_op.user_id,
                created_by=original_op.created_by,
                operation_type=original_op.operation_type,
                amount=original_op.amount,
                title=original_op.title,
                description=original_op.description,
                reason=original_op.reason,
                apply_to_period_start=current_month_start,
                apply_to_period_end=current_month_end,
                is_recurring=True,
                recurrence_months=original_op.recurrence_months,
                metadata=original_op.metadata,
                is_applied=False
            )
            
            db.add(new_operation)
        
        db.commit()
    
    @staticmethod
    def get_payroll_forecast(
        db: Session,
        organization_id: uuid.UUID,
        forecast_months: int = 3
    ) -> Dict[str, Any]:
        """Прогноз расходов на зарплату"""
        
        # Получаем активные шаблоны
        active_templates = db.query(PayrollTemplate).filter(
            and_(
                PayrollTemplate.organization_id == organization_id,
                PayrollTemplate.status == PayrollTemplateStatus.ACTIVE
            )
        ).all()
        
        # Получаем среднюю оплату задач за последние 3 месяца
        three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
        avg_task_payments = {}
        
        for template in active_templates:
            if template.include_task_payments:
                avg_payment = db.query(func.avg(Payroll.tasks_payment)).filter(
                    and_(
                        Payroll.user_id == template.user_id,
                        Payroll.period_start >= three_months_ago
                    )
                ).scalar() or 0
                avg_task_payments[str(template.user_id)] = avg_payment
        
        # Прогнозируем на будущие месяцы
        forecast_data = []
        
        for month_offset in range(1, forecast_months + 1):
            total_forecast = 0
            staff_forecast = []
            
            for template in active_templates:
                # Базовая ставка
                base_amount = template.base_rate
                
                # Прогноз оплаты задач
                task_payment_forecast = avg_task_payments.get(str(template.user_id), 0)
                
                # Автоматические надбавки
                allowances = sum(template.automatic_allowances.values())
                
                # Примерные налоги
                gross = base_amount + task_payment_forecast + allowances
                taxes = gross * (template.tax_rate + template.social_rate)
                
                net_forecast = gross - taxes
                total_forecast += net_forecast
                
                staff_forecast.append({
                    "user_id": str(template.user_id),
                    "user_name": template.name,
                    "base_rate": base_amount,
                    "estimated_tasks": task_payment_forecast,
                    "allowances": allowances,
                    "gross_forecast": gross,
                    "net_forecast": net_forecast
                })
            
            forecast_data.append({
                "month_offset": month_offset,
                "total_forecast": total_forecast,
                "staff_count": len(active_templates),
                "average_per_employee": total_forecast / len(active_templates) if active_templates else 0,
                "staff_breakdown": staff_forecast
            })
        
        return {
            "forecast_period_months": forecast_months,
            "total_active_employees": len(active_templates),
            "monthly_forecasts": forecast_data,
            "summary": {
                "min_monthly_cost": min(f["total_forecast"] for f in forecast_data),
                "max_monthly_cost": max(f["total_forecast"] for f in forecast_data),
                "avg_monthly_cost": sum(f["total_forecast"] for f in forecast_data) / len(forecast_data)
            }
        }