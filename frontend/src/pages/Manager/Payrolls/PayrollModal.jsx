import { useState, useEffect } from 'react';
import { FiX, FiDollarSign } from 'react-icons/fi';

const PayrollModal = ({ payroll: selectedPayroll, employees, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    user_id: '',
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    base_salary: '',
    work_days: 22,
    bonuses: '',
    overtime_hours: '',
    overtime_pay: '',
    allowances: '',
    tax_amount: '',
    pension_deduction: '',
    other_deductions: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (selectedPayroll) {
      setFormData({
        user_id: selectedPayroll.user_id || '',
        period_year: selectedPayroll.period_year || new Date().getFullYear(),
        period_month: selectedPayroll.period_month || new Date().getMonth() + 1,
        base_salary: selectedPayroll.base_salary || '',
        work_days: selectedPayroll.work_days || 22,
        bonuses: selectedPayroll.bonuses || '',
        overtime_hours: selectedPayroll.overtime_hours || '',
        overtime_pay: selectedPayroll.overtime_pay || '',
        allowances: selectedPayroll.allowances || '',
        tax_amount: selectedPayroll.tax_amount || '',
        pension_deduction: selectedPayroll.pension_deduction || '',
        other_deductions: selectedPayroll.other_deductions || '',
        notes: selectedPayroll.notes || ''
      });
    }
  }, [selectedPayroll]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.user_id) {
      newErrors.user_id = 'Выберите сотрудника';
    }
    if (!formData.base_salary || parseFloat(formData.base_salary) <= 0) {
      newErrors.base_salary = 'Базовая зарплата должна быть больше 0';
    }
    if (formData.work_days < 0 || formData.work_days > 31) {
      newErrors.work_days = 'Количество рабочих дней должно быть от 0 до 31';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData = {
        ...formData,
        base_salary: parseFloat(formData.base_salary) || 0,
        work_days: parseInt(formData.work_days) || 0,
        bonuses: parseFloat(formData.bonuses) || 0,
        overtime_hours: parseFloat(formData.overtime_hours) || 0,
        overtime_pay: parseFloat(formData.overtime_pay) || 0,
        allowances: parseFloat(formData.allowances) || 0,
        tax_amount: parseFloat(formData.tax_amount) || 0,
        pension_deduction: parseFloat(formData.pension_deduction) || 0,
        other_deductions: parseFloat(formData.other_deductions) || 0
      };

      onSubmit(submitData);
    }
  };

  const getMonthName = (month) => {
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return monthNames[month - 1];
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content payroll-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiDollarSign /> {selectedPayroll ? 'Редактировать зарплату' : 'Добавить зарплату'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <form className="payroll-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Основная информация</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Сотрудник *</label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className={errors.user_id ? 'error' : ''}
                  disabled={!!selectedPayroll}
                >
                  <option value="">Выберите сотрудника</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} - {employee.role}
                    </option>
                  ))}
                </select>
                {errors.user_id && <span className="error-text">{errors.user_id}</span>}
              </div>

              <div className="form-field">
                <label>Год</label>
                <input
                  type="number"
                  min="2020"
                  max="2030"
                  value={formData.period_year}
                  onChange={(e) => setFormData({ ...formData, period_year: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-field">
                <label>Месяц</label>
                <select
                  value={formData.period_month}
                  onChange={(e) => setFormData({ ...formData, period_month: parseInt(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getMonthName(i + 1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Рабочих дней</label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={formData.work_days}
                  onChange={(e) => setFormData({ ...formData, work_days: e.target.value })}
                  className={errors.work_days ? 'error' : ''}
                />
                {errors.work_days && <span className="error-text">{errors.work_days}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Начисления</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Базовая зарплата *</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                  placeholder="150000"
                  className={errors.base_salary ? 'error' : ''}
                />
                {errors.base_salary && <span className="error-text">{errors.base_salary}</span>}
              </div>

              <div className="form-field">
                <label>Бонусы и премии</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.bonuses}
                  onChange={(e) => setFormData({ ...formData, bonuses: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="form-field">
                <label>Часы сверхурочных</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.overtime_hours}
                  onChange={(e) => setFormData({ ...formData, overtime_hours: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="form-field">
                <label>Оплата сверхурочных</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.overtime_pay}
                  onChange={(e) => setFormData({ ...formData, overtime_pay: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="form-field">
                <label>Надбавки и доплаты</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.allowances}
                  onChange={(e) => setFormData({ ...formData, allowances: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Удержания</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>ИПН (подоходный налог)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.tax_amount}
                  onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                  placeholder="Автоматически рассчитается"
                />
              </div>

              <div className="form-field">
                <label>Пенсионные взносы</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.pension_deduction}
                  onChange={(e) => setFormData({ ...formData, pension_deduction: e.target.value })}
                  placeholder="Автоматически рассчитается"
                />
              </div>

              <div className="form-field">
                <label>Прочие удержания</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.other_deductions}
                  onChange={(e) => setFormData({ ...formData, other_deductions: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-field">
              <label>Примечания</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Дополнительная информация..."
                rows="3"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              {selectedPayroll ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayrollModal;