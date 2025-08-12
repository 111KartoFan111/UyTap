# backend/routers/inventory.py - ОБНОВЛЕННЫЕ РОУТЫ С ЦЕНООБРАЗОВАНИЕМ

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, and_, func
import uuid

from models.database import get_db
from models.extended_models import Inventory, InventoryMovement
from schemas.inventory import (
    InventoryCreate, InventoryUpdate, InventoryResponse,
    InventoryMovementCreate, InventoryMovementResponse,
    InventorySaleRequest, InventoryProfitAnalysis, InventoryValuationReport
)
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
from services.inventory_service import InventoryService
from typing import Dict, Any


router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.post("", response_model=InventoryResponse)
async def create_inventory_item(
    item_data: InventoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать новый товар с ценообразованием"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания товаров"
        )
    
    try:
        item = InventoryService.create_inventory_item(
            db=db,
            item_data=item_data,
            organization_id=current_user.organization_id
        )
        
        # Логируем создание
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="inventory_item_created_with_pricing",
            organization_id=current_user.organization_id,
            resource_type="inventory",
            resource_id=item.id,
            details={
                "item_name": item.name,
                "sku": item.sku,
                "purchase_price": item.purchase_price,
                "selling_price": item.selling_price,
                "profit_margin": item.profit_margin,
                "initial_stock": item.current_stock
            }
        )
        
        return item
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{item_id}/sale", response_model=InventoryMovementResponse)
async def process_item_sale(
    item_id: uuid.UUID,
    sale_data: InventorySaleRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обработать продажу товара"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для продажи товаров"
        )
    
    try:
        # Проверяем что item_id в URL совпадает с данными
        if str(item_id) != sale_data.inventory_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ID товара в URL не совпадает с данными"
            )
        
        movement = InventoryService.process_sale(
            db=db,
            sale_data=sale_data,
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )
        
        # Логируем продажу
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="inventory_sale_processed",
            organization_id=current_user.organization_id,
            resource_type="inventory_movement",
            resource_id=movement.id,
            details={
                "item_id": sale_data.inventory_id,
                "quantity": sale_data.quantity,
                "selling_price": sale_data.selling_price,
                "customer": sale_data.customer_name,
                "profit": movement.profit_amount,
                "total_amount": movement.total_selling_amount
            }
        )
        
        return movement
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{item_id}/profit-analysis", response_model=InventoryProfitAnalysis)
async def get_item_profit_analysis(
    item_id: uuid.UUID,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить анализ прибыльности товара"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра анализа прибыльности"
        )
    
    try:
        analysis = InventoryService.get_profit_analysis(
            db=db,
            inventory_id=item_id,
            organization_id=current_user.organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return analysis
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/valuation-report", response_model=InventoryValuationReport)
async def get_inventory_valuation_report(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить отчет по оценке стоимости всех запасов"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра отчета по оценке запасов"
        )
    
    try:
        report = InventoryService.get_valuation_report(
            db=db,
            organization_id=current_user.organization_id
        )
        
        return report
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации отчета: {str(e)}"
        )


@router.post("/update-prices-bulk")
async def update_prices_bulk(
    price_updates: List[Dict[str, Any]],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Массовое обновление цен товаров"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для массового обновления цен"
        )
    
    try:
        results = InventoryService.update_prices_bulk(
            db=db,
            price_updates=price_updates,
            organization_id=current_user.organization_id,
            user_id=current_user.id
        )
        
        # Логируем массовое обновление
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="inventory_prices_bulk_updated",
            organization_id=current_user.organization_id,
            details={
                "total_updates": len(price_updates),
                "successful_updates": len(results["updated"]),
                "errors": len(results["errors"])
            }
        )
        
        return results
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при обновлении цен: {str(e)}"
        )


