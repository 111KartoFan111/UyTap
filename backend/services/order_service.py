from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
import uuid

from models.extended_models import (
    RoomOrder, OrderStatus, User, UserRole, Inventory, InventoryMovement
)
from schemas.order import RoomOrderCreate, RoomOrderUpdate, RoomOrderResponse,OrderItemBase



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
        
        # Step 3: Create the order
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
            status=OrderStatus.PENDING
        )
        
        # Set optional fields
        if order_data.client_id:
            order.client_id = uuid.UUID(order_data.client_id)
        if order_data.rental_id:
            order.rental_id = uuid.UUID(order_data.rental_id)
        if order_data.assigned_to:
            order.assigned_to = uuid.UUID(order_data.assigned_to)
            order.status = OrderStatus.CONFIRMED
        
        db.add(order)
        db.flush()  # Get order ID for inventory movements
        
        # Step 4: Reserve inventory items (optional - can be done at completion)
        # For now, we'll reserve immediately to prevent overselling
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
        # Получаем текущее количество заказов для организации
        count = db.query(RoomOrder).filter(
            RoomOrder.organization_id == organization_id
        ).count()
        
        # Формируем номер: ORDER-<ГГГГММДД>-<счётчик+1>
        date_part = datetime.utcnow().strftime('%Y%m%d')
        number_part = str(count + 1).zfill(4)  # например: 0001, 0002, ...
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
    ) -> RoomOrderResponse:
        """Получить заказ по ID с привязкой к организации"""
        
        order = db.query(RoomOrder).filter(
            and_(
                RoomOrder.id == order_id,
                RoomOrder.organization_id == organization_id
            )
        ).first()
        
        if not order:
            raise ValueError(f"Order with ID {order_id} not found")

        # Преобразование ORM-модели в Pydantic-модель
        return RoomOrderResponse.from_orm(order)

    @staticmethod
    def _reserve_inventory_item(
        db: Session,
        order: RoomOrder,
        item: OrderItemBase,
        inventory: Inventory
    ):
        """Reserve inventory item for the order (optional feature)"""
        # This creates a pending reservation movement
        # Alternative: only deduct when order is completed
        
        reservation_movement = InventoryMovement(
            id=uuid.uuid4(),
            organization_id=order.organization_id,
            inventory_id=inventory.id,
            movement_type="reservation",  # Custom type for reservations
            quantity=item.quantity,
            unit_cost=inventory.cost_per_unit,
            total_cost=item.quantity * (inventory.cost_per_unit or 0),
            reason=f"Reserved for order #{order.order_number}",
            notes=f"Item: {item.name}",
            stock_after=inventory.current_stock,  # Stock unchanged for reservations
            created_at=datetime.now(timezone.utc),
            # Link to order
            task_id=None  # Could add order_id field to movements table
        )
        
        db.add(reservation_movement)
    
    @staticmethod
    def complete_order_with_inventory_deduction(
        db: Session,
        order: RoomOrder,
        completed_by: uuid.UUID,
        completion_notes: Optional[str] = None
    ) -> RoomOrder:
        """Complete order with automatic inventory deduction"""
        
        # ✅ Автоматический переход в IN_PROGRESS, если заказ CONFIRMED
        if order.status == OrderStatus.CONFIRMED:
            order.status = OrderStatus.IN_PROGRESS
            order.updated_at = datetime.now(timezone.utc)
        
        if order.status != OrderStatus.IN_PROGRESS:
            raise ValueError("Order must be in progress to complete")
        
        # Step 1: Process inventory deductions
        for item_data in order.items:
            if item_data.get('is_inventory_item', True) and item_data.get('inventory_id'):
                inventory_item = db.query(Inventory).filter(
                    Inventory.id == uuid.UUID(item_data['inventory_id'])
                ).first()
                
                if inventory_item:
                    movement = InventoryMovement(
                        id=uuid.uuid4(),
                        organization_id=order.organization_id,
                        inventory_id=inventory_item.id,
                        movement_type="out",
                        quantity=item_data['quantity'],
                        unit_cost=inventory_item.cost_per_unit,
                        total_cost=item_data['quantity'] * (inventory_item.cost_per_unit or 0),
                        reason=f"Order delivery #{order.order_number}",
                        notes=f"Item: {item_data['name']} | Property: {order.property.name if order.property else 'N/A'}",
                        stock_after=inventory_item.current_stock - item_data['quantity'],
                        created_at=datetime.now(timezone.utc)
                    )
                    
                    inventory_item.current_stock -= item_data['quantity']
                    inventory_item.total_value = inventory_item.current_stock * (inventory_item.cost_per_unit or 0)
                    inventory_item.updated_at = datetime.now(timezone.utc)
                    
                    db.add(movement)
        
        # Step 2: Complete the order
        order.status = OrderStatus.DELIVERED
        order.completed_at = datetime.now(timezone.utc)
        order.updated_at = datetime.now(timezone.utc)
        
        if completion_notes:
            order.special_instructions = (order.special_instructions or "") + f"\nCompleted: {completion_notes}"
        
        # Step 3: Process payment to executor
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
                "available_for_order": item.current_stock > item.min_stock  # Safety buffer
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
                InventoryMovement.reason.like("Order delivery%"),
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
