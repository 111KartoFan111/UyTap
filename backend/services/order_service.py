# backend/services/order_service.py - ПОЛНАЯ ВЕРСИЯ С АВТОНАЗНАЧЕНИЕМ
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
import uuid

from models.extended_models import (
    RoomOrder, OrderStatus, User, UserRole, Inventory, InventoryMovement,
    Task, TaskType, TaskStatus, TaskPriority
)
from schemas.order import RoomOrderCreate, RoomOrderUpdate, OrderItemBase
from models.models import UserRole

class OrderService:
    """Enhanced order service with comprehensive auto-assignment and inventory management"""
    
    @staticmethod
    def create_order_with_inventory_check(
        db: Session,
        order_data: RoomOrderCreate,
        organization_id: uuid.UUID
    ) -> RoomOrder:
        """Create order with comprehensive inventory validation and smart auto-assignment"""
        
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

        # Step 2: Smart executor auto-assignment
        assigned_executor = None
        if not order_data.assigned_to:
            assigned_executor = OrderService._auto_assign_best_executor(
                db, organization_id, order_data.order_type, order_data.total_amount
            )
        else:
            # Verify manually assigned executor exists and is available
            manual_executor = db.query(User).filter(
                and_(
                    User.id == uuid.UUID(order_data.assigned_to),
                    User.organization_id == organization_id,
                    User.status == "active"
                )
            ).first()
            if manual_executor:
                assigned_executor = manual_executor

        # Step 3: Generate unique order number
        order_number = OrderService._generate_order_number(db, organization_id)
        
        # Step 4: Determine initial status based on assignment and order type
        initial_status = OrderStatus.PENDING
        if assigned_executor:
            initial_status = OrderStatus.CONFIRMED
        elif order_data.order_type == 'product_sale':
            # Product sales should be confirmed even without immediate assignment
            initial_status = OrderStatus.CONFIRMED

        # Step 5: Create the order
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
            status=initial_status,
            assigned_to=assigned_executor.id if assigned_executor else None,
            executor_type="employee" if assigned_executor else "department",
            payment_to_executor=OrderService._calculate_executor_payment(
                order_data.order_type, order_data.total_amount, len(order_data.items)
            ),
            payment_type="fixed"
        )
        
        # Set optional relationships
        if order_data.client_id:
            order.client_id = uuid.UUID(order_data.client_id)
        if order_data.rental_id:
            order.rental_id = uuid.UUID(order_data.rental_id)
        
        db.add(order)
        db.flush()  # Get order ID for related operations
        
        # Step 6: Create delivery task with smart assignment
        delivery_task = None
        if assigned_executor:
            delivery_task = OrderService._create_delivery_task_with_assignment(
                db, order, assigned_executor
            )
            print(f"✅ Created delivery task {delivery_task.id} assigned to {assigned_executor.first_name} {assigned_executor.last_name}")
        else:
            print(f"⚠️  Order {order.order_number} created without assignment - will need manual assignment")
        
        # Step 7: Reserve inventory items (automatic stock deduction)
        for validation in inventory_validations:
            OrderService._reserve_inventory_item(
                db=db,
                order=order,
                item=validation['item'],
                inventory=validation['inventory']
            )
        
        # Step 8: Send notifications
        if assigned_executor:
            OrderService._notify_executor_about_assignment(db, order, assigned_executor, delivery_task)
        else:
            # Notify managers about unassigned order
            OrderService._notify_managers_about_unassigned_order(db, order, organization_id)
        
        db.commit()
        db.refresh(order)
        
        return order

    @staticmethod
    def _auto_assign_best_executor(
        db: Session, 
        organization_id: uuid.UUID, 
        order_type: str,
        order_value: float = 0
    ) -> Optional[User]:
        """Enhanced auto-assignment with weighted scoring and priority handling"""
        
        # Define role priorities for different order types
        role_priorities = {
            'product_sale': [UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.TECHNICAL_STAFF],
            'food': [UserRole.TECHNICAL_STAFF, UserRole.MANAGER, UserRole.STOREKEEPER],
            'service': [UserRole.TECHNICAL_STAFF, UserRole.MANAGER],
            'delivery': [UserRole.STOREKEEPER, UserRole.TECHNICAL_STAFF, UserRole.MANAGER],
            'maintenance': [UserRole.TECHNICAL_STAFF, UserRole.MANAGER]
        }
        
        preferred_roles = role_priorities.get(order_type, [UserRole.MANAGER, UserRole.TECHNICAL_STAFF])
        
        # Get all potential executors
        potential_executors = db.query(User).filter(
            and_(
                User.organization_id == organization_id,
                User.role.in_(preferred_roles),
                User.status == "active"
            )
        ).all()
        
        if not potential_executors:
            print(f"⚠️  No available executors found for order type: {order_type}")
            return None
        
        # Score each executor with enhanced criteria
        scored_executors = []
        
        for executor in potential_executors:
            score = OrderService._calculate_enhanced_executor_score(
                db, executor, order_type, preferred_roles, order_value
            )
            scored_executors.append((executor, score))
        
        # Sort by score and return the best executor
        if scored_executors:
            scored_executors.sort(key=lambda x: x[1], reverse=True)
            best_executor, best_score = scored_executors[0]
            
            print(f"✅ Best executor selected: {best_executor.first_name} {best_executor.last_name} "
                  f"({best_executor.role.value}) with score: {best_score:.2f}")
            
            # Log top 3 candidates for transparency
            for i, (executor, score) in enumerate(scored_executors[:3]):
                print(f"   {i+1}. {executor.first_name} {executor.last_name}: {score:.2f}")
            
            return best_executor
        
        return None

    @staticmethod
    def _calculate_enhanced_executor_score(
        db: Session, 
        executor: User, 
        order_type: str, 
        preferred_roles: List[UserRole],
        order_value: float
    ) -> float:
        """Enhanced scoring algorithm with multiple weighted factors"""
        
        score = 0.0
        
        # 1. Role preference score (0-50 points)
        try:
            role_index = preferred_roles.index(executor.role)
            role_score = 50 - (role_index * 10)  # First choice gets 50, second gets 40, etc.
        except ValueError:
            role_score = 0
        score += role_score
        
        # 2. Current workload score (0-30 points, inverted - less workload is better)
        active_orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.assigned_to == executor.id,
                RoomOrder.status.in_([OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS])
            )
        ).count()
        
        active_tasks = db.query(Task).filter(
            and_(
                Task.assigned_to == executor.id,
                Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
            )
        ).count()
        
        total_workload = active_orders + active_tasks
        workload_score = max(0, 30 - (total_workload * 3))  # Each active item reduces score by 3
        score += workload_score
        
        # 3. Recent performance score (0-25 points)
        last_week = datetime.now(timezone.utc) - timedelta(days=7)
        
        completed_orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.assigned_to == executor.id,
                RoomOrder.status == OrderStatus.DELIVERED,
                RoomOrder.completed_at >= last_week
            )
        ).count()
        
        completed_tasks = db.query(Task).filter(
            and_(
                Task.assigned_to == executor.id,
                Task.status == TaskStatus.COMPLETED,
                Task.completed_at >= last_week
            )
        ).count()
        
        performance_score = min(25, (completed_orders * 4) + (completed_tasks * 2))
        score += performance_score
        
        # 4. Specialization bonus for order type (0-15 points)
        specialization_bonus = 0
        if order_type == 'product_sale' and executor.role == UserRole.STOREKEEPER:
            specialization_bonus = 15
        elif order_type in ['food', 'service'] and executor.role == UserRole.TECHNICAL_STAFF:
            specialization_bonus = 15
        elif executor.role == UserRole.MANAGER:
            specialization_bonus = 10  # Managers are versatile
        score += specialization_bonus
        
        # 5. High-value order handling bonus (0-10 points)
        if order_value > 50000 and executor.role in [UserRole.MANAGER, UserRole.STOREKEEPER]:
            score += 10
        elif order_value > 20000 and executor.role == UserRole.MANAGER:
            score += 5
        
        # 6. Availability check (0-10 points)
        last_hour = datetime.now(timezone.utc) - timedelta(hours=1)
        
        recent_activity = db.query(Task).filter(
            and_(
                Task.assigned_to == executor.id,
                Task.status == TaskStatus.IN_PROGRESS,
                Task.started_at >= last_hour
            )
        ).count()
        
        availability_score = 10 if recent_activity == 0 else (5 if recent_activity <= 1 else 0)
        score += availability_score
        
        # 7. Quality rating bonus (0-10 points)
        avg_quality = db.query(func.avg(Task.quality_rating)).filter(
            and_(
                Task.assigned_to == executor.id,
                Task.status == TaskStatus.COMPLETED,
                Task.quality_rating.isnot(None),
                Task.completed_at >= last_week
            )
        ).scalar()
        
        if avg_quality:
            quality_score = min(10, (avg_quality - 3) * 5)  # Scale 3-5 rating to 0-10 points
            score += max(0, quality_score)
        
        print(f"📊 {executor.first_name} {executor.last_name}: "
              f"Role({role_score:.1f}) + Workload({workload_score:.1f}) + Performance({performance_score:.1f}) + "
              f"Specialization({specialization_bonus:.1f}) + Value({5 if order_value > 20000 else 0:.1f}) + "
              f"Availability({availability_score:.1f}) + Quality({avg_quality or 0:.1f}) = {score:.2f}")
        
        return score

    @staticmethod
    def _create_delivery_task_with_assignment(
        db: Session, 
        order: RoomOrder, 
        assigned_executor: User
    ) -> Task:
        """Create and assign delivery task with enhanced details"""
        
        # Import here to avoid circular imports
        from services.task_service import TaskService
        from schemas.task import TaskCreate
        
        # Determine task priority based on order characteristics
        priority = TaskPriority.MEDIUM
        if order.order_type == 'product_sale' and order.total_amount > 50000:
            priority = TaskPriority.HIGH
        elif order.order_type in ['food', 'service'] or order.total_amount > 20000:
            priority = TaskPriority.MEDIUM
        elif len(order.items) <= 2 and order.total_amount < 5000:
            priority = TaskPriority.LOW
        
        # Calculate estimated duration based on order complexity
        item_count = len(order.items)
        base_duration = 20  # Base delivery time
        item_duration = item_count * 3  # 3 minutes per item
        value_duration = 10 if order.total_amount > 20000 else 0  # Extra time for valuable orders
        
        estimated_duration = base_duration + item_duration + value_duration
        estimated_duration = min(estimated_duration, 90)  # Max 1.5 hours
        
        # Calculate payment based on order characteristics
        payment_amount = OrderService._calculate_executor_payment(
            order.order_type, order.total_amount, item_count
        )
        
        # Create detailed task description
        description_parts = [
            f"Доставить товары по заказу '{order.title}'",
            f"Помещение: {order.property.name if order.property else 'неизвестно'}",
            f"Количество позиций: {item_count}",
            f"Сумма заказа: {order.total_amount:,.0f} ₸"
        ]
        
        if order.special_instructions:
            description_parts.append(f"Особые указания: {order.special_instructions}")
        
        task_data = TaskCreate(
            title=f"Доставка заказа #{order.order_number}",
            description="\n".join(description_parts),
            task_type=TaskType.DELIVERY,
            priority=priority,
            property_id=str(order.property_id),
            estimated_duration=estimated_duration,
            payment_amount=payment_amount,
            payment_type="fixed"
        )
        
        try:
            # Create the task
            delivery_task = TaskService.create_task(
                db=db,
                task_data=task_data,
                property_id=order.property_id,
                created_by=None,  # System-created task
                organization_id=order.organization_id
            )
            
            # Assign directly to the executor
            delivery_task.assigned_to = assigned_executor.id
            delivery_task.status = TaskStatus.ASSIGNED
            
            # Set due date based on priority
            if priority == TaskPriority.HIGH:
                due_hours = 1
            elif priority == TaskPriority.MEDIUM:
                due_hours = 2
            else:
                due_hours = 4
            
            delivery_task.due_date = datetime.now(timezone.utc) + timedelta(hours=due_hours)
            
            db.flush()
            
            return delivery_task
            
        except Exception as e:
            print(f"❌ Failed to create delivery task for order {order.id}: {e}")
            raise

    @staticmethod
    def _calculate_executor_payment(order_type: str, order_value: float, item_count: int) -> float:
        """Calculate executor payment based on order characteristics"""
        
        base_payments = {
            'product_sale': 1500,
            'food': 1000,
            'service': 1200,
            'delivery': 800,
            'maintenance': 2000
        }
        
        base_payment = base_payments.get(order_type, 1000)
        
        # Value-based bonus
        if order_value > 50000:
            base_payment += 1000
        elif order_value > 20000:
            base_payment += 500
        elif order_value > 10000:
            base_payment += 250
        
        # Complexity bonus for multiple items
        if item_count > 5:
            base_payment += (item_count - 5) * 100
        elif item_count > 3:
            base_payment += (item_count - 3) * 50
        
        return base_payment

    @staticmethod
    def _notify_executor_about_assignment(
        db: Session, 
        order: RoomOrder, 
        executor: User,
        delivery_task: Task = None
    ):
        """Send comprehensive notification to assigned executor"""
        
        try:
            # Create detailed notification message
            notification_parts = [
                f"📦 Новый заказ назначен вам!",
                f"Заказ: #{order.order_number}",
                f"Тип: {order.order_type}",
                f"Помещение: {order.property.name if order.property else 'Неизвестно'}",
                f"Сумма: {order.total_amount:,.0f} ₸",
                f"Количество товаров: {len(order.items)}",
                f"Статус: {order.status.value}"
            ]
            
            if delivery_task:
                notification_parts.extend([
                    f"",
                    f"🚚 Задача доставки:",
                    f"Приоритет: {delivery_task.priority.value}",
                    f"Ожидаемое время: {delivery_task.estimated_duration} мин",
                    f"Оплата: {delivery_task.payment_amount:,.0f} ₸",
                    f"Срок выполнения: {delivery_task.due_date.strftime('%H:%M') if delivery_task.due_date else 'Не указан'}"
                ])
            
            if order.special_instructions:
                notification_parts.extend([
                    f"",
                    f"⚠️  Особые указания:",
                    f"{order.special_instructions}"
                ])
            
            notification_message = "\n".join(notification_parts)
            
            # TODO: Integrate with your notification system
            # - Send email notification
            # - Send SMS if urgent (high priority orders)
            # - Create in-app notification
            # - Send push notification if mobile app exists
            
            print(f"📧 Notification sent to {executor.email}:")
            print(notification_message)
            
            # You can also create a notification record in the database
            # from models.notification_models import Notification
            # notification = Notification(
            #     user_id=executor.id,
            #     title=f"Новый заказ #{order.order_number}",
            #     message=notification_message,
            #     type="order_assignment",
            #     related_id=order.id,
            #     priority=delivery_task.priority.value if delivery_task else "medium"
            # )
            # db.add(notification)
            
        except Exception as e:
            print(f"⚠️  Failed to send notification to executor {executor.id}: {e}")

    @staticmethod
    def _notify_managers_about_unassigned_order(
        db: Session,
        order: RoomOrder,
        organization_id: uuid.UUID
    ):
        """Notify managers about orders that couldn't be auto-assigned"""
        
        try:
            # Get all managers in the organization
            managers = db.query(User).filter(
                and_(
                    User.organization_id == organization_id,
                    User.role.in_([UserRole.MANAGER, UserRole.ADMIN]),
                    User.status == "active"
                )
            ).all()
            
            notification_message = (
                f"⚠️  Заказ требует ручного назначения\n"
                f"Заказ: #{order.order_number}\n"
                f"Тип: {order.order_type}\n"
                f"Сумма: {order.total_amount:,.0f} ₸\n"
                f"Причина: Нет доступных исполнителей"
            )
            
            for manager in managers:
                print(f"📧 Manager notification sent to {manager.email}: {notification_message}")
                
                # TODO: Send actual notifications to managers
                
        except Exception as e:
            print(f"⚠️  Failed to notify managers about unassigned order: {e}")

    @staticmethod
    def get_executor_workload_summary(db: Session, organization_id: uuid.UUID) -> Dict[str, Any]:
        """Get comprehensive executor workload summary with enhanced metrics"""
        
        # Get all potential executors
        executors = db.query(User).filter(
            and_(
                User.organization_id == organization_id,
                User.role.in_([
                    UserRole.STOREKEEPER, 
                    UserRole.MANAGER, 
                    UserRole.TECHNICAL_STAFF
                ]),
                User.status == "active"
            )
        ).all()
        
        workload_summary = []
        
        for executor in executors:
            # Current workload
            active_orders = db.query(RoomOrder).filter(
                and_(
                    RoomOrder.assigned_to == executor.id,
                    RoomOrder.status.in_([OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS])
                )
            ).all()
            
            active_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == executor.id,
                    Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
                )
            ).all()
            
            # Recent performance metrics
            last_week = datetime.now(timezone.utc) - timedelta(days=7)
            last_month = datetime.now(timezone.utc) - timedelta(days=30)
            
            completed_orders_week = db.query(RoomOrder).filter(
                and_(
                    RoomOrder.assigned_to == executor.id,
                    RoomOrder.status == OrderStatus.DELIVERED,
                    RoomOrder.completed_at >= last_week
                )
            ).count()
            
            completed_tasks_week = db.query(Task).filter(
                and_(
                    Task.assigned_to == executor.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= last_week
                )
            ).count()
            
            completed_orders_month = db.query(RoomOrder).filter(
                and_(
                    RoomOrder.assigned_to == executor.id,
                    RoomOrder.status == OrderStatus.DELIVERED,
                    RoomOrder.completed_at >= last_month
                )
            ).count()
            
            # Average completion time
            recent_tasks = db.query(Task).filter(
                and_(
                    Task.assigned_to == executor.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.completed_at >= last_week,
                    Task.actual_duration.isnot(None)
                )
            ).all()
            
            avg_completion_time = None
            if recent_tasks:
                total_time = sum(task.actual_duration for task in recent_tasks)
                avg_completion_time = total_time / len(recent_tasks)
            
            # Quality rating
            avg_quality = db.query(func.avg(Task.quality_rating)).filter(
                and_(
                    Task.assigned_to == executor.id,
                    Task.status == TaskStatus.COMPLETED,
                    Task.quality_rating.isnot(None),
                    Task.completed_at >= last_week
                )
            ).scalar()
            
            # Revenue generated
            total_orders_value = db.query(func.sum(RoomOrder.total_amount)).filter(
                and_(
                    RoomOrder.assigned_to == executor.id,
                    RoomOrder.status == OrderStatus.DELIVERED,
                    RoomOrder.completed_at >= last_month
                )
            ).scalar() or 0
            
            # Determine availability status and color
            current_workload = len(active_orders) + len(active_tasks)
            
            if current_workload == 0:
                availability_status = "Свободен"
                availability_color = "#10b981"
            elif current_workload <= 2:
                availability_status = "Низкая загрузка"
                availability_color = "#3b82f6"
            elif current_workload <= 4:
                availability_status = "Средняя загрузка"
                availability_color = "#f59e0b"
            elif current_workload <= 6:
                availability_status = "Высокая загрузка"
                availability_color = "#ef4444"
            else:
                availability_status = "Перегружен"
                availability_color = "#dc2626"
            
            # Calculate efficiency score
            efficiency_factors = []
            if completed_orders_week > 0:
                efficiency_factors.append(min(100, completed_orders_week * 20))
            if completed_tasks_week > 0:
                efficiency_factors.append(min(100, completed_tasks_week * 10))
            if avg_quality:
                efficiency_factors.append((avg_quality - 1) * 25)  # Scale 1-5 to 0-100
            
            efficiency_score = sum(efficiency_factors) / len(efficiency_factors) if efficiency_factors else 0
            
            executor_info = {
                "executor_id": str(executor.id),
                "name": f"{executor.first_name} {executor.last_name}",
                "role": executor.role.value,
                "email": executor.email,
                "phone": executor.phone,
                
                # Current workload
                "active_orders": len(active_orders),
                "active_tasks": len(active_tasks),
                "total_workload": current_workload,
                
                # Availability
                "availability_status": availability_status,
                "availability_color": availability_color,
                
                # Performance metrics
                "completed_orders_week": completed_orders_week,
                "completed_tasks_week": completed_tasks_week,
                "completed_orders_month": completed_orders_month,
                "avg_completion_time_minutes": round(avg_completion_time) if avg_completion_time else None,
                "avg_quality_rating": round(avg_quality, 2) if avg_quality else None,
                "efficiency_score": round(efficiency_score, 1),
                
                # Financial metrics
                "revenue_generated_month": float(total_orders_value),
                "avg_order_value": float(total_orders_value / completed_orders_month) if completed_orders_month > 0 else 0,
                
                # Detailed active items (для детального просмотра)
                "active_order_details": [
                    {
                        "id": str(order.id),
                        "order_number": order.order_number,
                        "title": order.title,
                        "status": order.status.value,
                        "total_amount": order.total_amount,
                        "created_at": order.created_at.isoformat(),
                        "property_name": order.property.name if order.property else None
                    }
                    for order in active_orders
                ],
                
                "active_task_details": [
                    {
                        "id": str(task.id),
                        "title": task.title,
                        "task_type": task.task_type.value,
                        "priority": task.priority.value,
                        "status": task.status.value,
                        "payment_amount": task.payment_amount,
                        "due_date": task.due_date.isoformat() if task.due_date else None,
                        "property_name": task.property.name if task.property else None
                    }
                    for task in active_tasks
                ]
            }
            
            workload_summary.append(executor_info)
        
        # Sort by availability and efficiency
        workload_summary.sort(key=lambda x: (x["total_workload"], -x["efficiency_score"]))
        
        # Calculate organizational metrics
        total_active_workload = sum(e["total_workload"] for e in workload_summary)
        available_executors = len([e for e in workload_summary if e["total_workload"] == 0])
        busy_executors = len([e for e in workload_summary if e["total_workload"] > 4])
        avg_efficiency = sum(e["efficiency_score"] for e in workload_summary) / len(workload_summary) if workload_summary else 0
        
        return {
            "executors": workload_summary,
            "summary": {
                "total_executors": len(executors),
                "available_executors": available_executors,
                "busy_executors": busy_executors,
                "overloaded_executors": len([e for e in workload_summary if e["total_workload"] > 6]),
                "avg_workload": total_active_workload / len(workload_summary) if workload_summary else 0,
                "avg_efficiency": round(avg_efficiency, 1),
                "total_active_orders": sum(e["active_orders"] for e in workload_summary),
                "total_active_tasks": sum(e["active_tasks"] for e in workload_summary)
            },
            "recommendation": OrderService._get_assignment_recommendation(workload_summary),
            "last_updated": datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    def _get_assignment_recommendation(workload_summary: List[Dict]) -> Dict[str, Any]:
        """Enhanced assignment recommendations with actionable insights"""
        
        if not workload_summary:
            return {
                "message": "Нет доступных исполнителей",
                "action": "hire_more_staff",
                "priority": "critical",
                "suggestions": ["Необходимо нанять персонал для обработки заказов"]
            }
        
        free_executors = [e for e in workload_summary if e["total_workload"] == 0]
        low_load_executors = [e for e in workload_summary if e["total_workload"] <= 2]
        overloaded_executors = [e for e in workload_summary if e["total_workload"] > 6]
        high_efficiency_executors = [e for e in workload_summary if e["efficiency_score"] > 70]
        
        total_executors = len(workload_summary)
        avg_efficiency = sum(e["efficiency_score"] for e in workload_summary) / total_executors
        
        if len(free_executors) >= 2:
            best_free = max(free_executors, key=lambda x: x["efficiency_score"])
            return {
                "message": f"Отличная ситуация! {len(free_executors)} исполнителей свободны",
                "action": "auto_assign_recommended",
                "priority": "low",
                "recommended_executor": best_free["name"],
                "recommended_executor_id": best_free["executor_id"],
                "suggestions": [
                    "Автоназначение работает оптимально",
                    "Можно принимать больше заказов"
                ]
            }
        elif len(low_load_executors) >= 1:
            best_low_load = max(low_load_executors, key=lambda x: x["efficiency_score"])
            return {
                "message": f"Хорошая ситуация. {len(low_load_executors)} исполнителей с низкой загрузкой",
                "action": "auto_assign_recommended",
                "priority": "low",
                "recommended_executor": best_low_load["name"],
                "recommended_executor_id": best_low_load["executor_id"],
                "suggestions": [
                    "Система может обрабатывать текущую нагрузку",
                    "Рекомендуется мониторинг загрузки"
                ]
            }
        elif len(overloaded_executors) > total_executors / 2:
            return {
                "message": "Критическая загрузка! Больше половины исполнителей перегружены",
                "action": "redistribute_workload",
                "priority": "critical",
                "suggestions": [
                    "Срочно перераспределить задачи",
                    "Рассмотреть найм дополнительного персонала",
                    "Увеличить автоматизацию процессов",
                    "Проанализировать эффективность сотрудников"
                ]
            }
        elif avg_efficiency < 50:
            return {
                "message": f"Низкая эффективность команды ({avg_efficiency:.1f}%)",
                "action": "improve_efficiency",
                "priority": "high",
                "suggestions": [
                    "Провести обучение персонала",
                    "Оптимизировать рабочие процессы",
                    "Проверить загрузку оборудования",
                    "Рассмотреть систему мотивации"
                ]
            }
        else:
            best_executor = min(workload_summary, key=lambda x: x["total_workload"])
            return {
                "message": f"Средняя загрузка. Лучший вариант: {best_executor['name']}",
                "action": "assign_to_best",
                "priority": "medium",
                "recommended_executor": best_executor["name"],
                "recommended_executor_id": best_executor["executor_id"],
                "suggestions": [
                    "Система работает в нормальном режиме",
                    "Следить за равномерным распределением нагрузки"
                ]
            }

    # Utility methods for order management
    
    @staticmethod
    def get_order_by_id(
        db: Session,
        order_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> RoomOrder:
        """Get order by ID with organization validation"""
        
        order = db.query(RoomOrder).filter(
            and_(
                RoomOrder.id == order_id,
                RoomOrder.organization_id == organization_id
            )
        ).first()
        
        if not order:
            raise ValueError(f"Order with ID {order_id} not found")

        return order

    @staticmethod
    def update_order(
        db: Session,
        order: RoomOrder,
        order_data: RoomOrderUpdate,
        updated_by: uuid.UUID
    ) -> RoomOrder:
        """Update existing order with validation"""
        
        # Update basic fields
        update_fields = order_data.dict(exclude_unset=True, exclude={'status'})
        for field, value in update_fields.items():
            if field == 'assigned_to' and value:
                setattr(order, field, uuid.UUID(value))
            else:
                setattr(order, field, value)
        
        # Handle status changes with validation
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
        """Assign order to executor with validation"""
        
        # Verify assignee exists and is available
        assignee = db.query(User).filter(
            and_(
                User.id == assigned_to,
                User.organization_id == order.organization_id,
                User.status == "active"
            )
        ).first()
        
        if not assignee:
            raise ValueError("Assignee not found or not available")
        
        # Check if assignee role is suitable for order type
        suitable_roles = {
            'product_sale': [UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.TECHNICAL_STAFF],
            'food': [UserRole.TECHNICAL_STAFF, UserRole.MANAGER],
            'service': [UserRole.TECHNICAL_STAFF, UserRole.MANAGER],
            'delivery': [UserRole.STOREKEEPER, UserRole.TECHNICAL_STAFF, UserRole.MANAGER]
        }
        
        if assignee.role not in suitable_roles.get(order.order_type, [UserRole.MANAGER]):
            print(f"⚠️  Warning: {assignee.role.value} may not be optimal for {order.order_type} orders")
        
        old_assignee_id = order.assigned_to
        order.assigned_to = assigned_to
        
        # Auto-confirm if pending
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.CONFIRMED
        
        order.updated_at = datetime.now(timezone.utc)
        
        # Create or update delivery task
        delivery_task = OrderService._create_delivery_task_with_assignment(db, order, assignee)
        
        # Send notification
        OrderService._notify_executor_about_assignment(db, order, assignee, delivery_task)
        
        db.commit()
        db.refresh(order)
        
        return order

    @staticmethod
    def complete_order_with_inventory_deduction(
        db: Session,
        order: RoomOrder,
        completed_by: uuid.UUID,
        completion_notes: Optional[str] = None
    ) -> RoomOrder:
        """Complete order with automatic inventory deduction and payment processing"""
        
        # Validate current status
        if order.status not in [OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS]:
            raise ValueError(f"Order must be confirmed or in progress to complete. Current status: {order.status}")
        
        # Progress through statuses if needed
        if order.status == OrderStatus.CONFIRMED:
            order.status = OrderStatus.IN_PROGRESS
            order.updated_at = datetime.now(timezone.utc)
            db.flush()
        
        # Complete the order
        order.status = OrderStatus.DELIVERED
        order.completed_at = datetime.now(timezone.utc)
        order.updated_at = datetime.now(timezone.utc)
        
        if completion_notes:
            current_instructions = order.special_instructions or ""
            order.special_instructions = f"{current_instructions}\n\nЗавершено: {completion_notes}".strip()
        
        # Process payment to executor
        OrderService._process_order_payment(db, order)
        
        # Update related delivery tasks
        delivery_tasks = db.query(Task).filter(
            and_(
                Task.property_id == order.property_id,
                Task.task_type == TaskType.DELIVERY,
                Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]),
                Task.description.like(f"%{order.order_number}%")
            )
        ).all()
        
        for task in delivery_tasks:
            if task.status != TaskStatus.COMPLETED:
                task.status = TaskStatus.COMPLETED
                task.completed_at = datetime.now(timezone.utc)
                task.completion_notes = f"Автоматически завершена при завершении заказа {order.order_number}"
        
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
        
        # Add to payroll
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
        
        # Mark order as paid to executor
        order.is_paid = True

    # Helper methods for order number generation and serialization
    
    @staticmethod
    def _generate_order_number(db: Session, organization_id: uuid.UUID) -> str:
        """Generate unique order number"""
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
    def _reserve_inventory_item(
        db: Session, 
        order: RoomOrder, 
        item: OrderItemBase, 
        inventory: Inventory
    ):
        """Reserve inventory item for the order"""
        # Create inventory movement record
        reservation_movement = InventoryMovement(
            id=uuid.uuid4(),
            organization_id=order.organization_id,
            inventory_id=inventory.id,
            movement_type="out",
            quantity=item.quantity,
            unit_cost=inventory.cost_per_unit,
            total_cost=item.quantity * (inventory.cost_per_unit or 0),
            reason=f"Резерв для заказа #{order.order_number}",
            notes=f"Товар: {item.name}, Заказ: {order.order_number}",
            stock_after=inventory.current_stock - item.quantity,
            created_at=datetime.now(timezone.utc)
        )
        
        # Update inventory stock
        inventory.current_stock -= item.quantity
        inventory.total_value = inventory.current_stock * (inventory.cost_per_unit or 0)
        inventory.updated_at = datetime.now(timezone.utc)
        
        db.add(reservation_movement)

    # Analytics and reporting methods
    
    @staticmethod
    def get_assignment_analytics(
        db: Session,
        organization_id: uuid.UUID,
        period_days: int = 7
    ) -> Dict[str, Any]:
        """Get comprehensive assignment analytics"""
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Get orders in the period
        orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.organization_id == organization_id,
                RoomOrder.created_at >= start_date
            )
        ).all()
        
        auto_assigned = len([o for o in orders if o.assigned_to is not None])
        total_orders = len(orders)
        
        # Calculate assignment metrics
        assignment_rate = (auto_assigned / total_orders * 100) if total_orders > 0 else 0
        
        # Executor performance
        executor_stats = {}
        for order in orders:
            if order.assigned_to:
                executor_id = str(order.assigned_to)
                if executor_id not in executor_stats:
                    executor = db.query(User).filter(User.id == order.assigned_to).first()
                    executor_stats[executor_id] = {
                        "name": f"{executor.first_name} {executor.last_name}" if executor else "Unknown",
                        "role": executor.role.value if executor else "Unknown",
                        "assigned_count": 0,
                        "completed_count": 0,
                        "total_value": 0,
                        "avg_completion_time": 0
                    }
                
                executor_stats[executor_id]["assigned_count"] += 1
                executor_stats[executor_id]["total_value"] += order.total_amount
                
                if order.status == OrderStatus.DELIVERED:
                    executor_stats[executor_id]["completed_count"] += 1
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": period_days
            },
            "summary": {
                "total_orders": total_orders,
                "auto_assigned": auto_assigned,
                "assignment_rate": round(assignment_rate, 2),
                "unassigned": total_orders - auto_assigned
            },
            "executor_performance": list(executor_stats.values())
        }