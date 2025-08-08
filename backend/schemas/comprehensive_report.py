# backend/schemas/comprehensive_report.py - ПОЛНАЯ ОБНОВЛЕННАЯ ВЕРСИЯ
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
    overtime_payments: float = Field(0.0, description="Сверхурочные выплаты")
    other_income: float
    gross_amount: float
    income_tax: float = Field(..., description="Подоходный налог (10%)")
    social_tax: float = Field(..., description="Социальный налог (9.5%)")
    other_deductions: float = Field(0.0, description="Прочие вычеты")
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
    selling_price: float = Field(0.0, description="Цена продажи")
    gross_profit: float = Field(0.0, description="Валовая прибыль")
    profit_margin: float = Field(0.0, description="Процент прибыли")
    net_profit: float

class PropertyRevenueDetail(BaseModel):
    property_id: str
    property_name: str
    property_number: str
    total_revenue: float
    cash_payments: float
    card_payments: float
    qr_payments: float = Field(0.0, description="QR-платежи")
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
    gross_profit: float = Field(0.0, description="Валовая прибыль (до налогов)")
    total_taxes: float = Field(0.0, description="Общая сумма налогов")
    net_profit: float = Field(..., description="Чистая прибыль (после всех расходов)")
    profit_margin: float = Field(0.0, description="Рентабельность в %")
    
    # Эквайринг статистика
    acquiring_statistics: Dict[str, Any]
    
    # Налоговая информация
    tax_breakdown: Dict[str, float] = Field(default_factory=dict, description="Разбивка по налогам")
    
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

# Схемы для валидации данных
class DataCompletenessValidation(BaseModel):
    """Валидация полноты данных"""
    period: Dict[str, Any]
    data_availability: Dict[str, Any]
    warnings: List[str]
    recommendations: List[str]
    overall_score: int = Field(..., ge=0, le=100)

# Схемы для бизнес-рекомендаций
class BusinessRecommendation(BaseModel):
    """Бизнес-рекомендация"""
    category: str = Field(..., description="Категория рекомендации")
    priority: str = Field(..., description="Приоритет: high, medium, low")
    title: str = Field(..., description="Заголовок рекомендации")
    description: str = Field(..., description="Описание рекомендации")
    potential_impact: str = Field(..., description="Потенциальное влияние")
    action_items: List[str] = Field(..., description="Конкретные шаги")

class BusinessInsights(BaseModel):
    """Бизнес-аналитика и инсайты"""
    profitability_analysis: Dict[str, Any]
    cost_optimization: Dict[str, Any]
    revenue_opportunities: Dict[str, Any]
    operational_efficiency: Dict[str, Any]
    recommendations: List[BusinessRecommendation]

# Схемы для сравнительного анализа
class PeriodComparison(BaseModel):
    """Сравнение с предыдущим периодом"""
    current_period: Dict[str, Any]
    previous_period: Dict[str, Any]
    comparison_metrics: Dict[str, Any]
    growth_rates: Dict[str, float]
    trend_analysis: Dict[str, str]

# Схемы для отраслевых показателей
class IndustryBenchmarks(BaseModel):
    """Отраслевые бенчмарки"""
    occupancy_rate_benchmark: float
    revenue_per_room_benchmark: float
    cost_per_room_benchmark: float
    profit_margin_benchmark: float
    comparison_results: Dict[str, str]

# Схемы для прогнозирования
class RevenueProjection(BaseModel):
    """Прогноз доходов"""
    next_month_projection: float
    next_quarter_projection: float
    confidence_level: float = Field(..., ge=0, le=1)
    factors_considered: List[str]
    assumptions: List[str]

# Схемы для детального анализа эффективности
class EfficiencyMetrics(BaseModel):
    """Метрики эффективности"""
    revenue_per_employee: float
    cost_per_employee: float
    profit_per_employee: float
    revenue_per_property: float
    cost_per_property: float
    profit_per_property: float
    operational_efficiency_score: float = Field(..., ge=0, le=100)

# Схемы для анализа клиентской базы
class CustomerAnalytics(BaseModel):
    """Аналитика клиентской базы"""
    total_customers: int
    new_customers: int
    repeat_customers: int
    customer_retention_rate: float
    average_customer_value: float
    customer_lifetime_value: float
    customer_satisfaction_score: Optional[float]

