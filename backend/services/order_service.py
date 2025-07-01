from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
import uuid

from models.extended_models import RoomOrder, OrderStatus, User, UserRole, PayrollType
from schemas.order import RoomOrderCreate, RoomOrderUpdate


class OrderService:
    """Сервис для управления заказами в номер"""
    
    @staticmethod
    def get_order_by_id(db: Session, order_id: uuid.UUID, organization_id: uuid.UUID) -> Optional[RoomOrder]:
        """Получить заказ по ID с проверкой принадлежности к организации"""
        return db.query(RoomOrder).filter(
            and_(
                RoomOrder.id == order_id,
                RoomOrder.organization_id == organization_id
            )
        ).first()
    
    @staticmethod
    def create_order(
        db: Session,
        order_data: RoomOrderCreate,
        organization_id: uuid.UUID
    ) -> RoomOrder:
        """Создать новый заказ"""
        
        # Генерируем номер заказа
        order_number = OrderService._generate_order_number(db, organization_id)
        
        order = RoomOrder(
            id=uuid.uuid4(),
            organization_id=organization_id,
            order_number=order_number,
            **order_data.dict(exclude={'assigned_to'}),
            status=OrderStatus.PENDING
        )
        
        # Назначаем исполнителя если указан
        if order_data.assigned_to:
            order.assigned_to = uuid.UUID(order_data.assigned_to)
            order.status = OrderStatus.CONFIRMED
        else:
            # Автоматически назначаем исполнителя по типу заказа
            assigned_user = OrderService._auto_assign_executor(db, organization_id, order_data.order_type)
            if assigned_user:
                order.assigned_to = assigned_user.id
                order.status = OrderStatus.CONFIRMED
        
        db.add(order)
        db.commit()
        db.refresh(order)
        
        return order
    
    @staticmethod
    def _generate_order_number(db: Session, organization_id: uuid.UUID) -> str:
        """Генерировать номер заказа"""
        today = datetime.now(timezone.utc).date()
        date_prefix = today.strftime("%Y%m%d")
        
        # Считаем заказы за сегодня
        today_orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.organization_id == organization_id,
                func.date(RoomOrder.requested_at) == today
            )
        ).count()
        
        return f"{date_prefix}-{today_orders + 1:04d}"
    
    @staticmethod
    def _auto_assign_executor(db: Session, organization_id: uuid.UUID, order_type: str) -> Optional[User]:
        """Автоматически назначить исполнителя по типу заказа"""
        
        # Определяем подходящие роли для типа заказа
        role_mapping = {
            "food": [UserRole.STOREKEEPER],
            "delivery": [UserRole.STOREKEEPER, UserRole.TECHNICAL_STAFF],
            "service": [UserRole.TECHNICAL_STAFF, UserRole.CLEANER],
            "laundry": [UserRole.CLEANER],
            "maintenance": [UserRole.TECHNICAL_STAFF]
        }
        
        suitable_roles = role_mapping.get(order_type, [UserRole.TECHNICAL_STAFF])
        
        # Находим наименее загруженного сотрудника
        min_workload = float('inf')
        selected_user = None
        
        for role in suitable_roles:
            users = db.query(User).filter(
                and_(
                    User.organization_id == organization_id,
                    User.role == role,
                    User.status == "active"
                )
            ).all()
            
            for user in users:
                # Считаем активные заказы
                active_orders = db.query(RoomOrder).filter(
                    and_(
                        RoomOrder.assigned_to == user.id,
                        RoomOrder.status.in_([OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS])
                    )
                ).count()
                
                if active_orders < min_workload:
                    min_workload = active_orders
                    selected_user = user
        
        return selected_user
    
    @staticmethod
    def update_order(
        db: Session,
        order: RoomOrder,
        order_data: RoomOrderUpdate,
        user_id: uuid.UUID
    ) -> RoomOrder:
        """Обновить заказ"""
        
        update_data = order_data.dict(exclude_unset=True)
        old_status = order.status
        
        for field, value in update_data.items():
            setattr(order, field, value)
        
        order.updated_at = datetime.now(timezone.utc)
        
        # Обрабатываем изменение статуса
        if 'status' in update_data and order.status != old_status:
            if order.status == OrderStatus.IN_PROGRESS and old_status == OrderStatus.CONFIRMED:
                # Заказ взят в работу
                pass
            elif order.status == OrderStatus.DELIVERED and old_status == OrderStatus.IN_PROGRESS:
                # Заказ выполнен
                order.completed_at = datetime.now(timezone.utc)
                OrderService._process_order_payment(db, order)
        
        db.commit()
        db.refresh(order)
        
        return order
    
    @staticmethod
    def assign_order(
        db: Session,
        order: RoomOrder,
        assigned_to: uuid.UUID,
        assigned_by: uuid.UUID
    ):
        """Назначить заказ исполнителю"""
        
        order.assigned_to = assigned_to
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.CONFIRMED
        order.updated_at = datetime.now(timezone.utc)
        
        db.commit()
    
    @staticmethod
    def complete_order(
        db: Session,
        order: RoomOrder,
        completed_by: uuid.UUID,
        completion_notes: Optional[str] = None
    ) -> RoomOrder:
        """Завершить заказ"""
        
        order.status = OrderStatus.DELIVERED
        order.completed_at = datetime.now(timezone.utc)
        order.updated_at = datetime.now(timezone.utc)
        
        if completion_notes:
            order.special_instructions = (order.special_instructions or "") + f"\nВыполнено: {completion_notes}"
        
        # Обрабатываем оплату исполнителю
        OrderService._process_order_payment(db, order)
        
        db.commit()
        db.refresh(order)
        
        return order
    
    @staticmethod
    def _process_order_payment(db: Session, order: RoomOrder):
        """Обработать оплату за выполненный заказ"""
        
        if order.payment_type == "none" or order.payment_to_executor <= 0:
            return
        
        if not order.assigned_to:
            return
        
        # Получаем исполнителя
        assignee = db.query(User).filter(User.id == order.assigned_to).first()
        if not assignee:
            return
        
        # Добавляем к зарплате (аналогично задачам)
        from models.extended_models import Payroll
        
        current_period_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = current_period_start.replace(month=current_period_start.month + 1)
        current_period_end = next_month - timedelta(seconds=1)
        
        # Ищем существующую запись о зарплате
        payroll = db.query(Payroll).filter(
            and_(
                Payroll.user_id == assignee.id,
                Payroll.period_start == current_period_start,
                Payroll.period_end == current_period_end
            )
        ).first()
        
        if not payroll:
            payroll = Payroll(
                id=uuid.uuid4(),
                organization_id=order.organization_id,
                user_id=assignee.id,
                period_start=current_period_start,
                period_end=current_period_end,
                payroll_type=PayrollType.PIECE_WORK,
                tasks_completed=0,
                tasks_payment=0,
                other_income=0,
                gross_amount=0,
                net_amount=0
            )
            db.add(payroll)
        
        # Добавляем доход от заказа
        payroll.other_income += order.payment_to_executor
        
        # Пересчитываем общую сумму
        payroll.gross_amount = (
            (payroll.base_rate or 0) + 
            payroll.tasks_payment + 
            payroll.bonus + 
            payroll.tips + 
            payroll.other_income
        )
        payroll.net_amount = payroll.gross_amount - payroll.deductions - payroll.taxes
        payroll.updated_at = datetime.now(timezone.utc)
        
        # Отмечаем заказ как оплаченный
        order.is_paid = True
    
    @staticmethod
    def get_orders_statistics(
        db: Session,
        organization_id: uuid.UUID,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """Получить статистику по заказам"""
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Заказы за период
        orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.organization_id == organization_id,
                RoomOrder.requested_at >= start_date
            )
        ).all()
        
        # Группируем по статусам
        status_counts = {}
        for status in OrderStatus:
            status_counts[status.value] = len([o for o in orders if o.status == status])
        
        # Группируем по типам
        type_stats = {}
        order_types = set(o.order_type for o in orders)
        
        for order_type in order_types:
            type_orders = [o for o in orders if o.order_type == order_type]
            type_stats[order_type] = {
                "count": len(type_orders),
                "revenue": sum(o.total_amount for o in type_orders),
                "avg_amount": sum(o.total_amount for o in type_orders) / len(type_orders) if type_orders else 0
            }
        
        # Выполненные заказы
        completed_orders = [o for o in orders if o.status == OrderStatus.DELIVERED]
        
        # Средние времена
        avg_completion_time = None
        if completed_orders:
            completion_times = []
            for order in completed_orders:
                if order.completed_at and order.requested_at:
                    completion_time = (order.completed_at - order.requested_at).total_seconds() / 3600  # в часах
                    completion_times.append(completion_time)
            
            if completion_times:
                avg_completion_time = sum(completion_times) / len(completion_times)
        
        # Финансовые метрики
        total_revenue = sum(o.total_amount for o in orders)
        paid_revenue = sum(o.total_amount for o in orders if o.is_paid)
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": period_days
            },
            "totals": {
                "total_orders": len(orders),
                "completed_orders": len(completed_orders),
                "completion_rate": (len(completed_orders) / len(orders) * 100) if orders else 0
            },
            "by_status": status_counts,
            "by_type": type_stats,
            "financial": {
                "total_revenue": total_revenue,
                "paid_revenue": paid_revenue,
                "outstanding_revenue": total_revenue - paid_revenue,
                "avg_order_value": total_revenue / len(orders) if orders else 0
            },
            "performance": {
                "avg_completion_time_hours": avg_completion_time
            }
        }
