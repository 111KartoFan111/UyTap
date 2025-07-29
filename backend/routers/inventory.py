# backend/routers/inventory.py
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
    InventoryMovementCreate, InventoryMovementResponse
)
from models.models import User, UserRole
from services.auth_service import AuthService
from utils.dependencies import get_current_active_user
from services.order_service import OrderService
from typing import Dict, Any


router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


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
    
    return items  # ✅ возвращаем список, как и ожидается

@router.post("/{item_id}/movement", response_model=InventoryMovementResponse)
async def create_inventory_movement(
    item_id: uuid.UUID,
    movement_data: InventoryMovementCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать движение товара (поступление/расход)"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.TECHNICAL_STAFF, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create inventory movements"
        )
    
    # Проверяем существование товара
    item = db.query(Inventory).filter(
        and_(
            Inventory.id == item_id,
            Inventory.organization_id == current_user.organization_id
        )
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    # Проверяем достаточность остатков для расхода
    if movement_data.movement_type == "out" and item.current_stock < movement_data.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock for this operation"
        )
    
    # Рассчитываем новый остаток
    if movement_data.movement_type == "in":
        new_stock = item.current_stock + movement_data.quantity
    elif movement_data.movement_type == "out":
        new_stock = item.current_stock - movement_data.quantity
    elif movement_data.movement_type == "adjustment":
        new_stock = movement_data.quantity
    elif movement_data.movement_type == "writeoff":
        new_stock = item.current_stock - movement_data.quantity
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid movement type"
        )
    
    # Рассчитываем общую стоимость
    unit_cost = movement_data.unit_cost or item.cost_per_unit or 0
    total_cost = movement_data.quantity * unit_cost
    
    # Создаем движение
    movement = InventoryMovement(
        id=uuid.uuid4(),
        organization_id=current_user.organization_id,
        inventory_id=item.id,
        user_id=current_user.id,
        task_id=uuid.UUID(movement_data.task_id) if movement_data.task_id else None,
        movement_type=movement_data.movement_type,
        quantity=movement_data.quantity,
        unit_cost=unit_cost,
        total_cost=total_cost,
        reason=movement_data.reason,
        notes=movement_data.notes,
        stock_after=new_stock
    )
    
    db.add(movement)
    
    # Обновляем остаток товара
    item.current_stock = new_stock
    item.total_value = new_stock * (item.cost_per_unit or 0)
    item.updated_at = datetime.now(timezone.utc)
    
    if movement_data.movement_type == "in":
        item.last_restock_date = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(movement)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="inventory_movement_created",
        organization_id=current_user.organization_id,
        resource_type="inventory_movement",
        resource_id=movement.id,
        details={
            "item_name": item.name,
            "movement_type": movement_data.movement_type,
            "quantity": movement_data.quantity,
            "stock_after": new_stock
        }
    )
    
    return movement


@router.get("/{item_id}/movements", response_model=List[InventoryMovementResponse])
async def get_inventory_movements(
    item_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    movement_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить движения товара"""
    
    # Проверяем существование товара
    item = db.query(Inventory).filter(
        and_(
            Inventory.id == item_id,
            Inventory.organization_id == current_user.organization_id
        )
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    query = db.query(InventoryMovement).filter(InventoryMovement.inventory_id == item_id)
    
    if movement_type:
        query = query.filter(InventoryMovement.movement_type == movement_type)
    
    movements = query.order_by(desc(InventoryMovement.created_at)).offset(skip).limit(limit).all()
    
    return movements


@router.get("/low-stock/alert")
async def get_low_stock_items(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить товары с низким остатком"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view low stock alerts"
        )
    
    low_stock_items = db.query(Inventory).filter(
        and_(
            Inventory.organization_id == current_user.organization_id,
            Inventory.current_stock <= Inventory.min_stock,
            Inventory.is_active == True
        )
    ).all()
    
    return {
        "total_items": len(low_stock_items),
        "items": [
            {
                "id": str(item.id),
                "name": item.name,
                "sku": item.sku,
                "current_stock": item.current_stock,
                "min_stock": item.min_stock,
                "unit": item.unit,
                "shortage": item.min_stock - item.current_stock
            }
            for item in low_stock_items
        ]
    }

@router.post("/bulk", response_model=List[InventoryResponse])
async def create_inventory_items_bulk(
    items_data: List[InventoryCreate],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Массовое создание товаров инвентаря"""

    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания товаров"
        )

    created_items = []

    for item_data in items_data:
        # Проверка уникальности SKU
        if item_data.sku:
            existing_item = db.query(Inventory).filter(
                Inventory.organization_id == current_user.organization_id,
                Inventory.sku == item_data.sku
            ).first()

            if existing_item:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Товар с SKU '{item_data.sku}' уже существует"
                )

        total_value = item_data.current_stock * (item_data.cost_per_unit or 0)

        # Создаем товар
        item = Inventory(
            id=uuid.uuid4(),
            organization_id=current_user.organization_id,
            **item_data.dict(),
            total_value=total_value,
            last_restock_date=datetime.now(timezone.utc) if item_data.current_stock > 0 else None
        )

        db.add(item)
        db.flush()  # Для получения ID до коммита

        # Движение, если есть остаток
        if item_data.current_stock > 0:
            movement = InventoryMovement(
                id=uuid.uuid4(),
                organization_id=current_user.organization_id,
                inventory_id=item.id,
                user_id=current_user.id,
                movement_type="in",
                quantity=item_data.current_stock,
                unit_cost=item_data.cost_per_unit,
                total_cost=total_value,
                reason="initial_stock",
                notes="Начальный остаток",
                stock_after=item_data.current_stock
            )
            db.add(movement)

        # Логируем создание
        AuthService.log_user_action(
            db=db,
            user_id=current_user.id,
            action="inventory_item_created_bulk",
            organization_id=current_user.organization_id,
            resource_type="inventory",
            resource_id=item.id,
            details={
                "item_name": item.name,
                "sku": item.sku,
                "initial_stock": item_data.current_stock
            }
        )

        created_items.append(item)

    db.commit()

    # Обновляем объекты
    for item in created_items:
        db.refresh(item)

    return created_items

@router.get("/statistics/overview")
async def get_inventory_statistics(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по инвентарю"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view inventory statistics"
        )
    
    # Общая статистика
    total_items = db.query(Inventory).filter(
        Inventory.organization_id == current_user.organization_id
    ).count()
    
    active_items = db.query(Inventory).filter(
        and_(
            Inventory.organization_id == current_user.organization_id,
            Inventory.is_active == True
        )
    ).count()
    
    low_stock_items = db.query(Inventory).filter(
        and_(
            Inventory.organization_id == current_user.organization_id,
            Inventory.current_stock <= Inventory.min_stock,
            Inventory.is_active == True
        )
    ).count()
    
    out_of_stock_items = db.query(Inventory).filter(
        and_(
            Inventory.organization_id == current_user.organization_id,
            Inventory.current_stock == 0,
            Inventory.is_active == True
        )
    ).count()
    
    # Общая стоимость инвентаря
    total_value = db.query(func.sum(Inventory.total_value)).filter(
        Inventory.organization_id == current_user.organization_id
    ).scalar() or 0
    
    # Статистика по категориям
    category_stats = db.query(
        Inventory.category,
        func.count(Inventory.id).label('count'),
        func.sum(Inventory.total_value).label('total_value')
    ).filter(
        Inventory.organization_id == current_user.organization_id
    ).group_by(Inventory.category).all()
    
    # Движения за последний месяц
    last_month = datetime.now(timezone.utc) - timedelta(days=30)
    recent_movements = db.query(InventoryMovement).filter(
        and_(
            InventoryMovement.organization_id == current_user.organization_id,
            InventoryMovement.created_at >= last_month
        )
    ).count()
    
    return {
        "summary": {
            "total_items": total_items,
            "active_items": active_items,
            "low_stock_items": low_stock_items,
            "out_of_stock_items": out_of_stock_items,
            "total_inventory_value": total_value
        },
        "by_category": {
            (cat.category or "Без категории"): {
                "count": cat.count,
                "total_value": float(cat.total_value or 0)
            }
            for cat in category_stats
        },
        "activity": {
            "movements_last_30_days": recent_movements
        },
        "alerts": {
            "low_stock_percentage": (low_stock_items / active_items * 100) if active_items > 0 else 0,
            "out_of_stock_percentage": (out_of_stock_items / active_items * 100) if active_items > 0 else 0
        }
    }


@router.post("/bulk-update-stock")
async def bulk_update_stock(
    updates: List[dict],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Массовое обновление остатков"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for bulk stock updates"
        )
    
    results = {
        "updated": [],
        "errors": []
    }
    
    for update in updates:
        try:
            item_id = uuid.UUID(update["item_id"])
            new_quantity = float(update["quantity"])
            reason = update.get("reason", "bulk_update")
            
            # Находим товар
            item = db.query(Inventory).filter(
                and_(
                    Inventory.id == item_id,
                    Inventory.organization_id == current_user.organization_id
                )
            ).first()
            
            if not item:
                results["errors"].append({
                    "item_id": str(item_id),
                    "error": "Item not found"
                })
                continue
            
            # Создаем движение корректировки
            movement = InventoryMovement(
                id=uuid.uuid4(),
                organization_id=current_user.organization_id,
                inventory_id=item.id,
                user_id=current_user.id,
                movement_type="adjustment",
                quantity=new_quantity,
                unit_cost=item.cost_per_unit,
                total_cost=new_quantity * (item.cost_per_unit or 0),
                reason=reason,
                notes=f"Массовая корректировка остатков. Было: {item.current_stock}",
                stock_after=new_quantity
            )
            
            db.add(movement)
            
            # Обновляем остаток
            item.current_stock = new_quantity
            item.total_value = new_quantity * (item.cost_per_unit or 0)
            item.updated_at = datetime.now(timezone.utc)
            
            results["updated"].append({
                "item_id": str(item_id),
                "item_name": item.name,
                "old_stock": item.current_stock,
                "new_stock": new_quantity
            })
            
        except Exception as e:
            results["errors"].append({
                "item_id": update.get("item_id", "unknown"),
                "error": str(e)
            })
    
    if results["updated"]:
        db.commit()
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="inventory_bulk_updated",
        organization_id=current_user.organization_id,
        details={
            "total_updates": len(updates),
            "successful_updates": len(results["updated"]),
            "errors": len(results["errors"])
        }
    )
    
    return results


@router.get("/export/{format}")
async def export_inventory_data(
    format: str,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Экспорт данных инвентаря"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export inventory data"
        )
    
    if format not in ["xlsx", "csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported formats: xlsx, csv"
        )
    
    # Получаем данные
    query = db.query(Inventory).filter(Inventory.organization_id == current_user.organization_id)
    
    if category:
        query = query.filter(Inventory.category == category)
        filename = f"inventory_{category}.{format}"
    else:
        filename = f"inventory_full.{format}"
    
    items = query.order_by(Inventory.name).all()
    
    if format == "xlsx":
        import xlsxwriter
        import io
        
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet("Инвентарь")
        
        # Заголовки
        headers = [
            'Название', 'Описание', 'Категория', 'SKU', 'Единица измерения',
            'Текущий остаток', 'Мин. остаток', 'Макс. остаток', 'Цена за единицу',
            'Общая стоимость', 'Поставщик', 'Активен', 'Создан', 'Обновлен'
        ]
        
        for col, header in enumerate(headers):
            worksheet.write(0, col, header)
        
        # Данные
        for row, item in enumerate(items, 1):
            worksheet.write(row, 0, item.name)
            worksheet.write(row, 1, item.description or "")
            worksheet.write(row, 2, item.category or "")
            worksheet.write(row, 3, item.sku or "")
            worksheet.write(row, 4, item.unit)
            worksheet.write(row, 5, item.current_stock)
            worksheet.write(row, 6, item.min_stock)
            worksheet.write(row, 7, item.max_stock or "")
            worksheet.write(row, 8, item.cost_per_unit or 0)
            worksheet.write(row, 9, item.total_value)
            worksheet.write(row, 10, item.supplier or "")
            worksheet.write(row, 11, "Да" if item.is_active else "Нет")
            worksheet.write(row, 12, item.created_at.strftime('%d.%m.%Y'))
            worksheet.write(row, 13, item.updated_at.strftime('%d.%m.%Y'))
        
        workbook.close()
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    elif format == "csv":
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Заголовки
        writer.writerow([
            'Название', 'Описание', 'Категория', 'SKU', 'Единица измерения',
            'Текущий остаток', 'Мин. остаток', 'Макс. остаток', 'Цена за единицу',
            'Общая стоимость', 'Поставщик', 'Активен', 'Создан', 'Обновлен'
        ])
        
        # Данные
        for item in items:
            writer.writerow([
                item.name,
                item.description or "",
                item.category or "",
                item.sku or "",
                item.unit,
                item.current_stock,
                item.min_stock,
                item.max_stock or "",
                item.cost_per_unit or 0,
                item.total_value,
                item.supplier or "",
                "Да" if item.is_active else "Нет",
                item.created_at.strftime('%d.%m.%Y'),
                item.updated_at.strftime('%d.%m.%Y')
            ])
        
        output.seek(0)
        content = output.getvalue().encode('utf-8-sig')
        
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


@router.post("", response_model=InventoryResponse)
async def create_inventory_item(
    item_data: InventoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать новый товар инвентаря"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create inventory items"
        )
    
    # Проверяем уникальность SKU
    if item_data.sku:
        existing_item = db.query(Inventory).filter(
            and_(
                Inventory.organization_id == current_user.organization_id,
                Inventory.sku == item_data.sku
            )
        ).first()
        
        if existing_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with SKU '{item_data.sku}' already exists"
            )
    
    # Рассчитываем общую стоимость
    total_value = item_data.current_stock * (item_data.cost_per_unit or 0)
    
    # Создаем товар
    item = Inventory(
        id=uuid.uuid4(),
        organization_id=current_user.organization_id,
        **item_data.dict(),
        total_value=total_value,
        last_restock_date=datetime.now(timezone.utc) if item_data.current_stock > 0 else None
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Создаем начальное движение если есть остаток
    if item_data.current_stock > 0:
        movement = InventoryMovement(
            id=uuid.uuid4(),
            organization_id=current_user.organization_id,
            inventory_id=item.id,
            user_id=current_user.id,
            movement_type="in",
            quantity=item_data.current_stock,
            unit_cost=item_data.cost_per_unit,
            total_cost=total_value,
            reason="initial_stock",
            notes="Начальный остаток",
            stock_after=item_data.current_stock
        )
        
        db.add(movement)
        db.commit()
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="inventory_item_created",
        organization_id=current_user.organization_id,
        resource_type="inventory",
        resource_id=item.id,
        details={
            "item_name": item.name,
            "sku": item.sku,
            "initial_stock": item_data.current_stock
        }
    )
    
    return item


@router.get("/{item_id}", response_model=InventoryResponse)
async def get_inventory_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить товар инвентаря"""
    
    item = db.query(Inventory).filter(
        and_(
            Inventory.id == item_id,
            Inventory.organization_id == current_user.organization_id
        )
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    return item


@router.put("/{item_id}", response_model=InventoryResponse)
async def update_inventory_item(
    item_id: uuid.UUID,
    item_data: InventoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить товар инвентаря"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update inventory items"
        )
    
    item = db.query(Inventory).filter(
        and_(
            Inventory.id == item_id,
            Inventory.organization_id == current_user.organization_id
        )
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    # Проверяем уникальность SKU при изменении
    if item_data.sku and item_data.sku != item.sku:
        existing_item = db.query(Inventory).filter(
            and_(
                Inventory.organization_id == current_user.organization_id,
                Inventory.sku == item_data.sku,
                Inventory.id != item_id
            )
        ).first()
        
        if existing_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with SKU '{item_data.sku}' already exists"
            )
    
    # Обновляем товар
    update_data = item_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    
    # Пересчитываем общую стоимость
    item.total_value = item.current_stock * (item.cost_per_unit or 0)
    item.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(item)
    
    # Логируем действие
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="inventory_item_updated",
        organization_id=current_user.organization_id,
        resource_type="inventory",
        resource_id=item.id,
        details={"updated_fields": list(update_data.keys())}
    )
    
    return item


@router.delete("/{item_id}")
async def delete_inventory_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить товар инвентаря"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete inventory items"
        )
    
    item = db.query(Inventory).filter(
        and_(
            Inventory.id == item_id,
            Inventory.organization_id == current_user.organization_id
        )
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    if item.current_stock > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete item with positive stock. Write off stock first."
        )
    
    # Логируем действие перед удалением
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="inventory_item_deleted",
        organization_id=current_user.organization_id,
        resource_type="inventory",
        resource_id=item.id,
        details={
            "item_name": item.name,
            "sku": item.sku
        }
    )
    
    db.delete(item)
    db.commit()
    
    return

@router.get("/available-for-orders", response_model=List[Dict[str, Any]])
async def get_available_inventory_for_orders(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get inventory items available for room orders"""
    
    items = OrderService.get_available_inventory_for_orders(
        db=db,
        organization_id=current_user.organization_id,
        category=category
    )
    
    return items

@router.get("/orders-impact-report")
async def get_inventory_orders_impact_report(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get report on inventory usage through orders"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.STOREKEEPER, UserRole.MANAGER, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view inventory reports"
        )
    
    report = OrderService.get_inventory_impact_report(
        db=db,
        organization_id=current_user.organization_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return report