# Схемы для анализа рисков
class RiskAssessment(BaseModel):
    """Оценка рисков"""
    financial_risks: List[str]
    operational_risks: List[str]
    market_risks: List[str]
    mitigation_strategies: List[str]
    risk_score: int = Field(..., ge=0, le=100)

# Расширенная схема комплексного отчета с дополнительной аналитикой
class EnhancedComprehensiveReportResponse(ComprehensiveReportResponse):
    """Расширенный комплексный отчет с дополнительной аналитикой"""
    business_insights: Optional[BusinessInsights] = None
    period_comparison: Optional[PeriodComparison] = None
    industry_benchmarks: Optional[IndustryBenchmarks] = None
    revenue_projection: Optional[RevenueProjection] = None
    efficiency_metrics: Optional[EfficiencyMetrics] = None
    customer_analytics: Optional[CustomerAnalytics] = None
    risk_assessment: Optional[RiskAssessment] = None
    
    # Дополнительные метрики
    kpi_dashboard: Dict[str, Any] = Field(default_factory=dict)
    executive_summary: Dict[str, Any] = Field(default_factory=dict)
    action_plan: List[Dict[str, Any]] = Field(default_factory=list)

# Схемы для специализированных отчетов
class FinancialHealthReport(BaseModel):
    """Отчет о финансовом здоровье"""
    liquidity_ratios: Dict[str, float]
    profitability_ratios: Dict[str, float]
    efficiency_ratios: Dict[str, float]
    financial_health_score: int = Field(..., ge=0, le=100)
    recommendations: List[str]

class OperationalPerformanceReport(BaseModel):
    """Отчет об операционной эффективности"""
    occupancy_trends: Dict[str, Any]
    service_quality_metrics: Dict[str, Any]
    staff_productivity: Dict[str, Any]
    maintenance_efficiency: Dict[str, Any]
    operational_score: int = Field(..., ge=0, le=100)

# Схемы для экспорта в различные форматы
class ExportConfiguration(BaseModel):
    """Конфигурация экспорта"""
    format: ReportFormat
    include_charts: bool = True
    include_detailed_tables: bool = True
    include_executive_summary: bool = True
    include_recommendations: bool = True
    template_style: str = Field("corporate", description="Стиль шаблона")
    branding: Dict[str, Any] = Field(default_factory=dict)

# Схемы для автоматизированных уведомлений
class ReportAlert(BaseModel):
    """Алерт на основе отчета"""
    alert_type: str = Field(..., description="Тип алерта")
    severity: str = Field(..., description="Критичность: low, medium, high, critical")
    message: str = Field(..., description="Сообщение алерта")
    metric_value: float = Field(..., description="Значение метрики")
    threshold: float = Field(..., description="Пороговое значение")
    action_required: bool = Field(..., description="Требуется ли действие")

class AutomatedInsights(BaseModel):
    """Автоматизированные инсайты"""
    alerts: List[ReportAlert]
    achievements: List[str] = Field(..., description="Достижения")
    concerns: List[str] = Field(..., description="Проблемные области")
    opportunities: List[str] = Field(..., description="Возможности")

# Итоговая схема с полной функциональностью
class UltimateComprehensiveReport(BaseModel):
    """Максимально полный комплексный отчет"""
    # Базовые данные
    basic_report: ComprehensiveReportResponse
    
    # Расширенная аналитика
    enhanced_analytics: Optional[EnhancedComprehensiveReportResponse] = None
    
    # Специализированные отчеты
    financial_health: Optional[FinancialHealthReport] = None
    operational_performance: Optional[OperationalPerformanceReport] = None
    
    # Автоматизированные инсайты
    automated_insights: Optional[AutomatedInsights] = None
    
    # Метаданные отчета
    report_metadata: Dict[str, Any] = Field(default_factory=dict)
    generation_time_seconds: float = Field(..., description="Время генерации в секундах")
    data_freshness: Dict[str, datetime] = Field(default_factory=dict)
    
    # Конфигурация и настройки
    export_config: Optional[ExportConfiguration] = None