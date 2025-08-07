# backend/services/order_service.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
import uuid

from models.extended_models import (
    RoomOrder, OrderStatus, User, UserRole, Inventory, InventoryMovement
)
from schemas.order import RoomOrderCreate, RoomOrderUpdate, RoomOrderResponse, OrderItemBase


class OrderService:
    """Enhanced order service with inventory integration"""
    
    @staticmethod
    def create_order_with_inventory_check(
        db: Session,
        order_data: RoomOrderCreate,
        organization_id: uuid.UUID
    ) -> RoomOrder:
        """Create order with comprehensive inventory validation"""
        
        # Step 1: Validate inventory availability for all items
        inventory_validations = []
        
        for item in order_data.items:
            if item.is_inventory_item and item.inventory_id:
                inventory_item = db.query(Inventory).filter(
                    and_(
                        Inventory.id == uuid.UUID(item.inventory_id),
                        Inventory.organization_id == organization_id,
                        Inventory.is_active == True
                    )
                ).first()
                
                if not inventory_item:
                    raise ValueError(f"Inventory item not found: {item.inventory_id}")
                
                if inventory_item.current_stock < item.quantity:
                    raise ValueError(
                        f"Insufficient stock for '{item.name}'. "
                        f"Available: {inventory_item.current_stock}, "
                        f"Requested: {item.quantity}"
                    )
                
                inventory_validations.append({
                    'item': item,
                    'inventory': inventory_item
                })

        # Step 2: Generate order number
        order_number = OrderService._generate_order_number(db, organization_id)
        
        # Step 3: Create the order with correct initial status
        initial_status = OrderStatus.PENDING
        if order_data.assigned_to:
            initial_status = OrderStatus.CONFIRMED  # Если есть исполнитель - сразу подтвержденный
        
        order = RoomOrder(
            id=uuid.uuid4(),
            organization_id=organization_id,
            order_number=order_number,
            property_id=uuid.UUID(order_data.property_id),
            order_type=order_data.order_type,
            title=order_data.title,
            description=order_data.description,
            items=OrderService._serialize_order_items(order_data.items),
            total_amount=order_data.total_amount,
            special_instructions=order_data.special_instructions,
            status=initial_status  # ИСПРАВЛЕНО: правильный начальный статус
        )
        
        # Set optional fields
        if order_data.client_id:
            order.client_id = uuid.UUID(order_data.client_id)
        if order_data.rental_id:
            order.rental_id = uuid.UUID(order_data.rental_id)
        if order_data.assigned_to:
            order.assigned_to = uuid.UUID(order_data.assigned_to)
        
        db.add(order)
        db.flush()  # Get order ID for inventory movements
        
        # Step 4: Reserve inventory items (создаем резерв)
        for validation in inventory_validations:
            OrderService._reserve_inventory_item(
                db=db,
                order=order,
                item=validation['item'],
                inventory=validation['inventory']
            )
        
        db.commit()
        db.refresh(order)
        
        return order

    @staticmethod
    def _generate_order_number(db: Session, organization_id: uuid.UUID) -> str:
        """Генерация уникального номера заказа"""
        count = db.query(RoomOrder).filter(
            RoomOrder.organization_id == organization_id
        ).count()
        
        date_part = datetime.utcnow().strftime('%Y%m%d')
        number_part = str(count + 1).zfill(4)
        return f"ORD-{date_part}-{number_part}"
    
    @staticmethod
    def _serialize_order_items(items: List[OrderItemBase]) -> List[Dict[str, Any]]:
        """Convert order items to JSON-serializable format"""
        return [
            {
                "inventory_id": item.inventory_id,
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
                "notes": item.notes,
                "is_inventory_item": item.is_inventory_item
            }
            for item in items
        ]
    
    @staticmethod
    def get_order_by_id(
        db: Session,
        order_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> RoomOrder:  # ИСПРАВЛЕНО: возвращаем саму модель, а не Response
        """Получить заказ по ID с привязкой к организации"""
        
        order = db.query(RoomOrder).filter(
            and_(
                RoomOrder.id == order_id,
                RoomOrder.organization_id == organization_id
            )
        ).first()
        
        if not order:
            raise ValueError(f"Order with ID {order_id} not found")

        return order  # ИСПРАВЛЕНО: возвращаем саму модель

    @staticmethod
    def _reserve_inventory_item(
        db: Session,
        order: RoomOrder,
        item: OrderItemBase,
        inventory: Inventory
    ):
        """Reserve inventory item for the order"""
        # Создаем движение резерва (не влияет на остаток)
        reservation_movement = InventoryMovement(
            id=uuid.uuid4(),
            organization_id=order.organization_id,
            inventory_id=inventory.id,
            movement_type="out",  # ИЗМЕНЕНО: используем стандартный тип
            quantity=item.quantity,
            unit_cost=inventory.cost_per_unit,
            total_cost=item.quantity * (inventory.cost_per_unit or 0),
            reason=f"Резерв для заказа #{order.order_number}",
            notes=f"Товар: {item.name}, Заказ: {order.order_number}",
            stock_after=inventory.current_stock - item.quantity,  # Сразу списываем
            created_at=datetime.now(timezone.utc)
        )
        
        # ИСПРАВЛЕНО: Сразу списываем товар при создании заказа
        inventory.current_stock -= item.quantity
        inventory.total_value = inventory.current_stock * (inventory.cost_per_unit or 0)
        inventory.updated_at = datetime.now(timezone.utc)
        
        db.add(reservation_movement)
    
    @staticmethod
    def complete_order_with_inventory_deduction(
        db: Session,
        order: RoomOrder,
        completed_by: uuid.UUID,
        completion_notes: Optional[str] = None
    ) -> RoomOrder:
        """Complete order with automatic inventory deduction"""
        
        # ИСПРАВЛЕНО: Правильная последовательность статусов
        if order.status == OrderStatus.PENDING:
            # Переводим в CONFIRMED, если еще не подтвержден
            order.status = OrderStatus.CONFIRMED
            order.updated_at = datetime.now(timezone.utc)
            db.flush()
        
        if order.status == OrderStatus.CONFIRMED:
            # Переводим в IN_PROGRESS
            order.status = OrderStatus.IN_PROGRESS
            order.updated_at = datetime.now(timezone.utc)
            db.flush()
        
        if order.status != OrderStatus.IN_PROGRESS:
            raise ValueError(f"Order must be in progress to complete. Current status: {order.status}")
        
        # Товары уже списаны при создании заказа, поэтому просто завершаем заказ
        order.status = OrderStatus.DELIVERED
        order.completed_at = datetime.now(timezone.utc)
        order.updated_at = datetime.now(timezone.utc)
        
        if completion_notes:
            current_instructions = order.special_instructions or ""
            order.special_instructions = f"{current_instructions}\n\nЗавершено: {completion_notes}".strip()
        
        # Step 2: Process payment to executor
        OrderService._process_order_payment(db, order)
        
        db.commit()
        db.refresh(order)
        
        return order

    @staticmethod
    def _process_order_payment(db: Session, order: RoomOrder):
        """Process payment for completed order"""
        
        if order.payment_type == "none" or order.payment_to_executor <= 0:
            return
        
        if not order.assigned_to:
            return
        
        # Add to payroll (same as existing implementation)
        from models.extended_models import Payroll, PayrollType
        
        current_period_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        next_month = current_period_start.replace(month=current_period_start.month + 1)
        current_period_end = next_month - timedelta(seconds=1)
        
        payroll = db.query(Payroll).filter(
            and_(
                Payroll.user_id == order.assigned_to,
                Payroll.period_start == current_period_start,
                Payroll.period_end == current_period_end
            )
        ).first()
        
        if not payroll:
            payroll = Payroll(
                id=uuid.uuid4(),
                organization_id=order.organization_id,
                user_id=order.assigned_to,
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
        
        # Add order income
        payroll.other_income += order.payment_to_executor
        
        # Recalculate totals
        payroll.gross_amount = (
            (payroll.base_rate or 0) + 
            payroll.tasks_payment + 
            payroll.bonus + 
            payroll.tips + 
            payroll.other_income
        )
        payroll.net_amount = payroll.gross_amount - payroll.deductions - payroll.taxes
        payroll.updated_at = datetime.now(timezone.utc)
        
        # Mark order as paid
        order.is_paid = True
    
    @staticmethod
    def get_available_inventory_for_orders(
        db: Session,
        organization_id: uuid.UUID,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get inventory items available for room orders"""
        
        query = db.query(Inventory).filter(
            and_(
                Inventory.organization_id == organization_id,
                Inventory.is_active == True,
                Inventory.current_stock > 0
            )
        )
        
        if category:
            query = query.filter(Inventory.category == category)
        
        items = query.order_by(Inventory.name).all()
        
        return [
            {
                "id": str(item.id),
                "name": item.name,
                "description": item.description,
                "category": item.category,
                "unit": item.unit,
                "current_stock": item.current_stock,
                "cost_per_unit": item.cost_per_unit,
                "available_for_order": item.current_stock > item.min_stock
            }
            for item in items
        ]
    
    @staticmethod
    def get_inventory_impact_report(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate report on inventory usage through orders"""
        
        # Get completed orders in period
        orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.organization_id == organization_id,
                RoomOrder.status == OrderStatus.DELIVERED,
                RoomOrder.completed_at >= start_date,
                RoomOrder.completed_at <= end_date
            )
        ).all()
        
        # Get related inventory movements
        movements = db.query(InventoryMovement).filter(
            and_(
                InventoryMovement.organization_id == organization_id,
                InventoryMovement.movement_type == "out",
                InventoryMovement.reason.like("Резерв для заказа%"),
                InventoryMovement.created_at >= start_date,
                InventoryMovement.created_at <= end_date
            )
        ).all()
        
        # Aggregate data
        inventory_usage = {}
        total_value_consumed = 0
        
        for movement in movements:
            item_id = str(movement.inventory_id)
            if item_id not in inventory_usage:
                inventory_usage[item_id] = {
                    "inventory_name": movement.inventory_item.name if movement.inventory_item else "Unknown",
                    "total_quantity": 0,
                    "total_value": 0,
                    "order_count": 0
                }
            
            inventory_usage[item_id]["total_quantity"] += movement.quantity
            inventory_usage[item_id]["total_value"] += movement.total_cost or 0
            total_value_consumed += movement.total_cost or 0
        
        # Count orders per item
        for order in orders:
            for item in order.items:
                if item.get('inventory_id'):
                    item_id = item['inventory_id']
                    if item_id in inventory_usage:
                        inventory_usage[item_id]["order_count"] += 1
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "summary": {
                "total_orders": len(orders),
                "total_inventory_value_consumed": total_value_consumed,
                "unique_items_used": len(inventory_usage)
            },
            "inventory_breakdown": inventory_usage,
            "top_consumed_items": sorted(
                inventory_usage.items(),
                key=lambda x: x[1]["total_value"],
                reverse=True
            )[:10]
        }

    @staticmethod
    def update_order(
        db: Session,
        order: RoomOrder,
        order_data: RoomOrderUpdate,
        updated_by: uuid.UUID
    ) -> RoomOrder:
        """Update existing order"""
        
        # Update basic fields
        update_fields = order_data.dict(exclude_unset=True, exclude={'status'})
        for field, value in update_fields.items():
            if field == 'assigned_to' and value:
                setattr(order, field, uuid.UUID(value))
            else:
                setattr(order, field, value)
        
        # Handle status changes separately
        if order_data.status and order_data.status != order.status:
            OrderService._validate_status_transition(order.status, order_data.status)
            order.status = order_data.status
        
        order.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(order)
        
        return order
    
    @staticmethod
    def _validate_status_transition(current_status: OrderStatus, new_status: OrderStatus):
        """Validate that status transition is allowed"""
        
        valid_transitions = {
            OrderStatus.PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
            OrderStatus.CONFIRMED: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
            OrderStatus.IN_PROGRESS: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
            OrderStatus.DELIVERED: [],  # Terminal state
            OrderStatus.CANCELLED: []   # Terminal state
        }
        
        if new_status not in valid_transitions.get(current_status, []):
            raise ValueError(
                f"Invalid status transition from {current_status} to {new_status}"
            )

    @staticmethod
    def assign_order(
        db: Session,
        order: RoomOrder,
        assigned_to: uuid.UUID,
        assigned_by: uuid.UUID
    ) -> RoomOrder:
        """Assign order to executor"""
        
        # Verify assignee exists
        assignee = db.query(User).filter(
            and_(
                User.id == assigned_to,
                User.organization_id == order.organization_id
            )
        ).first()
        
        if not assignee:
            raise ValueError("Assignee not found")
        
        order.assigned_to = assigned_to
        
        # Auto-confirm if pending
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.CONFIRMED
        
        order.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(order)
        
        return order
    
    @staticmethod
    def mark_order_as_paid(
        db: Session,
        order: RoomOrder,
        payment_method: str = "cash",
        payment_reference: str = None
    ) -> RoomOrder:
        """Отметить заказ как оплаченный"""
        
        order.is_paid = True
        order.updated_at = datetime.now(timezone.utc)
        
        # Можно добавить поле payment_info в модель RoomOrder
        if hasattr(order, 'payment_info') and order.payment_info:
            payment_info = order.payment_info or {}
            payment_info.update({
                "method": payment_method,
                "reference": payment_reference,
                "paid_at": datetime.now(timezone.utc).isoformat()
            })
            order.payment_info = payment_info
        
        db.commit()
        db.refresh(order)
        
        return order

    @staticmethod
    def calculate_order_profitability(
        db: Session,
        order: RoomOrder
    ) -> Dict[str, float]:
        """Рассчитать прибыльность заказа"""
        
        # Себестоимость товаров
        cost_of_goods = 0
        for item_data in order.items:
            if item_data.get('inventory_id'):
                inventory_item = db.query(Inventory).filter(
                    Inventory.id == uuid.UUID(item_data['inventory_id'])
                ).first()
                
                if inventory_item:
                    cost_of_goods += item_data['quantity'] * (inventory_item.cost_per_unit or 0)
        
        # Выручка
        revenue = order.total_amount
        
        # Оплата исполнителю
        executor_payment = order.payment_to_executor or 0
        
        # Валовая прибыль
        gross_profit = revenue - cost_of_goods
        
        # Чистая прибыль (после вычета оплаты исполнителю)
        net_profit = gross_profit - executor_payment
        
        # Маржинальность
        margin = (net_profit / revenue * 100) if revenue > 0 else 0
        
        return {
            "revenue": revenue,
            "cost_of_goods": cost_of_goods,
            "executor_payment": executor_payment,
            "gross_profit": gross_profit,
            "net_profit": net_profit,
            "margin_percentage": margin
        }