@router.get("/pricing-recommendations")
async def get_pricing_recommendations(
    target_margin: float = Query(25.0, ge=0, le=100, description="Целевая маржа в %"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить рекомендации по ценообразованию"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра рекомендаций по ценообразованию"
        )
    
    try:
        recommendations = InventoryService.get_pricing_recommendations(
            db=db,
            organization_id=current_user.organization_id,
            target_margin=target_margin
        )
        
        return {
            "target_margin": target_margin,
            "recommendations_count": len(recommendations),
            "recommendations": recommendations,
            "summary": {
                "high_priority": len([r for r in recommendations if r.get("priority") == "high"]),
                "medium_priority": len([r for r in recommendations if r.get("priority") == "medium"]),
                "low_priority": len([r for r in recommendations if r.get("priority") == "low"]),
                "total_potential_profit": sum(r.get("potential_profit_increase", 0) for r in recommendations)
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении рекомендаций: {str(e)}"
        )


@router.get("/{item_id}/turnover-analysis")
async def get_inventory_turnover_analysis(
    item_id: uuid.UUID,
    days: int = Query(90, ge=30, le=365, description="Период анализа в днях"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить анализ оборачиваемости товара"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра анализа оборачиваемости"
        )
    
    try:
        analysis = InventoryService.calculate_inventory_turnover(
            db=db,
            inventory_id=item_id,
            organization_id=current_user.organization_id,
            days=days
        )
        
        return analysis
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при анализе оборачиваемости: {str(e)}"
        )


@router.get("/sales-report")
async def get_inventory_sales_report_with_acquiring(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    category: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    format: str = Query("json", regex="^(json|xlsx)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить отчет по продажам товаров с учетом эквайринга"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра отчета по продажам"
        )
    
    try:
        # Получаем продажи за период
        query = db.query(InventoryMovement).filter(
            and_(
                InventoryMovement.organization_id == current_user.organization_id,
                InventoryMovement.movement_type == "sale",
                InventoryMovement.created_at >= start_date,
                InventoryMovement.created_at <= end_date
            )
        ).options(selectinload(InventoryMovement.inventory_item))
        
        if category:
            query = query.join(Inventory).filter(Inventory.category == category)
        
        if payment_method:
            query = query.filter(InventoryMovement.payment_method == payment_method)
        
        sales = query.order_by(desc(InventoryMovement.created_at)).all()
        
        # Формируем отчет с учетом эквайринга
        total_gross_revenue = sum(sale.total_selling_amount or 0 for sale in sales)
        total_commission = sum(sale.acquiring_commission_amount or 0 for sale in sales)
        total_net_revenue = sum(sale.net_selling_amount or 0 for sale in sales)
        total_cost = sum(sale.total_purchase_cost or 0 for sale in sales)
        total_profit = total_net_revenue - total_cost
        total_quantity = sum(abs(sale.quantity) for sale in sales)
        
        # Группировка по способам оплаты
        payment_breakdown = {
            "cash": {
                "count": len([s for s in sales if s.payment_method == "cash"]),
                "gross_amount": sum(s.total_selling_amount or 0 for s in sales if s.payment_method == "cash"),
                "commission": 0,
                "net_amount": sum(s.total_selling_amount or 0 for s in sales if s.payment_method == "cash")
            },
            "card": {
                "count": len([s for s in sales if s.payment_method == "card"]),
                "gross_amount": sum(s.total_selling_amount or 0 for s in sales if s.payment_method == "card"),
                "commission": sum(s.acquiring_commission_amount or 0 for s in sales if s.payment_method == "card"),
                "net_amount": sum(s.net_selling_amount or 0 for s in sales if s.payment_method == "card")
            },
            "qr_code": {
                "count": len([s for s in sales if s.payment_method == "qr_code"]),
                "gross_amount": sum(s.total_selling_amount or 0 for s in sales if s.payment_method == "qr_code"),
                "commission": sum(s.acquiring_commission_amount or 0 for s in sales if s.payment_method == "qr_code"),
                "net_amount": sum(s.net_selling_amount or 0 for s in sales if s.payment_method == "qr_code")
            }
        }
        
        sales_data = []
        for sale in sales:
            item = sale.inventory_item
            sales_data.append({
                "sale_id": str(sale.id),
                "item_name": item.name if item else "Unknown",
                "item_sku": item.sku if item else None,
                "category": item.category if item else None,
                "quantity": abs(sale.quantity),
                "unit_selling_price": sale.unit_selling_price,
                "unit_purchase_price": sale.unit_purchase_price,
                "gross_revenue": sale.total_selling_amount,
                "payment_method": sale.payment_method,
                "acquiring_provider": sale.acquiring_provider,
                "commission_rate": sale.acquiring_commission_rate,
                "commission_amount": sale.acquiring_commission_amount,
                "net_revenue": sale.net_selling_amount,
                "total_cost": sale.total_purchase_cost,
                "profit": sale.profit_amount,
                "profit_margin": ((sale.profit_amount / sale.net_selling_amount) * 100) if sale.net_selling_amount else 0,
                "sale_date": sale.created_at,
                "notes": sale.notes
            })
        
        report = {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": (end_date - start_date).days + 1
            },
            "summary": {
                "total_sales": len(sales),
                "total_quantity": total_quantity,
                "total_gross_revenue": total_gross_revenue,
                "total_commission": total_commission,
                "total_net_revenue": total_net_revenue,
                "total_cost": total_cost,
                "total_profit": total_profit,
                "average_commission_rate": (total_commission / total_gross_revenue * 100) if total_gross_revenue > 0 else 0,
                "profit_margin": (total_profit / total_net_revenue * 100) if total_net_revenue > 0 else 0,
                "average_sale_value": total_net_revenue / len(sales) if sales else 0
            },
            "payment_methods": payment_breakdown,
            "sales": sales_data
        }
        
        if format == "xlsx":
            # Генерируем Excel файл с дополнительными колонками эквайринга
            import xlsxwriter
            import io
            
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet("Продажи с эквайрингом")
            
            # Стили
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#D7E4BC',
                'border': 1,
                'align': 'center'
            })
            money_format = workbook.add_format({'num_format': '#,##0.00" ₸"'})
            percent_format = workbook.add_format({'num_format': '0.00"%"'})
            date_format = workbook.add_format({'num_format': 'dd.mm.yyyy hh:mm'})
            
            # Заголовки с эквайрингом
            headers = [
                'Дата продажи', 'Наименование', 'SKU', 'Категория', 'Количество',
                'Цена продажи', 'Закупочная цена', 'Валовая выручка', 'Способ оплаты',
                'Провайдер эквайринга', 'Ставка комиссии %', 'Сумма комиссии',
                'Чистая выручка', 'Себестоимость', 'Прибыль', 'Маржа %', 'Примечания'
            ]
            
            for col, header in enumerate(headers):
                worksheet.write(0, col, header, header_format)
            
            # Данные
            for row, sale in enumerate(sales_data, 1):
                worksheet.write(row, 0, sale["sale_date"], date_format)
                worksheet.write(row, 1, sale["item_name"])
                worksheet.write(row, 2, sale["item_sku"] or "")
                worksheet.write(row, 3, sale["category"] or "")
                worksheet.write(row, 4, sale["quantity"])
                worksheet.write(row, 5, sale["unit_selling_price"] or 0, money_format)
                worksheet.write(row, 6, sale["unit_purchase_price"] or 0, money_format)
                worksheet.write(row, 7, sale["gross_revenue"] or 0, money_format)
                worksheet.write(row, 8, sale["payment_method"] or "")
                worksheet.write(row, 9, sale["acquiring_provider"] or "")
                worksheet.write(row, 10, (sale["commission_rate"] or 0) / 100, percent_format)
                worksheet.write(row, 11, sale["commission_amount"] or 0, money_format)
                worksheet.write(row, 12, sale["net_revenue"] or 0, money_format)
                worksheet.write(row, 13, sale["total_cost"] or 0, money_format)
                worksheet.write(row, 14, sale["profit"] or 0, money_format)
                worksheet.write(row, 15, (sale["profit_margin"] or 0) / 100, percent_format)
                worksheet.write(row, 16, sale["notes"] or "")
            
            # Итоговая строка
            total_row = len(sales_data) + 2
            worksheet.write(total_row, 0, "ИТОГО:", header_format)
            worksheet.write(total_row, 4, total_quantity)
            worksheet.write(total_row, 7, total_gross_revenue, money_format)
            worksheet.write(total_row, 11, total_commission, money_format)
            worksheet.write(total_row, 12, total_net_revenue, money_format)
            worksheet.write(total_row, 13, total_cost, money_format)
            worksheet.write(total_row, 14, total_profit, money_format)
            worksheet.write(total_row, 15, (total_profit / total_net_revenue) if total_net_revenue > 0 else 0, percent_format)
            
            # Автоширина колонок
            worksheet.set_column('A:A', 18)  # Дата
            worksheet.set_column('B:B', 25)  # Наименование
            worksheet.set_column('C:C', 12)  # SKU
            worksheet.set_column('D:D', 15)  # Категория
            worksheet.set_column('E:P', 15)  # Остальные колонки
            worksheet.set_column('Q:Q', 30)  # Примечания
            
            workbook.close()
            output.seek(0)
            
            filename = f"sales_with_acquiring_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.xlsx"
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        return report
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации отчета по продажам: {str(e)}"
        )

@router.get("/profit-dashboard")
async def get_inventory_profit_dashboard(
    period_days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Дашборд прибыльности товаров"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра дашборда прибыльности"
        )
    
    try:
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Получаем все продажи за период
        sales = db.query(InventoryMovement).filter(
            and_(
                InventoryMovement.organization_id == current_user.organization_id,
                InventoryMovement.movement_type == "sale",
                InventoryMovement.created_at >= start_date,
                InventoryMovement.created_at <= end_date
            )
        ).options(selectinload(InventoryMovement.inventory_item)).all()
        
        # Группируем по товарам
        items_performance = {}
        
        for sale in sales:
            item = sale.inventory_item
            if not item:
                continue
                
            item_id = str(item.id)
            if item_id not in items_performance:
                items_performance[item_id] = {
                    "item_id": item_id,
                    "item_name": item.name,
                    "sku": item.sku,
                    "category": item.category,
                    "current_stock": item.current_stock,
                    "current_selling_price": item.selling_price,
                    "current_purchase_price": item.purchase_price,
                    "sales_count": 0,
                    "total_quantity_sold": 0,
                    "total_revenue": 0,
                    "total_cost": 0,
                    "total_profit": 0,
                    "average_profit_margin": 0,
                    "turnover_score": "unknown"
                }
            
            performance = items_performance[item_id]
            performance["sales_count"] += 1
            performance["total_quantity_sold"] += abs(sale.quantity)
            performance["total_revenue"] += sale.total_selling_amount or 0
            performance["total_cost"] += sale.total_purchase_cost or 0
            performance["total_profit"] += sale.profit_amount or 0
        
        # Рассчитываем средние показатели и категоризируем
        for performance in items_performance.values():
            if performance["total_revenue"] > 0:
                performance["average_profit_margin"] = (performance["total_profit"] / performance["total_revenue"]) * 100
            
            # Категоризация по оборачиваемости
            if performance["current_stock"] > 0 and performance["total_quantity_sold"] > 0:
                daily_sales_rate = performance["total_quantity_sold"] / period_days
                days_to_sell_stock = performance["current_stock"] / daily_sales_rate
                
                if days_to_sell_stock <= 30:
                    performance["turnover_score"] = "fast"
                elif days_to_sell_stock <= 90:
                    performance["turnover_score"] = "medium"
                else:
                    performance["turnover_score"] = "slow"
            elif performance["total_quantity_sold"] == 0:
                performance["turnover_score"] = "no_sales"
        
        # Сортируем по прибыли
        top_performers = sorted(
            items_performance.values(),
            key=lambda x: x["total_profit"],
            reverse=True
        )[:10]
        
        # Общая статистика
        total_revenue = sum(p["total_revenue"] for p in items_performance.values())
        total_cost = sum(p["total_cost"] for p in items_performance.values())
        total_profit = total_revenue - total_cost
        
        # Статистика по категориям
        category_stats = {}
        for performance in items_performance.values():
            category = performance["category"] or "Без категории"
            if category not in category_stats:
                category_stats[category] = {
                    "items_count": 0,
                    "total_revenue": 0,
                    "total_cost": 0,
                    "total_profit": 0,
                    "average_margin": 0
                }
            
            stats = category_stats[category]
            stats["items_count"] += 1
            stats["total_revenue"] += performance["total_revenue"]
            stats["total_cost"] += performance["total_cost"]
            stats["total_profit"] += performance["total_profit"]
        
        # Рассчитываем средние маржи по категориям
        for stats in category_stats.values():
            if stats["total_revenue"] > 0:
                stats["average_margin"] = (stats["total_profit"] / stats["total_revenue"]) * 100
        
        # Аналитика по оборачиваемости
        turnover_analysis = {
            "fast_moving": len([p for p in items_performance.values() if p["turnover_score"] == "fast"]),
            "medium_moving": len([p for p in items_performance.values() if p["turnover_score"] == "medium"]),
            "slow_moving": len([p for p in items_performance.values() if p["turnover_score"] == "slow"]),
            "no_sales": len([p for p in items_performance.values() if p["turnover_score"] == "no_sales"])
        }
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": period_days
            },
            "summary": {
                "total_items_sold": len(items_performance),
                "total_sales_transactions": len(sales),
                "total_revenue": total_revenue,
                "total_cost": total_cost,
                "total_profit": total_profit,
                "overall_profit_margin": (total_profit / total_revenue * 100) if total_revenue > 0 else 0,
                "average_sale_value": total_revenue / len(sales) if sales else 0
            },
            "top_performers": top_performers,
            "category_performance": category_stats,
            "turnover_analysis": turnover_analysis,
            "recommendations": {
                "focus_on_fast_movers": [
                    item["item_name"] for item in top_performers[:3]
                    if item["turnover_score"] == "fast"
                ],
                "review_slow_movers": [
                    item["item_name"] for item in items_performance.values()
                    if item["turnover_score"] == "slow" and item["current_stock"] > 0
                ][:5],
                "price_optimization_candidates": [
                    item["item_name"] for item in items_performance.values()
                    if item["average_profit_margin"] < 15 and item["total_revenue"] > 0
                ][:5]
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации дашборда прибыльности: {str(e)}"
        )


# Остальные существующие методы остаются без изменений
@router.get("", response_model=List[InventoryResponse])
async def get_inventory_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category: Optional[str] = None,
    search: Optional[str] = None,
    low_stock: bool = Query(False),
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список товаров инвентаря"""
    
    query = db.query(Inventory).filter(Inventory.organization_id == current_user.organization_id)
    
    if category:
        query = query.filter(Inventory.category == category)
    
    if search:
        query = query.filter(
            Inventory.name.ilike(f"%{search}%") |
            Inventory.description.ilike(f"%{search}%") |
            Inventory.sku.ilike(f"%{search}%")
        )
    
    if low_stock:
        query = query.filter(Inventory.current_stock <= Inventory.min_stock)
    
    if is_active is not None:
        query = query.filter(Inventory.is_active == is_active)
    
    items = query.order_by(Inventory.name).offset(skip).limit(limit).all()
    
    # Добавляем вычисляемые поля
    for item in items:
        item.profit_margin = item.profit_margin
        item.profit_per_unit = item.profit_per_unit
    
    return items


@router.post("/{item_id}/movement", response_model=InventoryMovementResponse)
async def create_inventory_movement(
    item_id: uuid.UUID,
    movement_data: InventoryMovementCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать движение товара с учетом цен"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.TECHNICAL_STAFF, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания движений товаров"
        )
    
    # Проверяем что item_id в URL совпадает с данными
    if str(item_id) != movement_data.inventory_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID товара в URL не совпадает с данными"
        )
    
    try:
        movement = InventoryService.create_movement(
            db=db,
            movement_data=movement_data,
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )
        
        # Логируем движение
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="inventory_movement_created_with_pricing",
            organization_id=current_user.organization_id,
            resource_type="inventory_movement",
            resource_id=movement.id,
            details={
                "item_id": movement_data.inventory_id,
                "movement_type": movement_data.movement_type,
                "quantity": movement_data.quantity,
                "unit_purchase_price": movement.unit_purchase_price,
                "unit_selling_price": movement.unit_selling_price,
                "profit_amount": movement.profit_amount,
                "stock_after": movement.stock_after
            }
        )
        
        db.commit()
        db.refresh(movement)
        return movement
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    

@router.get("/sales-acquiring-report")
async def get_sales_acquiring_report(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    payment_method: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отчет по продажам с детализацией эквайринга"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра отчета по эквайрингу"
        )
    
    try:
        report = InventoryService.get_sales_with_acquiring_report(
            db=db,
            organization_id=current_user.organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Фильтруем по способу оплаты если указан
        if payment_method:
            report["sales_details"] = [
                sale for sale in report["sales_details"]
                if sale["payment_method"] == payment_method
            ]
        
        return report
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации отчета: {str(e)}"
        )
    

@router.post("/{item_id}/sale-with-acquiring", response_model=InventoryMovementResponse)
async def process_sale_with_acquiring_details(
    item_id: uuid.UUID,
    sale_data: InventorySaleRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обработать продажу товара с детализацией эквайринга"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра отчета по эквайрингу"
        )
    
    try:
        movement = InventoryService.process_sale(
            db=db,
            sale_data=sale_data,
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )
        
        # Логируем с деталями эквайринга
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="inventory_sale_with_acquiring",
            organization_id=current_user.organization_id,
            resource_type="inventory_movement",
            resource_id=movement.id,
            details={
                "item_id": sale_data.inventory_id,
                "quantity": sale_data.quantity,
                "gross_amount": movement.total_selling_amount,
                "payment_method": sale_data.payment_method,
                "acquiring_commission": movement.acquiring_commission_amount,
                "net_amount": movement.net_selling_amount,
                "profit_after_commission": movement.profit_amount
            }
        )
        
        return movement
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )