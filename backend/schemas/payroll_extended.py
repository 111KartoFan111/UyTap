# schemas/payroll_extended.py
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
from models.payroll_template import PayrollTemplateStatus
from models.payroll_operation import PayrollOperationType
from models.extended_models import PayrollType

# ========== СХЕМЫ ДЛЯ ШАБЛОНОВ ==========

class PayrollTemplateCreate(BaseModel):
    user_id: str
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    payroll_type: PayrollType
    base_rate: float = Field(..., gt=0)
    
    # Автоматические надбавки
    automatic_allowances: Dict[str, float] = Field(default_factory=dict)
    
    # Настройки сверхурочных
    calculate_overtime: bool = False
    overtime_rate_multiplier: float = Field(1.5, gt=1.0, le=3.0)
    
    # Задачи
    include_task_payments: bool = True
    task_payment_rate: float = Field(0, ge=0)
    
    # Автоматические вычеты
    automatic_deductions: Dict[str, float] = Field(default_factory=dict)
    
    # Налоги
    tax_rate: float = Field(0.1, ge=0, le=0.5)
    social_rate: float = Field(0.1, ge=0, le=0.5)
    
    auto_apply_monthly: bool = True
    effective_from: datetime
    effective_until: Optional[datetime] = None
    
    @validator('automatic_allowances', 'automatic_deductions')
    def validate_amounts(cls, v):
        """Проверяем, что все суммы положительные"""
        for key, amount in v.items():
            if amount < 0:
                raise ValueError(f"Amount for {key} must be positive")
        return v
    
    @validator('effective_until')
    def validate_dates(cls, v, values):
        """Проверяем корректность дат"""
        if v and 'effective_from' in values:
            if v <= values['effective_from']:
                raise ValueError('effective_until must be after effective_from')
        return v


class PayrollTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    base_rate: Optional[float] = Field(None, gt=0)
    status: Optional[PayrollTemplateStatus] = None
    
    # Автоматические надбавки
    automatic_allowances: Optional[Dict[str, float]] = None
    
    # Настройки сверхурочных
    calculate_overtime: Optional[bool] = None
    overtime_rate_multiplier: Optional[float] = Field(None, gt=1.0, le=3.0)
    
    # Задачи
    include_task_payments: Optional[bool] = None
    task_payment_rate: Optional[float] = Field(None, ge=0)
    
    # Автоматические вычеты
    automatic_deductions: Optional[Dict[str, float]] = None
    
    # Налоги
    tax_rate: Optional[float] = Field(None, ge=0, le=0.5)
    social_rate: Optional[float] = Field(None, ge=0, le=0.5)
    
    auto_apply_monthly: Optional[bool] = None
    effective_until: Optional[datetime] = None


