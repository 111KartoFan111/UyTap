# routers/manager_payroll.py - Роуты для менеджеров

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
import uuid

from models.database import get_db
from models.extended_models import User, UserRole
from schemas.payroll_extended import *
from services.payroll_extended_service import PayrollExtendedService
from utils.dependencies import get_current_active_user

router = APIRouter(prefix="/api/payroll", tags=["Manager Payroll Operations"])

def require_manager_or_admin(current_user: User = Depends(get_current_active_user)):
    """Проверка прав менеджера или админа"""
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    return current_user

# ========== БЫСТРЫЕ ОПЕРАЦИИ ==========

@router.post("/users/{user_id}/bonus")
async def add_quick_bonus(
    user_id: str,
    bonus_request: QuickBonusRequest,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db)
):
    """Быстро добавить премию сотруднику"""
    
    # Проверяем, что пользователь принадлежит организации
    target_user = db.query(User).filter(
        and_(
            User.id == uuid.UUID(user_id),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    operation = PayrollExtendedService.create_quick_bonus(
        db=db,
        user_id=uuid.UUID(user_id),
        amount=bonus_request.amount,
        reason=bonus_request.reason,
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        apply_to_current_month=bonus_request.apply_to_current_month
    )
    
    # Логируем действие
    from services.auth_service import AuthService
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="bonus_added",
        organization_id=current_user.organization_id,
        resource_type="payroll_operation",
        resource_id=operation.id,
        details={
            "target_user": f"{target_user.first_name} {target_user.last_name}",
            "amount": bonus_request.amount,
            "reason": bonus_request.reason
        }
    )
    
    return {
        "message": f"Bonus of {bonus_request.amount} KZT added successfully",
        "operation_id": str(operation.id),
        "target_user": f"{target_user.first_name} {target_user.last_name}",
        "amount": bonus_request.amount,
        "will_apply_to": "current month" if bonus_request.apply_to_current_month else "immediately"
    }


@router.post("/users/{user_id}/penalty")
async def add_quick_penalty(
    user_id: str,
    penalty_request: QuickPenaltyRequest,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db)
):
    """Быстро добавить штраф сотруднику"""
    
    # Только админы могут накладывать штрафы
    if current_user.role not in [UserRole.ADMIN, UserRole.SYSTEM_OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can impose penalties"
        )
    
    target_user = db.query(User).filter(
        and_(
            User.id == uuid.UUID(user_id),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    operation = PayrollExtendedService.create_quick_penalty(
        db=db,
        user_id=uuid.UUID(user_id),
        amount=penalty_request.amount,
        reason=penalty_request.reason,
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        apply_to_current_month=penalty_request.apply_to_current_month
    )
    
    # Логируем действие
    from services.auth_service import AuthService
    AuthService.log_user_action(
        db=db,
        user_id=current_user.id,
        action="penalty_added",
        organization_id=current_user.organization_id,
        resource_type="payroll_operation",
        resource_id=operation.id,
        details={
            "target_user": f"{target_user.first_name} {target_user.last_name}",
            "amount": penalty_request.amount,
            "reason": penalty_request.reason
        }
    )
    
    return {
        "message": f"Penalty of {penalty_request.amount} KZT added successfully",
        "operation_id": str(operation.id),
        "target_user": f"{target_user.first_name} {target_user.last_name}",
        "amount": penalty_request.amount,
        "reason": penalty_request.reason
    }


@router.post("/users/{user_id}/overtime")
async def add_overtime_payment(
    user_id: str,
    overtime_request: QuickOvertimeRequest,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db)
):
    """Добавить оплату сверхурочных"""
    
    target_user = db.query(User).filter(
        and_(
            User.id == uuid.UUID(user_id),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        operation = PayrollExtendedService.create_overtime_payment(
            db=db,
            user_id=uuid.UUID(user_id),
            hours=overtime_request.hours,
            hourly_rate=overtime_request.hourly_rate,
            description=overtime_request.description,
            organization_id=current_user.organization_id,
            created_by=current_user.id
        )
        
        return {
            "message": f"Overtime payment for {overtime_request.hours} hours added successfully",
            "operation_id": str(operation.id),
            "target_user": f"{target_user.first_name} {target_user.last_name}",
            "hours": overtime_request.hours,
            "amount": operation.amount
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/users/{user_id}/allowance")
async def add_allowance(
    user_id: str,
    allowance_request: QuickAllowanceRequest,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db)
):
    """Добавить надбавку сотруднику"""
    
    target_user = db.query(User).filter(
        and_(
            User.id == uuid.UUID(user_id),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Определяем период
    now = datetime.now(timezone.utc)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        period_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    else:
        period_end = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(seconds=1)
    
    operation_data = PayrollOperationCreate(
        user_id=user_id,
        operation_type=PayrollOperationType.ALLOWANCE,
        amount=allowance_request.amount,
        title=allowance_request.title,
        description=allowance_request.description or f"Надбавка: {allowance_request.title}",
        apply_to_period_start=period_start,
        apply_to_period_end=period_end,
        is_recurring=allowance_request.is_recurring
    )
    
    operation = PayrollExtendedService.add_payroll_operation(
        db=db,
        operation_data=operation_data,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    
    return {
        "message": f"Allowance '{allowance_request.title}' of {allowance_request.amount} KZT added",
        "operation_id": str(operation.id),
        "target_user": f"{target_user.first_name} {target_user.last_name}",
        "is_recurring": allowance_request.is_recurring
    }


@router.post("/users/{user_id}/deduction")
async def add_deduction(
    user_id: str,
    deduction_request: QuickDeductionRequest,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db)
):
    """Добавить вычет сотруднику"""
    
    target_user = db.query(User).filter(
        and_(
            User.id == uuid.UUID(user_id),
            User.organization_id == current_user.organization_id
        )
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Определяем период
    now = datetime.now(timezone.utc)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        period_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    else:
        period_end = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(seconds=1)
    
    operation_data = PayrollOperationCreate(
        user_id=user_id,
        operation_type=PayrollOperationType.DEDUCTION,
        amount=-abs(deduction_request.amount),  # Вычеты отрицательные
        title=deduction_request.title,
        reason=deduction_request.reason,
        apply_to_period_start=period_start,
        apply_to_period_end=period_end
    )