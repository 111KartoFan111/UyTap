import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator

class PropertyOccupancyReport(BaseModel):
    property_id: str
    property_name: str
    property_number: str
    total_days: int
    occupied_days: int
    occupancy_rate: float
    revenue: float


class EmployeePerformanceReport(BaseModel):
    user_id: str
    user_name: str
    role: str
    tasks_completed: int
    average_completion_time: Optional[float]
    quality_rating: Optional[float]
    earnings: float


class FinancialSummaryReport(BaseModel):
    period_start: datetime
    period_end: datetime
    total_revenue: float
    rental_revenue: float
    orders_revenue: float
    total_expenses: float
    staff_expenses: float
    material_expenses: float
    net_profit: float
    occupancy_rate: float
    properties_count: int
    active_rentals: int


class ClientAnalyticsReport(BaseModel):
    total_clients: int
    new_clients: int
    returning_clients: int
    average_stay_duration: float
    average_spending: float
    top_clients: List[Dict[str, Any]]
    client_sources: Dict[str, int]
    
    @validator("top_clients")
    def validate_top_clients(cls, v):
        for client in v:
            if not all(key in client for key in ["client_id", "client_name", "spending", "stay_duration"]):
                raise ValueError("Each top client must have client_id, client_name, spending, and stay_duration")
        return v

    class Config:
        from_attributes = True