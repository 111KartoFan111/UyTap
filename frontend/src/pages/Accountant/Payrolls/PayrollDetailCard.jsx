import React from 'react';
import { 
  FiDollarSign, 
  FiX, 
  FiUser, 
  FiTrendingUp, 
  FiXCircle, 
  FiEdit2, 
  FiRefreshCw, 
  FiCheck, 
  FiDownload, 
  FiSend 
} from 'react-icons/fi';

const PayrollDetailCard = ({ 
  payroll, 
  employee, 
  onClose, 
  onEdit, 
  onMarkPaid, 
  onRecalculate 
}) => {
  const formatCurrency = (amount) => `₸ ${(amount || 0).toLocaleString()}`;
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('ru-RU') : 'Не указано';

  const calculations = {
    grossAmount: (payroll.base_salary || 0) + (payroll.bonuses || 0) + (payroll.allowances || 0) + (payroll.overtime_pay || 0),
    totalDeductions: (payroll.tax_amount || 0) + (payroll.pension_deduction || 0) + (payroll.other_deductions || 0),
    netAmount: 0
  };
  calculations.netAmount = calculations.grossAmount - calculations.totalDeductions;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content payroll-detail-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="payroll-header-info">
            <h2>
              <FiDollarSign /> Детали зарплаты
            </h2>
            <div className="payroll-period">
              {payroll.period_month}/{payroll.period_year}
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="payroll-detail-content">
          {/* Информация о сотруднике */}
          <div className="employee-section">
            <h3>Сотрудник</h3>
            <div className="employee-card">
              <div className="employee-avatar">
                <FiUser />
              </div>
              <div className="employee-info">
                <div className="employee-name">
                  {employee ? `${employee.first_name} ${employee.last_name}` : 'Не найден'}
                </div>
                <div className="employee-role">
                  {employee?.role} • {employee?.email}
                </div>
              </div>
            </div>
          </div>

          {/* Расчеты */}
          <div className="calculations-section">
            <div className="calculations-grid">
              {/* Начисления */}
              <div className="calculation-block income">
                <h4><FiTrendingUp /> Начисления</h4>
                <div className="calculation-items">
                  <div className="calc-item">
                    <span>Базовая зарплата</span>
                    <span className="amount">{formatCurrency(payroll.base_salary)}</span>
                  </div>
                  {payroll.bonuses > 0 && (
                    <div className="calc-item">
                      <span>Премии и бонусы</span>
                      <span className="amount positive">{formatCurrency(payroll.bonuses)}</span>
                    </div>
                  )}
                  {payroll.allowances > 0 && (
                    <div className="calc-item">
                      <span>Надбавки</span>
                      <span className="amount positive">{formatCurrency(payroll.allowances)}</span>
                    </div>
                  )}
                  {payroll.overtime_pay > 0 && (
                    <div className="calc-item">
                      <span>Сверхурочные</span>
                      <span className="amount positive">{formatCurrency(payroll.overtime_pay)}</span>
                    </div>
                  )}
                  <div className="calc-total">
                    <span>Итого начислено</span>
                    <span className="amount">{formatCurrency(calculations.grossAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Удержания */}
              <div className="calculation-block deductions">
                <h4><FiXCircle /> Удержания</h4>
                <div className="calculation-items">
                  {payroll.tax_amount > 0 && (
                    <div className="calc-item">
                      <span>ИПН (подоходный налог)</span>
                      <span className="amount negative">-{formatCurrency(payroll.tax_amount)}</span>
                    </div>
                  )}
                  {payroll.pension_deduction > 0 && (
                    <div className="calc-item">
                      <span>Пенсионные взносы</span>
                      <span className="amount negative">-{formatCurrency(payroll.pension_deduction)}</span>
                    </div>
                  )}
                  {payroll.other_deductions > 0 && (
                    <div className="calc-item">
                      <span>Прочие удержания</span>
                      <span className="amount negative">-{formatCurrency(payroll.other_deductions)}</span>
                    </div>
                  )}
                  <div className="calc-total">
                    <span>Итого удержано</span>
                    <span className="amount negative">-{formatCurrency(calculations.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Итоговая сумма */}
            <div className="final-amount-section">
              <div className="final-amount-card">
                <div className="final-amount-label">К выплате</div>
                <div className="final-amount-value">{formatCurrency(calculations.netAmount)}</div>
                <div className="payment-status">
                  <span className={`status-badge ${payroll.status === 'paid' ? 'paid' : 'pending'}`}>
                    {payroll.status === 'paid' ? 'Выплачено' : 'Ожидает выплаты'}
                  </span>
                  {payroll.paid_at && (
                    <div className="payment-date">
                      Выплачено: {formatDate(payroll.paid_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Дополнительная информация */}
          <div className="additional-info">
            <div className="info-grid">
              <div className="info-item">
                <label>Рабочих дней</label>
                <span>{payroll.work_days || 'Не указано'}</span>
              </div>
              <div className="info-item">
                <label>Создано</label>
                <span>{formatDate(payroll.created_at)}</span>
              </div>
              <div className="info-item">
                <label>Обновлено</label>
                <span>{formatDate(payroll.updated_at)}</span>
              </div>
              {payroll.notes && (
                <div className="info-item full-width">
                  <label>Примечания</label>
                  <span>{payroll.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Действия */}
          <div className="payroll-actions">
            {payroll.status === 'pending' && (
              <>
                <button className="btn-secondary" onClick={() => onEdit(payroll)}>
                  <FiEdit2 /> Редактировать
                </button>
                <button className="btn-secondary" onClick={() => onRecalculate(payroll.id)}>
                  <FiRefreshCw /> Пересчитать
                </button>
                <button className="btn-primary" onClick={() => onMarkPaid(payroll.id)}>
                  <FiCheck /> Отметить выплаченной
                </button>
              </>
            )}
            <button className="btn-outline">
              <FiDownload /> Скачать справку
            </button>
            <button className="btn-outline">
              <FiSend /> Отправить на email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollDetailCard;