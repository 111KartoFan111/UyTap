# backend/services/inventory_service.py - НОВЫЙ СЕРВИС ДЛЯ РАБОТЫ С ТОВАРАМИ

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
import uuid

from models.extended_models import Inventory, InventoryMovement, User
from schemas.inventory import (
    InventoryCreate, InventoryUpdate, InventoryMovementCreate, 
    InventorySaleRequest, InventoryProfitAnalysis, InventoryValuationReport
)


class InventoryService:
    """Сервис для работы с товарами и ценообразованием"""
    
    @staticmethod
    def create_inventory_item(
        db: Session,
        item_data: InventoryCreate,
        organization_id: uuid.UUID
    ) -> Inventory:
        """Создать новый товар с правильным ценообразованием"""
        
        # Проверяем уникальность SKU
        if item_data.sku:
            existing_item = db.query(Inventory).filter(
                and_(
                    Inventory.organization_id == organization_id,
                    Inventory.sku == item_data.sku
                )
            ).first()
            
            if existing_item:
                raise ValueError(f"Товар с SKU '{item_data.sku}' уже существует")
        
        # Устанавливаем цены
        purchase_price = item_data.purchase_price or item_data.cost_per_unit or 0
        selling_price = item_data.selling_price or purchase_price * 1.2  # 20% наценка по умолчанию
        
        # Создаем товар
        item = Inventory(
            id=uuid.uuid4(),
            organization_id=organization_id,
            name=item_data.name,
            description=item_data.description,
            category=item_data.category,
            sku=item_data.sku,
            unit=item_data.unit,
            current_stock=item_data.current_stock,
            min_stock=item_data.min_stock,
            max_stock=item_data.max_stock,
            purchase_price=purchase_price,
            selling_price=selling_price,
            cost_per_unit=purchase_price,  # Для совместимости
            supplier=item_data.supplier,
            supplier_contact=item_data.supplier_contact,
            last_restock_date=datetime.now(timezone.utc) if item_data.current_stock > 0 else None
        )
        
        # Обновляем общую стоимость
        item.update_total_value()
        
        db.add(item)
        db.flush()
        
        # Создаем начальное движение если есть остаток
        if item_data.current_stock > 0:
            InventoryService.create_movement(
                db=db,
                movement_data=InventoryMovementCreate(
                    inventory_id=str(item.id),
                    movement_type="in",
                    quantity=item_data.current_stock,
                    unit_purchase_price=purchase_price,
                    reason="initial_stock",
                    notes="Начальный остаток"
                ),
                user_id=None,
                organization_id=organization_id
            )
        
        db.commit()
        db.refresh(item)
        return item
    
    @staticmethod
    def create_movement(
        db: Session,
        movement_data: InventoryMovementCreate,
        user_id: Optional[uuid.UUID],
        organization_id: uuid.UUID
    ) -> InventoryMovement:
        """Создать движение товара с правильным учетом цен"""
        
        # Получаем товар
        item = db.query(Inventory).filter(
            and_(
                Inventory.id == uuid.UUID(movement_data.inventory_id),
                Inventory.organization_id == organization_id,
                Inventory.is_active == True
            )
        ).first()
        
        if not item:
            raise ValueError("Товар не найден")
        
        # Проверяем достаточность остатков для расхода/продажи
        if movement_data.movement_type in ["out", "sale", "writeoff"]:
            if item.current_stock < abs(movement_data.quantity):
                raise ValueError(
                    f"Недостаточно товара на складе. "
                    f"Доступно: {item.current_stock}, "
                    f"Запрошено: {abs(movement_data.quantity)}"
                )
        
        # Определяем цены для движения
        unit_purchase_price = movement_data.unit_purchase_price or item.purchase_price or 0
        unit_selling_price = movement_data.unit_selling_price or item.selling_price or 0
        
        # Рассчитываем новый остаток
        new_stock = InventoryService._calculate_new_stock(
            current_stock=item.current_stock,
            movement_type=movement_data.movement_type,
            quantity=movement_data.quantity
        )
        
        # Рассчитываем суммы
        quantity_abs = abs(movement_data.quantity)
        total_purchase_cost = quantity_abs * unit_purchase_price
        total_selling_amount = quantity_abs * unit_selling_price if movement_data.movement_type == "sale" else 0
        
        # Создаем движение
        movement = InventoryMovement(
            id=uuid.uuid4(),
            organization_id=organization_id,
            inventory_id=item.id,
            user_id=user_id,
            task_id=uuid.UUID(movement_data.task_id) if movement_data.task_id else None,
            movement_type=movement_data.movement_type,
            quantity=movement_data.quantity,
            unit_purchase_price=unit_purchase_price,
            unit_selling_price=unit_selling_price,
            unit_cost=unit_purchase_price,  # Для совместимости
            total_purchase_cost=total_purchase_cost,
            total_selling_amount=total_selling_amount,
            total_cost=total_purchase_cost,  # Для совместимости
            reason=movement_data.reason,
            notes=movement_data.notes,
            stock_after=new_stock
        )
        
        # Рассчитываем прибыль для продаж
        movement.calculate_profit()
        
        db.add(movement)
        
        # Обновляем остаток товара
        item.current_stock = new_stock
        item.updated_at = datetime.now(timezone.utc)
        
        if movement_data.movement_type == "in":
            item.last_restock_date = datetime.now(timezone.utc)
            # Обновляем закупочную цену при поступлении
            if unit_purchase_price > 0:
                item.purchase_price = unit_purchase_price
                item.cost_per_unit = unit_purchase_price
        
        # Обновляем общую стоимость
        item.update_total_value()
        
        return movement
    
    @staticmethod
    def _calculate_new_stock(current_stock: float, movement_type: str, quantity: float) -> float:
        """Рассчитать новый остаток после движения"""
        if movement_type == "in":
            return current_stock + abs(quantity)
        elif movement_type in ["out", "sale", "writeoff"]:
            return current_stock - abs(quantity)
        elif movement_type == "adjustment":
            return abs(quantity)
        else:
            raise ValueError(f"Неизвестный тип движения: {movement_type}")
    
    @staticmethod
    def process_sale(
        db: Session,
        sale_data: InventorySaleRequest,
        user_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> InventoryMovement:
        """Обработать продажу товара"""
        
        movement_data = InventoryMovementCreate(
            inventory_id=sale_data.inventory_id,
            movement_type="sale",
            quantity=-abs(sale_data.quantity),  # Отрицательное для продажи
            unit_selling_price=sale_data.selling_price,
            reason=f"Продажа: {sale_data.customer_name}" if sale_data.customer_name else "Продажа товара",
            notes=sale_data.notes,
            task_id=sale_data.order_id
        )
        
        return InventoryService.create_movement(
            db=db,
            movement_data=movement_data,
            user_id=user_id,
            organization_id=organization_id
        )
    
    @staticmethod
    def get_profit_analysis(
        db: Session,
        inventory_id: uuid.UUID,
        organization_id: uuid.UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> InventoryProfitAnalysis:
        """Анализ прибыльности товара"""
        
        # Получаем товар
        item = db.query(Inventory).filter(
            and_(
                Inventory.id == inventory_id,
                Inventory.organization_id == organization_id
            )
        ).first()
        
        if not item:
            raise ValueError("Товар не найден")
        
        # Устанавливаем период по умолчанию (последние 3 месяца)
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            start_date = end_date - timedelta(days=90)
        
        # Получаем все продажи за период
        sales = db.query(InventoryMovement).filter(
            and_(
                InventoryMovement.inventory_id == inventory_id,
                InventoryMovement.movement_type == "sale",
                InventoryMovement.created_at >= start_date,
                InventoryMovement.created_at <= end_date
            )
        ).all()
        
        # Рассчитываем показатели
        total_sold_quantity = sum(abs(sale.quantity) for sale in sales)
        total_revenue = sum(sale.total_selling_amount or 0 for sale in sales)
        total_cost_of_goods_sold = sum(sale.total_purchase_cost or 0 for sale in sales)
        total_profit = total_revenue - total_cost_of_goods_sold
        
        profit_margin_percent = (total_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        # Средняя закупочная цена
        purchase_movements = db.query(InventoryMovement).filter(
            and_(
                InventoryMovement.inventory_id == inventory_id,
                InventoryMovement.movement_type == "in",
                InventoryMovement.unit_purchase_price.isnot(None)
            )
        ).all()
        
        if purchase_movements:
            total_purchased = sum(movement.quantity for movement in purchase_movements)
            weighted_cost = sum(
                movement.quantity * movement.unit_purchase_price 
                for movement in purchase_movements
            )
            average_purchase_price = weighted_cost / total_purchased if total_purchased > 0 else 0
        else:
            average_purchase_price = item.purchase_price or 0
        
        # Оборачиваемость
        turnover_rate = None
        days_in_stock = None
        
        if item.current_stock > 0 and total_sold_quantity > 0:
            period_days = (end_date - start_date).days
            daily_sales_rate = total_sold_quantity / period_days
            days_in_stock = item.current_stock / daily_sales_rate if daily_sales_rate > 0 else None
            turnover_rate = period_days / days_in_stock if days_in_stock else None
        
        return InventoryProfitAnalysis(
            inventory_id=str(inventory_id),
            item_name=item.name,
            current_stock=item.current_stock,
            total_purchase_value=item.total_purchase_value,
            average_purchase_price=average_purchase_price,
            current_selling_price=item.selling_price or 0,
            total_sold_quantity=total_sold_quantity,
            total_revenue=total_revenue,
            total_cost_of_goods_sold=total_cost_of_goods_sold,
            total_profit=total_profit,
            profit_margin_percent=round(profit_margin_percent, 2),
            turnover_rate=round(turnover_rate, 2) if turnover_rate else None,
            days_in_stock=round(days_in_stock, 1) if days_in_stock else None
        )
    
    @staticmethod
    def get_valuation_report(
        db: Session,
        organization_id: uuid.UUID
    ) -> InventoryValuationReport:
        """Отчет по оценке стоимости всех запасов"""
        
        # Получаем все активные товары
        items = db.query(Inventory).filter(
            and_(
                Inventory.organization_id == organization_id,
                Inventory.is_active == True
            )
        ).all()
        
        total_items = len(items)
        total_stock_quantity = sum(item.current_stock for item in items)
        total_purchase_value = sum(item.total_purchase_value for item in items)
        total_selling_value = sum(
            item.current_stock * (item.selling_price or 0) for item in items
        )
        potential_profit = total_selling_value - total_purchase_value
        
        # Группировка по категориям
        by_category = {}
        for item in items:
            category = item.category or "Без категории"
            if category not in by_category:
                by_category[category] = {
                    "items_count": 0,
                    "total_quantity": 0,
                    "purchase_value": 0,
                    "selling_value": 0,
                    "potential_profit": 0
                }
            
            by_category[category]["items_count"] += 1
            by_category[category]["total_quantity"] += item.current_stock
            by_category[category]["purchase_value"] += item.total_purchase_value
            by_category[category]["selling_value"] += item.current_stock * (item.selling_price or 0)
            by_category[category]["potential_profit"] = (
                by_category[category]["selling_value"] - by_category[category]["purchase_value"]
            )
        
        # Топ товары по стоимости
        top_value_items = [
            {
                "id": str(item.id),
                "name": item.name,
                "sku": item.sku,
                "current_stock": item.current_stock,
                "purchase_value": item.total_purchase_value,
                "selling_value": item.current_stock * (item.selling_price or 0),
                "potential_profit": item.current_stock * (item.profit_per_unit or 0)
            }
            for item in sorted(items, key=lambda x: x.total_purchase_value, reverse=True)[:10]
        ]
        
        # Товары с низким остатком
        low_stock_items = [
            {
                "id": str(item.id),
                "name": item.name,
                "sku": item.sku,
                "current_stock": item.current_stock,
                "min_stock": item.min_stock,
                "shortage": item.min_stock - item.current_stock,
                "reorder_value": (item.min_stock - item.current_stock) * (item.purchase_price or 0)
            }
            for item in items
            if item.current_stock <= item.min_stock and item.min_stock > 0
        ]
        
        return InventoryValuationReport(
            report_date=datetime.now(timezone.utc),
            organization_id=str(organization_id),
            total_items=total_items,
            total_stock_quantity=total_stock_quantity,
            total_purchase_value=total_purchase_value,
            total_selling_value=total_selling_value,
            potential_profit=potential_profit,
            by_category=by_category,
            top_value_items=top_value_items,
            low_stock_items=low_stock_items
        )
    
    @staticmethod
    def update_prices_bulk(
        db: Session,
        price_updates: List[Dict[str, Any]],
        organization_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Массовое обновление цен товаров"""
        
        results = {
            "updated": [],
            "errors": []
        }
        
        for update in price_updates:
            try:
                item_id = uuid.UUID(update["item_id"])
                new_purchase_price = update.get("purchase_price")
                new_selling_price = update.get("selling_price")
                
                # Находим товар
                item = db.query(Inventory).filter(
                    and_(
                        Inventory.id == item_id,
                        Inventory.organization_id == organization_id
                    )
                ).first()
                
                if not item:
                    results["errors"].append({
                        "item_id": str(item_id),
                        "error": "Товар не найден"
                    })
                    continue
                
                old_purchase_price = item.purchase_price
                old_selling_price = item.selling_price
                
                # Обновляем цены
                if new_purchase_price is not None:
                    item.purchase_price = new_purchase_price
                    item.cost_per_unit = new_purchase_price  # Для совместимости
                
                if new_selling_price is not None:
                    item.selling_price = new_selling_price
                
                # Проверяем корректность цен
                if item.selling_price and item.purchase_price:
                    if item.selling_price < item.purchase_price:
                        results["errors"].append({
                            "item_id": str(item_id),
                            "error": "Цена продажи не может быть меньше закупочной"
                        })
                        continue
                
                # Обновляем общую стоимость
                item.update_total_value()
                item.updated_at = datetime.now(timezone.utc)
                
                results["updated"].append({
                    "item_id": str(item_id),
                    "item_name": item.name,
                    "old_purchase_price": old_purchase_price,
                    "new_purchase_price": item.purchase_price,
                    "old_selling_price": old_selling_price,
                    "new_selling_price": item.selling_price,
                    "new_profit_margin": item.profit_margin
                })
                
            except Exception as e:
                results["errors"].append({
                    "item_id": update.get("item_id", "unknown"),
                    "error": str(e)
                })
        
        if results["updated"]:
            db.commit()
        
        return results
    
    @staticmethod
    def get_pricing_recommendations(
        db: Session,
        organization_id: uuid.UUID,
        target_margin: float = 25.0
    ) -> List[Dict[str, Any]]:
        """Рекомендации по ценообразованию"""
        
        items = db.query(Inventory).filter(
            and_(
                Inventory.organization_id == organization_id,
                Inventory.is_active == True,
                Inventory.purchase_price.isnot(None),
                Inventory.purchase_price > 0
            )
        ).all()
        
        recommendations = []
        
        for item in items:
            current_margin = item.profit_margin if item.profit_margin is not None else 0
            recommended_selling_price = item.purchase_price * (1 + target_margin / 100)
            
            recommendation = {
                "item_id": str(item.id),
                "item_name": item.name,
                "sku": item.sku,
                "current_purchase_price": item.purchase_price,
                "current_selling_price": item.selling_price,
                "current_margin": round(current_margin, 2),
                "recommended_selling_price": round(recommended_selling_price, 2),
                "target_margin": target_margin,
                "price_adjustment": round(recommended_selling_price - (item.selling_price or 0), 2),
                "potential_profit_increase": 0
            }
            
            # Рассчитываем потенциальное увеличение прибыли
            if item.current_stock > 0:
                current_profit_per_unit = item.profit_per_unit or 0
                new_profit_per_unit = recommended_selling_price - item.purchase_price
                profit_increase_per_unit = new_profit_per_unit - current_profit_per_unit
                recommendation["potential_profit_increase"] = round(
                    profit_increase_per_unit * item.current_stock, 2
                )
            
            # Добавляем рекомендацию только если есть существенная разница
            if abs(recommendation["price_adjustment"]) > 0.01:
                if current_margin < target_margin - 5:  # Маржа значительно ниже целевой
                    recommendation["action"] = "increase_price"
                    recommendation["priority"] = "high" if current_margin < target_margin - 15 else "medium"
                elif current_margin > target_margin + 10:  # Маржа значительно выше
                    recommendation["action"] = "consider_price_reduction"
                    recommendation["priority"] = "low"
                else:
                    recommendation["action"] = "optimal"
                    recommendation["priority"] = "none"
                
                recommendations.append(recommendation)
        
        # Сортируем по приоритету и потенциальной прибыли
        priority_order = {"high": 3, "medium": 2, "low": 1, "none": 0}
        recommendations.sort(
            key=lambda x: (priority_order.get(x["priority"], 0), x["potential_profit_increase"]),
            reverse=True
        )
        
        return recommendations
    
    @staticmethod
    def calculate_inventory_turnover(
        db: Session,
        inventory_id: uuid.UUID,
        organization_id: uuid.UUID,
        days: int = 90
    ) -> Dict[str, Any]:
        """Рассчитать оборачиваемость товара"""
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        # Получаем товар
        item = db.query(Inventory).filter(
            and_(
                Inventory.id == inventory_id,
                Inventory.organization_id == organization_id
            )
        ).first()
        
        if not item:
            raise ValueError("Товар не найден")
        
        # Получаем все движения за период
        movements = db.query(InventoryMovement).filter(
            and_(
                InventoryMovement.inventory_id == inventory_id,
                InventoryMovement.created_at >= start_date,
                InventoryMovement.created_at <= end_date
            )
        ).order_by(InventoryMovement.created_at).all()
        
        # Рассчитываем средний остаток
        daily_stocks = []
        current_stock = item.current_stock
        
        # Восстанавливаем остатки на каждый день
        for movement in reversed(movements):
            if movement.movement_type == "in":
                current_stock -= movement.quantity
            elif movement.movement_type in ["out", "sale", "writeoff"]:
                current_stock += abs(movement.quantity)
            elif movement.movement_type == "adjustment":
                # Для корректировки нужно знать предыдущий остаток
                pass
        
        # Упрощенный расчет среднего остатка
        beginning_stock = current_stock
        ending_stock = item.current_stock
        average_inventory = (beginning_stock + ending_stock) / 2
        
        # Себестоимость проданных товаров
        cogs = sum(
            movement.total_purchase_cost or 0
            for movement in movements
            if movement.movement_type == "sale"
        )
        
        # Коэффициент оборачиваемости
        turnover_ratio = cogs / average_inventory if average_inventory > 0 else 0
        
        # Дни оборачиваемости
        days_to_sell = days / turnover_ratio if turnover_ratio > 0 else float('inf')
        
        return {
            "item_id": str(inventory_id),
            "item_name": item.name,
            "period_days": days,
            "beginning_stock": beginning_stock,
            "ending_stock": ending_stock,
            "average_inventory": average_inventory,
            "cost_of_goods_sold": cogs,
            "turnover_ratio": round(turnover_ratio, 2),
            "days_to_sell": round(days_to_sell, 1) if days_to_sell != float('inf') else None,
            "turnover_category": InventoryService._categorize_turnover(days_to_sell)
        }
    
    @staticmethod
    def _categorize_turnover(days_to_sell: float) -> str:
        """Категоризация оборачиваемости"""
        if days_to_sell == float('inf'):
            return "no_sales"
        elif days_to_sell <= 30:
            return "fast_moving"
        elif days_to_sell <= 90:
            return "medium_moving"
        else:
            return "slow_moving"