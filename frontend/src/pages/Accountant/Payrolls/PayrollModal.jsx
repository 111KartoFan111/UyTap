import React, { useState, useEffect } from 'react';
import { FiX, FiDollarSign } from 'react-icons/fi';

const PayrollModal = ({ payroll: selectedPayroll, employees, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    user_id: '',
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    payroll_type: 'monthly_salary',
    base_rate: '', // ИСПРАВЛЕНО: используем base_rate
    hours_worked: 0,
    tasks_completed: 0,
    tasks_payment: 0,
    bonus: 0,
    tips: 0,
    other_income: 0,
    deductions: 0,
    taxes: 0,
    notes: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (selectedPayroll) {
      // ИСПРАВЛЕНО: Правильная структура данных из API
      const period = selectedPayroll.period_start 
        ? new Date(selectedPayroll.period_start)
        : new Date();

      setFormData({
        user_id: selectedPayroll.user_id || '',
        period_year: period.getFullYear(),
        period_month: period.getMonth() + 1,
        payroll_type: selectedPayroll.payroll_type || 'monthly_salary',
        base_rate: selectedPayroll.base_rate || '', // ИСПРАВЛЕНО
        hours_worked: selectedPayroll.hours_worked || 0,
        tasks_completed: selectedPayroll.tasks_completed || 0,
        tasks_payment: selectedPayroll.tasks_payment || 0,
        bonus: selectedPayroll.bonus || 0,
        tips: selectedPayroll.tips || 0,
        other_income: selectedPayroll.other_income || 0,
        deductions: selectedPayroll.deductions || 0,
        taxes: selectedPayroll.taxes || 0,
        notes: selectedPayroll.notes || ''
      });
    }
  }, [selectedPayroll]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.user_id) {
      newErrors.user_id = 'Выберите сотрудника';
    }
    if (!formData.base_rate || parseFloat(formData.base_rate) <= 0) {
      newErrors.base_rate = 'Базовая ставка должна быть больше 0';
    }
    if (!formData.payroll_type) {
      newErrors.payroll_type = 'Выберите тип зарплаты';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    
    if (!validateForm()) {
      return;
    }

    // ИСПРАВЛЕНО: Создаем правильную структуру данных для API
    const startOfMonth = new Date(formData.period_year, formData.period_month - 1, 1);
    const endOfMonth = new Date(formData.period_year, formData.period_month, 0, 23, 59, 59);

    const submitData = {
      user_id: formData.user_id,
      period_start: startOfMonth.toISOString(),
      period_end: endOfMonth.toISOString(),
      payroll_type: formData.payroll_type,
      base_rate: parseFloat(formData.base_rate) || 0, // ИСПРАВЛЕНО: используем base_rate
      hours_worked: parseFloat(formData.hours_worked) || 0,
      tasks_completed: parseInt(formData.tasks_completed) || 0,
      tasks_payment: parseFloat(formData.tasks_payment) || 0,
      bonus: parseFloat(formData.bonus) || 0,
      tips: parseFloat(formData.tips) || 0,
      other_income: parseFloat(formData.other_income) || 0,
      deductions: parseFloat(formData.deductions) || 0,
      taxes: parseFloat(formData.taxes) || 0,
      notes: formData.notes || null
    };

    console.log('Submitting payroll data:', submitData); // Для отладки

    onSubmit(submitData);
  };

  const getMonthName = (month) => {
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return monthNames[month - 1];
  };

  // ИСПРАВЛЕНО: используем правильные значения из API схемы
  const payrollTypes = [
    { value: 'monthly_salary', label: 'Ежемесячная зарплата' },
    { value: 'hourly', label: 'Почасовая' },
    { value: 'piece_work', label: 'Сдельная' }
  ];

  // Автоматический расчет итоговых сумм
  const calculateTotals = () => {
    const baseRate = parseFloat(formData.base_rate) || 0;
    const tasksPayment = parseFloat(formData.tasks_payment) || 0;
    const bonus = parseFloat(formData.bonus) || 0;
    const tips = parseFloat(formData.tips) || 0;
    const otherIncome = parseFloat(formData.other_income) || 0;
    const deductions = parseFloat(formData.deductions) || 0;
    const taxes = parseFloat(formData.taxes) || 0;

    const grossAmount = baseRate + tasksPayment + bonus + tips + otherIncome;
    const netAmount = grossAmount - deductions - taxes;

    return { grossAmount, netAmount };
  };

  const { grossAmount, netAmount } = calculateTotals();

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
        
        <div className="payroll-form">
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
                <label>Тип зарплаты *</label>
                <select
                  value={formData.payroll_type}
                  onChange={(e) => setFormData({ ...formData, payroll_type: e.target.value })}
                  className={errors.payroll_type ? 'error' : ''}
                >
                  {payrollTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.payroll_type && <span className="error-text">{errors.payroll_type}</span>}
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
            </div>
          </div>

          <div className="form-section">
            <h3>Начисления</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Базовая ставка *</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.base_rate}
                  onChange={(e) => setFormData({ ...formData, base_rate: e.target.value })}
                  placeholder="150000"
                  className={errors.base_rate ? 'error' : ''}
                />
                {errors.base_rate && <span className="error-text">{errors.base_rate}</span>}
              </div>

              <div className="form-field">
                <label>Часов отработано</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.hours_worked}
                  onChange={(e) => setFormData({ ...formData, hours_worked: e.target.value })}
                  placeholder="160"
                />
              </div>

              <div className="form-field">
                <label>Задач выполнено</label>
                <input
                  type="number"
                  min="0"
                  value={formData.tasks_completed}
                  onChange={(e) => setFormData({ ...formData, tasks_completed: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="form-field">
                <label>Оплата за задачи</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.tasks_payment}
                  onChange={(e) => setFormData({ ...formData, tasks_payment: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="form-field">
                <label>Премии и бонусы</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.bonus}
                  onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="form-field">
                <label>Чаевые</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.tips}
                  onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="form-field">
                <label>Прочий доход</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.other_income}
                  onChange={(e) => setFormData({ ...formData, other_income: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Удержания</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Налоги (ИПН + соц. взносы)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.taxes}
                  onChange={(e) => setFormData({ ...formData, taxes: e.target.value })}
                  placeholder="Автоматически рассчитается"
                />
              </div>

              <div className="form-field">
                <label>Прочие удержания</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.deductions}
                  onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Предварительный расчет */}
          <div className="form-section calculation-preview">
            <h3>Предварительный расчет</h3>
            <div className="calculation-grid">
              <div className="calc-row">
                <span>Всего начислено:</span>
                <span className="amount">₸ {grossAmount.toLocaleString()}</span>
              </div>
              <div className="calc-row">
                <span>Всего удержано:</span>
                <span className="amount negative">-₸ {(parseFloat(formData.deductions) + parseFloat(formData.taxes)).toLocaleString()}</span>
              </div>
              <div className="calc-row total">
                <span>К выплате:</span>
                <span className="amount final">₸ {Math.max(0, netAmount).toLocaleString()}</span>
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
            <button type="button" className="btn-primary" onClick={handleSubmit}>
              {selectedPayroll ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollModal;