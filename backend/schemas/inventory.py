# backend/schemas/inventory.py - ОБНОВЛЕННЫЕ СХЕМЫ

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class InventoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    unit: str = Field(..., max_length=50)
    min_stock: float = Field(0, ge=0)
    max_stock: Optional[float] = Field(None, ge=0)
    
    # ОБНОВЛЕНО: Новые поля для цен
    purchase_price: Optional[float] = Field(None, ge=0, description="Закупочная цена за единицу")
    selling_price: Optional[float] = Field(None, ge=0, description="Цена продажи за единицу")
    cost_per_unit: Optional[float] = Field(None, ge=0, description="Себестоимость (устарело)")
    
    supplier: Optional[str] = Field(None, max_length=255)
    supplier_contact: Optional[str] = Field(None, max_length=255)

    @validator('selling_price')
    def validate_selling_price(cls, v, values):
        """Проверяем, что цена продажи больше закупочной"""
        purchase_price = values.get('purchase_price')
        if v is not None and purchase_price is not None and v < purchase_price:
            raise ValueError('Цена продажи не может быть меньше закупочной цены')
        return v


class InventoryCreate(InventoryBase):
    current_stock: float = Field(0, ge=0)
    
    # Автоматически устанавливаем cost_per_unit = purchase_price для совместимости
    @validator('cost_per_unit', always=True)
    def set_cost_per_unit(cls, v, values):
        if v is None and values.get('purchase_price') is not None:
            return values['purchase_price']
        return v


class InventoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=50)
    min_stock: Optional[float] = Field(None, ge=0)
    max_stock: Optional[float] = Field(None, ge=0)
    
    # ОБНОВЛЕНО: Новые поля для обновления цен
    purchase_price: Optional[float] = Field(None, ge=0)
    selling_price: Optional[float] = Field(None, ge=0)
    cost_per_unit: Optional[float] = Field(None, ge=0)
    
    supplier: Optional[str] = Field(None, max_length=255)
    supplier_contact: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class InventoryResponse(InventoryBase):
    id: str
    organization_id: str
    current_stock: float
    total_purchase_value: float  # НОВОЕ ПОЛЕ
    
    # Вычисляемые поля
    profit_margin: Optional[float] = Field(None, description="Маржа прибыли в %")
    profit_per_unit: Optional[float] = Field(None, description="Прибыль с единицы")
    
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_restock_date: Optional[datetime]

    @validator('id', 'organization_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class InventoryMovementBase(BaseModel):
    inventory_id: str
    movement_type: str = Field(..., pattern="^(in|out|adjustment|writeoff|sale)$")
    quantity: float = Field(..., ne=0)
    
    # ОБНОВЛЕНО: Новые поля для движений
    unit_purchase_price: Optional[float] = Field(None, ge=0, description="Закупочная цена за единицу")
    unit_selling_price: Optional[float] = Field(None, ge=0, description="Цена продажи за единицу")
    unit_cost: Optional[float] = Field(None, ge=0, description="Себестоимость (для совместимости)")
    
    reason: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None


class InventoryMovementCreate(InventoryMovementBase):
    task_id: Optional[str] = None
    
    @validator('unit_selling_price')
    def validate_selling_price_for_sales(cls, v, values):
        """Для продаж цена продажи обязательна"""
        movement_type = values.get('movement_type')
        if movement_type == 'sale' and v is None:
            raise ValueError('Для продажи необходимо указать цену продажи')
        return v


class InventorySaleRequest(BaseModel):
    """Специальная схема для продажи товаров"""
    inventory_id: str
    quantity: float = Field(..., gt=0)
    selling_price: float = Field(..., gt=0, description="Цена продажи за единицу")
    customer_name: Optional[str] = None
    order_id: Optional[str] = None
    notes: Optional[str] = None


class InventoryMovementResponse(InventoryMovementBase):
    id: str
    organization_id: str
    user_id: Optional[str]
    task_id: Optional[str]
    
    # ОБНОВЛЕНО: Новые поля в ответе
    total_purchase_cost: Optional[float] = Field(None, description="Общая закупочная стоимость")
    total_selling_amount: Optional[float] = Field(None, description="Общая сумма продажи")
    profit_amount: Optional[float] = Field(None, description="Прибыль от операции")
    total_cost: Optional[float] = Field(None, description="Общая стоимость (совместимость)")
    
    stock_after: float
    created_at: datetime

    @validator('id', 'organization_id', 'inventory_id', 'user_id', 'task_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class InventoryProfitAnalysis(BaseModel):
    """Анализ прибыльности товара"""
    inventory_id: str
    item_name: str
    
    # Общие показатели
    current_stock: float
    total_purchase_value: float
    average_purchase_price: float
    current_selling_price: float
    
    # Продажи за период
    total_sold_quantity: float
    total_revenue: float
    total_cost_of_goods_sold: float
    total_profit: float
    profit_margin_percent: float
    
    # Оборачиваемость
    turnover_rate: Optional[float] = Field(None, description="Оборачиваемость товара")
    days_in_stock: Optional[float] = Field(None, description="Дней в запасе")


class InventoryValuationReport(BaseModel):
    """Отчет по оценке стоимости запасов"""
    report_date: datetime
    organization_id: str
    
    total_items: int
    total_stock_quantity: float
    total_purchase_value: float
    total_selling_value: float
    potential_profit: float
    
    by_category: Dict[str, Dict[str, float]]
    top_value_items: List[Dict[str, Any]]
    low_stock_items: List[Dict[str, Any]]