class PayrollTemplateResponse(PayrollTemplateCreate):
    id: str
    organization_id: str
    status: PayrollTemplateStatus
    created_at: datetime
    updated_at: datetime
    
    # Дополнительная информация
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    
    @validator('id', 'organization_id', 'user_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


# ========== СХЕМЫ ДЛЯ ОПЕРАЦИЙ ==========

class PayrollOperationCreate(BaseModel):
    user_id: str
    operation_type: PayrollOperationType
    amount: float = Field(..., ne=0)  # Не может быть 0
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    reason: Optional[str] = None
    
    apply_to_period_start: datetime
    apply_to_period_end: datetime
    
    is_recurring: bool = False
    recurrence_months: int = Field(1, ge=1, le=12)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    @validator('amount')
    def validate_amount_by_type(cls, v, values):
        """Автоматически корректируем знак суммы в зависимости от типа операции"""
        operation_type = values.get('operation_type')
        if operation_type in [PayrollOperationType.PENALTY, PayrollOperationType.DEDUCTION]:
            if v > 0:
                v = -v  # Автоматически делаем отрицательным для штрафов и вычетов
        elif operation_type in [
            PayrollOperationType.BONUS, 
            PayrollOperationType.ALLOWANCE, 
            PayrollOperationType.COMMISSION,
            PayrollOperationType.OVERTIME,
            PayrollOperationType.HOLIDAY_PAY
        ]:
            if v < 0:
                raise ValueError(f'{operation_type.value} amount must be positive')
        return v
    
    @validator('apply_to_period_end')
    def validate_period(cls, v, values):
        """Проверяем корректность периода"""
        if 'apply_to_period_start' in values and v <= values['apply_to_period_start']:
            raise ValueError('Period end must be after period start')
        return v


class PayrollOperationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    reason: Optional[str] = None
    amount: Optional[float] = Field(None, ne=0)
    is_recurring: Optional[bool] = None
    recurrence_months: Optional[int] = Field(None, ge=1, le=12)
    metadata: Optional[Dict[str, Any]] = None


class PayrollOperationResponse(PayrollOperationCreate):
    id: str
    organization_id: str
    payroll_id: Optional[str]
    created_by: str
    is_applied: bool
    applied_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Дополнительная информация
    creator_name: Optional[str] = None
    user_name: Optional[str] = None
    
    @validator('id', 'organization_id', 'user_id', 'payroll_id', 'created_by', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


# ========== БЫСТРЫЕ ОПЕРАЦИИ ==========

class QuickBonusRequest(BaseModel):
    amount: float = Field(..., gt=0)
    reason: str = Field(..., min_length=1)
    apply_to_current_month: bool = True


class QuickPenaltyRequest(BaseModel):
    amount: float = Field(..., gt=0)
    reason: str = Field(..., min_length=1)
    apply_to_current_month: bool = True


class QuickOvertimeRequest(BaseModel):
    hours: float = Field(..., gt=0, le=100)
    hourly_rate: Optional[float] = Field(None, gt=0)
    description: str = Field("Сверхурочная работа")


class QuickAllowanceRequest(BaseModel):
    amount: float = Field(..., gt=0)
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    is_recurring: bool = False


class QuickDeductionRequest(BaseModel):
    amount: float = Field(..., gt=0)
    title: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)


# ========== РАСШИРЕННЫЙ PAYROLL ==========

class PayrollExtendedResponse(BaseModel):
    """Расширенная схема зарплаты с операциями"""
    id: str
    organization_id: str
    user_id: str
    period_start: datetime
    period_end: datetime
    payroll_type: PayrollType
    
    # Базовые суммы
    base_rate: Optional[float]
    hours_worked: float
    tasks_completed: int
    tasks_payment: float
    
    # Дополнительные доходы
    bonus: float
    tips: float
    other_income: float
    
    # Вычеты
    deductions: float
    taxes: float
    
    # Итоговые суммы
    gross_amount: float
    net_amount: float
    
    # Статус
    is_paid: bool
    paid_at: Optional[datetime]
    payment_method: Optional[str]
    
    # Расширенные поля
    template_id: Optional[str]
    generated_from_template: bool
    operations_summary: Dict[str, Any]
    
    # Связанные данные
    user_name: Optional[str] = None
    template_name: Optional[str] = None
    operations_count: int = 0
    
    # Временные метки
    created_at: datetime
    updated_at: datetime
    
    @validator('id', 'organization_id', 'user_id', 'template_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


# ========== АНАЛИТИКА ==========

class PayrollSummaryByUser(BaseModel):
    user_id: str
    user_name: str
    role: str
    payrolls_count: int
    total_gross: float
    total_net: float
    average_net: float
    last_payment_date: Optional[datetime]
    has_active_template: bool
    pending_operations: int


class PayrollOrganizationSummary(BaseModel):
    organization_id: str
    period: Dict[str, Any]
    
    # Общая статистика
    total_employees: int
    employees_with_payroll: int
    total_gross_amount: float
    total_net_amount: float
    total_taxes: float
    
    # Статистика по типам
    by_payroll_type: Dict[str, Dict[str, Any]]
    by_role: Dict[str, Dict[str, Any]]
    
    # Статистика по операциям
    operations_summary: Dict[str, Any]
    
    # Детализация по сотрудникам
    employees_summary: List[PayrollSummaryByUser]


class PayrollForecastResponse(BaseModel):
    forecast_period_months: int
    total_active_employees: int
    monthly_forecasts: List[Dict[str, Any]]
    summary: Dict[str, float]


# ========== МАССОВЫЕ ОПЕРАЦИИ ==========

class BulkOperationCreate(BaseModel):
    """Массовое создание операций для группы сотрудников"""
    user_ids: List[str] = Field(..., min_items=1)
    operation_type: PayrollOperationType
    amount: float = Field(..., ne=0)
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    reason: Optional[str] = None
    apply_to_current_month: bool = True
    is_recurring: bool = False


class BulkOperationResponse(BaseModel):
    operations_created: int
    operations_failed: int
    created_operations: List[str]  # IDs созданных операций
    errors: List[Dict[str, str]]


# ========== ШАБЛОНЫ БЫСТРОГО СОЗДАНИЯ ==========

class PayrollTemplateQuickCreate(BaseModel):
    """Быстрое создание шаблона с предустановками по роли"""
    user_id: str
    template_name: Optional[str] = None
    use_role_defaults: bool = True
    base_rate: float = Field(..., gt=0)
    
    # Переопределения по умолчанию
    custom_allowances: Optional[Dict[str, float]] = None
    custom_tax_rate: Optional[float] = None
    include_overtime: bool = True


class PayrollTemplatePreset(BaseModel):
    """Предустановка шаблона для роли"""
    role: str
    default_base_rate: float
    default_allowances: Dict[str, float]
    default_tax_rate: float
    default_social_rate: float
    include_task_payments: bool
    overtime_enabled: bool


# ========== ОТЧЕТЫ ==========

class PayrollDetailedReport(BaseModel):
    """Детальный отчет по зарплатам"""
    report_period: Dict[str, datetime]
    organization_summary: PayrollOrganizationSummary
    
    # Детализация
    payrolls: List[PayrollExtendedResponse]
    operations: List[PayrollOperationResponse]
    templates: List[PayrollTemplateResponse]
    
    # Аналитика
    trends: Dict[str, Any]
    recommendations: List[str]


class PayrollComparisonReport(BaseModel):
    """Сравнительный отчет по периодам"""
    current_period: Dict[str, Any]
    previous_period: Dict[str, Any]
    comparison: Dict[str, Any]
    growth_rates: Dict[str, float]


# ========== НАСТРОЙКИ ==========

class PayrollSettings(BaseModel):
    """Настройки зарплатной системы организации"""
    auto_generate_monthly: bool = True
    auto_apply_operations: bool = True
    default_tax_rate: float = Field(0.1, ge=0, le=0.5)
    default_social_rate: float = Field(0.1, ge=0, le=0.5)
    overtime_multiplier: float = Field(1.5, gt=1.0, le=3.0)
    
    # Уведомления
    notify_on_payroll_ready: bool = True
    notify_on_operations: bool = True
    
    # Интеграции
    accounting_system_integration: bool = False
    bank_integration: bool = False


class PayrollSettingsUpdate(BaseModel):
    auto_generate_monthly: Optional[bool] = None
    auto_apply_operations: Optional[bool] = None
    default_tax_rate: Optional[float] = Field(None, ge=0, le=0.5)
    default_social_rate: Optional[float] = Field(None, ge=0, le=0.5)
    overtime_multiplier: Optional[float] = Field(None, gt=1.0, le=3.0)
    notify_on_payroll_ready: Optional[bool] = None
    notify_on_operations: Optional[bool] = None