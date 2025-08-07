# backend/schemas/comprehensive_report.py
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
    other_income: float
    gross_amount: float
    income_tax: float
    social_tax: float
    total_deductions: float
    net_amount: float
    is_paid: bool
    paid_date: Optional[datetime]

class InventoryMovementDetail(BaseModel):
    inventory_id: str
    item_name: str
    incoming_quantity: float
    outgoing_quantity: float
    current_stock: float
    incoming_cost: float
    outgoing_cost: float
    net_profit: float
    unit: str
    category: str

class PropertyRevenueDetail(BaseModel):
    property_id: str
    property_name: str
    property_number: str
    total_revenue: float
    cash_payments: float
    card_payments: float
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

class ComprehensiveReportRequest(BaseModel):
    start_date: datetime
    end_date: datetime
    format: ReportFormat = ReportFormat.XLSX
    utility_bills_amount: float = Field(0, ge=0, description="Сумма коммунальных услуг")
    additional_admin_expenses: List[AdministrativeExpense] = Field(default_factory=list)

class ComprehensiveReportResponse(BaseModel):
    organization_name: str
    report_period: Dict[str, datetime]
    
    # Детализация зарплат
    staff_payroll: List[StaffPayrollDetail]
    payroll_summary: Dict[str, float]
    
    # Товары и материалы
    inventory_movements: List[InventoryMovementDetail]
    inventory_summary: Dict[str, float]
    
    # Аренда помещений
    property_revenues: List[PropertyRevenueDetail]
    property_summary: Dict[str, float]
    
    # Административные расходы
    administrative_expenses: List[AdministrativeExpense]
    administrative_summary: Dict[str, float]
    
    # Итоговые показатели
    total_revenue: float
    total_expenses: float
    net_profit: float
    
    # Эквайринг статистика
    acquiring_statistics: Dict[str, Any]
    
    generated_at: datetime