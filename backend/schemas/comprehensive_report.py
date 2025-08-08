# backend/schemas/comprehensive_report.py - ОБНОВЛЕННАЯ ВЕРСИЯ
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class ReportFormat(str, Enum):
    XLSX = "xlsx"
    XML = "xml"

class StaffPayrollDetail(BaseModel):
    user_id: str
    name: str
    role: str
    base_salary: float
    task_payments: float
    bonuses: float
    overtime_payments: float
    other_income: float
    gross_amount: float
    income_tax: float = Field(..., description="Подоходный налог (10%)")
    social_tax: float = Field(..., description="Социальный налог (9.5%)")
    other_deductions: float
    total_deductions: float
    net_amount: float
    is_paid: bool
    paid_date: Optional[datetime]

class InventoryMovementDetail(BaseModel):
    inventory_id: str
    item_name: str
    category: str
    unit: str
    incoming_quantity: float
    outgoing_quantity: float
    current_stock: float
    incoming_cost: float
    outgoing_cost: float
    selling_price: float = Field(..., description="Цена продажи")
    gross_profit: float = Field(..., description="Валовая прибыль")
    profit_margin: float = Field(..., description="Процент прибыли")
    net_profit: float

class PropertyRevenueDetail(BaseModel):
    property_id: str
    property_name: str
    property_number: str
    total_revenue: float
    cash_payments: float
    card_payments: float
    qr_payments: float = Field(0, description="QR-платежи")
    acquiring_provider: str = Field("halyk", description="Провайдер эквайринга")
    acquiring_commission_rate: float
    acquiring_commission_amount: float
    net_revenue_after_commission: float
    occupancy_days: int
    total_available_days: int
    occupancy_rate: float

class AdministrativeExpense(BaseModel):
    category: str
    description: str
    amount: float
    expense_type: str = Field("operational", description="Тип расхода: operational, tax, commission")

class ComprehensiveReportRequest(BaseModel):
    start_date: datetime
    end_date: datetime
    format: ReportFormat = ReportFormat.XLSX
    utility_bills_amount: float = Field(0, ge=0, description="Сумма коммунальных услуг")
    additional_admin_expenses: List[AdministrativeExpense] = Field(default_factory=list)
    include_tax_calculations: bool = Field(True, description="Включить расчет налогов")
    include_acquiring_details: bool = Field(True, description="Включить детали эквайринга")

class ComprehensiveReportResponse(BaseModel):
    organization_name: str
    report_period: Dict[str, datetime]
    
    # Детализация зарплат с разделением налогов
    staff_payroll: List[StaffPayrollDetail]
    payroll_summary: Dict[str, float]
    
    # Товары и материалы с расчетом прибыли
    inventory_movements: List[InventoryMovementDetail]
    inventory_summary: Dict[str, float]
    
    # Аренда помещений с эквайрингом
    property_revenues: List[PropertyRevenueDetail]
    property_summary: Dict[str, float]
    
    # Административные расходы (включая налоги, комиссии, коммунальные)
    administrative_expenses: List[AdministrativeExpense]
    administrative_summary: Dict[str, float]
    
    # Итоговые показатели
    total_revenue: float
    total_expenses: float
    gross_profit: float = Field(..., description="Валовая прибыль (до налогов)")
    total_taxes: float = Field(..., description="Общая сумма налогов")
    net_profit: float = Field(..., description="Чистая прибыль (после всех расходов)")
    profit_margin: float = Field(..., description="Рентабельность в %")
    
    # Эквайринг статистика
    acquiring_statistics: Dict[str, Any]
    
    # Налоговая информация
    tax_breakdown: Dict[str, float] = Field(..., description="Разбивка по налогам")
    
    generated_at: datetime

# Дополнительные схемы для детализации
class TaxBreakdown(BaseModel):
    """Детализация налогов"""
    income_tax_employees: float = Field(..., description="Подоходный налог с сотрудников")
    social_tax_employees: float = Field(..., description="Социальный налог с сотрудников")
    corporate_income_tax: float = Field(..., description="Корпоративный подоходный налог")
    vat: float = Field(..., description="НДС")
    property_tax: float = Field(..., description="Налог на имущество")
    other_taxes: float = Field(..., description="Прочие налоги")

class AcquiringProviderStats(BaseModel):
    """Статистика по провайдеру эквайринга"""
    provider_name: str
    commission_rate: float
    total_processed: float
    commission_paid: float
    transactions_count: int

class DetailedAcquiringStats(BaseModel):
    """Детальная статистика эквайринга"""
    enabled: bool
    providers: List[AcquiringProviderStats]
    total_card_revenue: float
    total_commission_paid: float
    average_commission_rate: float
    card_payment_percentage: float
    savings_analysis: Dict[str, float] = Field(..., description="Анализ возможной экономии")

# Схемы для экспорта
class ExportOptions(BaseModel):
    """Опции экспорта"""
    include_charts: bool = Field(True, description="Включить диаграммы в Excel")
    detailed_breakdown: bool = Field(True, description="Подробная детализация")
    language: str = Field("ru", description="Язык отчета")
    currency_format: str = Field("KZT", description="Формат валюты")

# Схемы для предварительного просмотра
class ReportPreview(BaseModel):
    """Предварительный просмотр отчета"""
    organization_name: str
    period_summary: Dict[str, Any]
    key_metrics: Dict[str, float]
    data_quality_score: int = Field(..., ge=0, le=100)
    recommendations: List[str]