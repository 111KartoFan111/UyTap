from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
import uuid

from models.extended_models import Client, Rental, RoomOrder
from schemas.client import ClientCreate, ClientUpdate


class ClientService:
    """Сервис для управления клиентами"""
    
    @staticmethod
    def get_client_by_id(db: Session, client_id: uuid.UUID, organization_id: uuid.UUID) -> Optional[Client]:
        """Получить клиента по ID с проверкой принадлежности к организации"""
        return db.query(Client).filter(
            and_(
                Client.id == client_id,
                Client.organization_id == organization_id
            )
        ).first()
    
    @staticmethod
    def create_client(
        db: Session,
        client_data: ClientCreate,
        organization_id: uuid.UUID
    ) -> Client:
        """Создать нового клиента"""
        
        client = Client(
            id=uuid.uuid4(),
            organization_id=organization_id,
            **client_data.dict()
        )
        
        db.add(client)
        db.commit()
        db.refresh(client)
        
        return client
    
    @staticmethod
    def update_client(
        db: Session,
        client: Client,
        client_data: ClientUpdate
    ) -> Client:
        """Обновить клиента"""
        
        update_data = client_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(client, field, value)
        
        client.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(client)
        
        return client
    
    @staticmethod
    def get_client_history(db: Session, client_id: uuid.UUID) -> Dict[str, Any]:
        """Получить историю клиента"""
        
        # Аренды клиента
        rentals = db.query(Rental).filter(
            Rental.client_id == client_id
        ).order_by(desc(Rental.created_at)).all()
        
        # Заказы клиента
        orders = db.query(RoomOrder).filter(
            RoomOrder.client_id == client_id
        ).order_by(desc(RoomOrder.requested_at)).all()
        
        return {
            "rentals": [
                {
                    "id": str(rental.id),
                    "property_name": rental.property.name if rental.property else None,
                    "property_number": rental.property.number if rental.property else None,
                    "rental_type": rental.rental_type.value,
                    "start_date": rental.start_date,
                    "end_date": rental.end_date,
                    "total_amount": rental.total_amount,
                    "paid_amount": rental.paid_amount,
                    "status": "completed" if rental.checked_out else "active" if rental.checked_in else "upcoming",
                    "created_at": rental.created_at
                }
                for rental in rentals
            ],
            "orders": [
                {
                    "id": str(order.id),
                    "order_number": order.order_number,
                    "property_name": order.property.name if order.property else None,
                    "order_type": order.order_type,
                    "title": order.title,
                    "total_amount": order.total_amount,
                    "status": order.status.value,
                    "requested_at": order.requested_at,
                    "completed_at": order.completed_at
                }
                for order in orders
            ]
        }
    
    @staticmethod
    def get_client_statistics(db: Session, client_id: uuid.UUID) -> Dict[str, Any]:
        """Получить статистику по клиенту"""
        
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            return {}
        
        # Аренды клиента
        rentals = db.query(Rental).filter(Rental.client_id == client_id).all()
        completed_rentals = [r for r in rentals if r.checked_out]
        
        # Заказы клиента
        orders = db.query(RoomOrder).filter(RoomOrder.client_id == client_id).all()
        
        # Финансовые метрики
        total_spent = sum(r.total_amount for r in rentals)
        orders_spent = sum(o.total_amount for o in orders)
        
        # Предпочтения по типам аренды
        rental_types = {}
        for rental in rentals:
            rental_type = rental.rental_type.value
            if rental_type not in rental_types:
                rental_types[rental_type] = {"count": 0, "amount": 0}
            rental_types[rental_type]["count"] += 1
            rental_types[rental_type]["amount"] += rental.total_amount
        
        # Средняя продолжительность пребывания
        avg_stay_duration = 0
        if completed_rentals:
            total_duration = sum(
                (r.check_out_time - r.check_in_time).days
                for r in completed_rentals
                if r.check_in_time and r.check_out_time
            )
            avg_stay_duration = total_duration / len(completed_rentals)
        
        # Частота посещений
        if rentals:
            first_visit = min(r.created_at for r in rentals)
            days_since_first = (datetime.now(timezone.utc) - first_visit).days
            visit_frequency = len(rentals) / max(days_since_first / 30, 1)  # посещений в месяц
        else:
            visit_frequency = 0
        
        return {
            "client_info": {
                "total_rentals": len(rentals),
                "completed_rentals": len(completed_rentals),
                "total_orders": len(orders),
                "first_visit": min(r.created_at for r in rentals) if rentals else None,
                "last_visit": client.last_visit
            },
            "financial": {
                "total_spent": total_spent,
                "rental_spent": total_spent,
                "orders_spent": orders_spent,
                "avg_rental_value": total_spent / len(rentals) if rentals else 0,
                "avg_order_value": orders_spent / len(orders) if orders else 0
            },
            "preferences": {
                "rental_types": rental_types,
                "avg_stay_duration": avg_stay_duration,
                "visit_frequency_per_month": visit_frequency
            },
            "loyalty_tier": ClientService._calculate_loyalty_tier(total_spent, len(rentals))
        }
    
    @staticmethod
    def _calculate_loyalty_tier(total_spent: float, total_rentals: int) -> str:
        """Определить уровень лояльности клиента"""
        if total_spent >= 500000 or total_rentals >= 10:
            return "VIP"
        elif total_spent >= 200000 or total_rentals >= 5:
            return "Gold"
        elif total_spent >= 50000 or total_rentals >= 2:
            return "Silver"
        else:
            return "Bronze"
    
    @staticmethod
    def bulk_import(
        db: Session,
        clients_data: List[ClientCreate],
        organization_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Массовый импорт клиентов"""
        
        imported = 0
        errors = []
        
        for i, client_data in enumerate(clients_data):
            try:
                # Проверяем дубликаты по телефону
                if client_data.phone:
                    existing = db.query(Client).filter(
                        and_(
                            Client.organization_id == organization_id,
                            Client.phone == client_data.phone
                        )
                    ).first()
                    
                    if existing:
                        errors.append(f"Row {i+1}: Client with phone {client_data.phone} already exists")
                        continue
                
                # Создаем клиента
                client = Client(
                    id=uuid.uuid4(),
                    organization_id=organization_id,
                    **client_data.dict()
                )
                
                db.add(client)
                imported += 1
                
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
                continue
        
        if imported > 0:
            db.commit()
        
        return {
            "imported": imported,
            "errors": len(errors),
            "error_details": errors
        }