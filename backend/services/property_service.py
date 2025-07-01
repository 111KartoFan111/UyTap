# backend/services/property_service.py
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
import uuid

from models.extended_models import (
    Property, PropertyStatus, Rental, Task, TaskType, TaskStatus, 
    RoomOrder, InventoryMovement
)
from schemas.property import PropertyCreate, PropertyUpdate


class PropertyService:
    """Сервис для управления помещениями"""
    
    @staticmethod
    def get_property_by_id(db: Session, property_id: uuid.UUID, organization_id: uuid.UUID) -> Optional[Property]:
        """Получить помещение по ID с проверкой принадлежности к организации"""
        return db.query(Property).filter(
            and_(
                Property.id == property_id,
                Property.organization_id == organization_id
            )
        ).first()
    
    @staticmethod
    def check_availability(
        db: Session, 
        property_id: uuid.UUID, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, Any]:
        """Проверить доступность помещения на период"""
        
        # Проверяем пересечения с существующими арендами
        conflicts = db.query(Rental).filter(
            and_(
                Rental.property_id == property_id,
                Rental.is_active == True,
                or_(
                    and_(Rental.start_date <= start_date, Rental.end_date > start_date),
                    and_(Rental.start_date < end_date, Rental.end_date >= end_date),
                    and_(Rental.start_date >= start_date, Rental.end_date <= end_date)
                )
            )
        ).all()
        
        # Проверяем статус помещения
        property_obj = db.query(Property).filter(Property.id == property_id).first()
        
        is_available = (
            len(conflicts) == 0 and 
            property_obj and 
            property_obj.status in [PropertyStatus.AVAILABLE, PropertyStatus.CLEANING] and
            property_obj.is_active
        )
        
        return {
            "is_available": is_available,
            "conflicts": [
                {
                    "rental_id": str(conflict.id),
                    "start_date": conflict.start_date,
                    "end_date": conflict.end_date,
                    "client_name": f"{conflict.client.first_name} {conflict.client.last_name}"
                }
                for conflict in conflicts
            ]
        }
    
    @staticmethod
    def get_suggested_rates(property_obj: Property, start_date: datetime, end_date: datetime) -> Dict[str, float]:
        """Получить рекомендуемые тарифы с учетом сезонности"""
        
        duration = end_date - start_date
        
        # Базовые тарифы
        rates = {}
        
        if property_obj.hourly_rate:
            rates["hourly"] = property_obj.hourly_rate
        if property_obj.daily_rate:
            rates["daily"] = property_obj.daily_rate
        if property_obj.weekly_rate:
            rates["weekly"] = property_obj.weekly_rate
        if property_obj.monthly_rate:
            rates["monthly"] = property_obj.monthly_rate
        
        # Применяем сезонные коэффициенты
        season_multiplier = PropertyService._get_season_multiplier(start_date)
        
        # Применяем скидки за длительность
        duration_multiplier = PropertyService._get_duration_multiplier(duration.days)
        
        # Применяем коэффициенты
        for rate_type in rates:
            rates[rate_type] = round(rates[rate_type] * season_multiplier * duration_multiplier, 2)
        
        return rates
    
    @staticmethod
    def _get_season_multiplier(date: datetime) -> float:
        """Получить сезонный коэффициент"""
        month = date.month
        
        # Высокий сезон (лето): июнь-август
        if month in [6, 7, 8]:
            return 1.2
        # Средний сезон (весна, ранняя осень): апрель-май, сентябрь-октябрь
        elif month in [4, 5, 9, 10]:
            return 1.1
        # Низкий сезон (зима, поздняя осень): ноябрь-март
        else:
            return 0.9
    
    @staticmethod
    def _get_duration_multiplier(days: int) -> float:
        """Получить коэффициент за длительность аренды"""
        if days >= 30:  # Месяц и более - скидка 15%
            return 0.85
        elif days >= 7:  # Неделя и более - скидка 10%
            return 0.9
        elif days >= 3:  # 3+ дня - скидка 5%
            return 0.95
        else:
            return 1.0
    
    @staticmethod
    def get_property_statistics(
        db: Session, 
        property_id: uuid.UUID, 
        period_days: int = 30
    ) -> Dict[str, Any]:
        """Получить статистику по помещению"""
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Аренды за период
        rentals = db.query(Rental).filter(
            and_(
                Rental.property_id == property_id,
                Rental.start_date >= start_date
            )
        ).all()
        
        # Задачи за период
        tasks = db.query(Task).filter(
            and_(
                Task.property_id == property_id,
                Task.created_at >= start_date
            )
        ).all()
        
        # Заказы за период
        orders = db.query(RoomOrder).filter(
            and_(
                RoomOrder.property_id == property_id,
                RoomOrder.requested_at >= start_date
            )
        ).all()
        
        # Вычисляем метрики
        total_revenue = sum(rental.total_amount for rental in rentals)
        orders_revenue = sum(order.total_amount for order in orders)
        
        # Загруженность
        total_days = period_days
        occupied_days = 0
        
        for rental in rentals:
            overlap_start = max(rental.start_date, start_date)
            overlap_end = min(rental.end_date, end_date)
            if overlap_end > overlap_start:
                occupied_days += (overlap_end - overlap_start).days
        
        occupancy_rate = (occupied_days / total_days) * 100 if total_days > 0 else 0
        
        # Статистика по задачам
        completed_tasks = [t for t in tasks if t.status == TaskStatus.COMPLETED]
        avg_task_completion_time = None
        
        if completed_tasks:
            total_time = sum(
                task.actual_duration for task in completed_tasks 
                if task.actual_duration
            )
            if total_time > 0:
                avg_task_completion_time = total_time / len(completed_tasks)
        
        return {
            "property_id": str(property_id),
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": period_days
            },
            "financial": {
                "total_revenue": total_revenue,
                "rental_revenue": total_revenue - orders_revenue,
                "orders_revenue": orders_revenue,
                "average_daily_rate": total_revenue / max(occupied_days, 1),
                "revenue_per_day": total_revenue / total_days
            },
            "occupancy": {
                "total_days": total_days,
                "occupied_days": occupied_days,
                "occupancy_rate": round(occupancy_rate, 2)
            },
            "bookings": {
                "total_bookings": len(rentals),
                "average_stay_duration": sum(
                    (rental.end_date - rental.start_date).days 
                    for rental in rentals
                ) / len(rentals) if rentals else 0
            },
            "tasks": {
                "total_tasks": len(tasks),
                "completed_tasks": len(completed_tasks),
                "completion_rate": (len(completed_tasks) / len(tasks) * 100) if tasks else 0,
                "average_completion_time": avg_task_completion_time
            },
            "orders": {
                "total_orders": len(orders),
                "orders_revenue": orders_revenue,
                "average_order_value": orders_revenue / len(orders) if orders else 0
            }
        }
    
    @staticmethod
    def get_floor_plan_data(db: Session, organization_id: uuid.UUID, floor: Optional[int] = None) -> Dict[str, Any]:
        """Получить данные для плана этажа"""
        
        query = db.query(Property).filter(Property.organization_id == organization_id)
        
        if floor is not None:
            query = query.filter(Property.floor == floor)
        
        properties = query.order_by(Property.floor, Property.number).all()
        
        # Группируем по этажам
        floors_data = {}
        
        for prop in properties:
            floor_num = prop.floor or 0
            
            if floor_num not in floors_data:
                floors_data[floor_num] = {
                    "floor": floor_num,
                    "properties": [],
                    "status_counts": {
                        "available": 0,
                        "occupied": 0,
                        "maintenance": 0,
                        "cleaning": 0,
                        "suspended": 0,
                        "out_of_order": 0
                    }
                }
            
            # Получаем текущую аренду
            current_rental = db.query(Rental).filter(
                and_(
                    Rental.property_id == prop.id,
                    Rental.is_active == True,
                    Rental.start_date <= datetime.now(timezone.utc),
                    Rental.end_date > datetime.now(timezone.utc)
                )
            ).first()
            
            property_data = {
                "id": str(prop.id),
                "name": prop.name,
                "number": prop.number,
                "type": prop.property_type.value,
                "status": prop.status.value,
                "area": prop.area,
                "max_occupancy": prop.max_occupancy,
                "current_rental": None
            }
            
            if current_rental:
                property_data["current_rental"] = {
                    "id": str(current_rental.id),
                    "client_name": f"{current_rental.client.first_name} {current_rental.client.last_name}",
                    "start_date": current_rental.start_date,
                    "end_date": current_rental.end_date,
                    "guest_count": current_rental.guest_count
                }
            
            floors_data[floor_num]["properties"].append(property_data)
            floors_data[floor_num]["status_counts"][prop.status.value] += 1
        
        return {
            "floors": list(floors_data.values()),
            "total_properties": len(properties),
            "overall_status_counts": {
                status: sum(
                    floor["status_counts"][status] 
                    for floor in floors_data.values()
                )
                for status in ["available", "occupied", "maintenance", "cleaning", "suspended", "out_of_order"]
            }
        }
    
    @staticmethod
    def bulk_update_status(
        db: Session, 
        property_ids: List[uuid.UUID], 
        new_status: PropertyStatus,
        organization_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Массовое обновление статуса помещений"""
        
        # Проверяем принадлежность всех помещений к организации
        properties = db.query(Property).filter(
            and_(
                Property.id.in_(property_ids),
                Property.organization_id == organization_id
            )
        ).all()
        
        if len(properties) != len(property_ids):
            missing_ids = set(property_ids) - set(prop.id for prop in properties)
            raise ValueError(f"Properties not found: {missing_ids}")
        
        updated_count = 0
        tasks_created = []
        
        for prop in properties:
            old_status = prop.status
            prop.status = new_status
            prop.updated_at = datetime.now(timezone.utc)
            updated_count += 1
            
            # Создаем автоматические задачи при необходимости
            if new_status == PropertyStatus.CLEANING:
                from services.task_service import TaskService
                task = TaskService.create_cleaning_task(
                    db=db,
                    property_id=prop.id,
                    created_by=user_id,
                    organization_id=organization_id
                )
                tasks_created.append(task.id)
            
            elif new_status == PropertyStatus.MAINTENANCE:
                from services.task_service import TaskService
                task = TaskService.create_maintenance_task(
                    db=db,
                    property_id=prop.id,
                    created_by=user_id,
                    organization_id=organization_id
                )
                tasks_created.append(task.id)
        
        db.commit()
        
        return {
            "updated_count": updated_count,
            "new_status": new_status.value,
            "tasks_created": len(tasks_created),
            "task_ids": [str(task_id) for task_id in tasks_created]
        }