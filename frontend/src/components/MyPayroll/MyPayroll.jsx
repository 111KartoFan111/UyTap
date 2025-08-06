// frontend/src/components/MyPayroll/MyPayroll.jsx - ИСПРАВЛЕННАЯ ВЕРСИЯ (без циклов)
import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';
import './MyPayroll.css'; // Добавим стили

const MyPayroll = () => {
  const { user } = useAuth(); // Изменено с currentUser на user
  const { reports, loading } = useData();

  const [payrollData, setPayrollData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');

  // Функция для получения периода
  const getPeriodDates = (period) => {
    const now = dayjs();
    
    switch (period) {
      case 'current_month':
        return {
          start: now.startOf('month'),
          end: now.endOf('month'),
          label: 'Текущий месяц'
        };
      case 'last_month':
        return {
          start: now.subtract(1, 'month').startOf('month'),
          end: now.subtract(1, 'month').endOf('month'),
          label: 'Прошлый месяц'
        };
      case 'last_3_months':
        return {
          start: now.subtract(3, 'months').startOf('month'),
          end: now.endOf('month'),
          label: 'Последние 3 месяца'
        };
      case 'current_year':
        return {
          start: now.startOf('year'),
          end: now.endOf('year'),
          label: 'Текущий год'
        };
      default:
        return {
          start: now.startOf('month'),
          end: now.endOf('month'),
          label: 'Текущий месяц'
        };
    }
  };

  const loadPayroll = useCallback(async (period = selectedPeriod) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { start, end } = getPeriodDates(period);
      
      console.log('🔍 Загружаем зарплату за период:', {
        start: start.format('YYYY-MM-DDTHH:mm:ss'),
        end: end.format('YYYY-MM-DDTHH:mm:ss')
      });

      const data = await reports.getMyPayroll(
        start.format('YYYY-MM-DDTHH:mm:ss'),
        end.format('YYYY-MM-DDTHH:mm:ss')
      );

      console.log('📊 Получены данные зарплаты:', data);
      
      // API теперь возвращает массив
      if (Array.isArray(data)) {
        setPayrollData(data);
      } else if (data) {
        // На случай если вернется один объект
        setPayrollData([data]);
      } else {
        setPayrollData([]);
      }
      
    } catch (error) {
      console.error('❌ Ошибка загрузки данных о зарплате:', error);
      setError(error.message || 'Не удалось загрузить данные о зарплате');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, reports.getMyPayroll]); // Добавляем useCallback для предотвращения пересоздания функции

  useEffect(() => {
    if (user) {
      loadPayroll();
    }
  }, [user]); // Убираем reports из зависимостей чтобы избежать бесконечного цикла

  const handlePeriodChange = useCallback((newPeriod) => {
    setSelectedPeriod(newPeriod);
    loadPayroll(newPeriod);
  }, [loadPayroll]);

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '0 ₸';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('KZT', '₸');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return dayjs(dateString).format('DD.MM.YYYY');
  };

  const calculateTotals = () => {
    if (!payrollData.length) return { totalGross: 0, totalNet: 0, totalTasks: 0 };
    
    return payrollData.reduce((acc, payroll) => ({
      totalGross: acc.totalGross + (payroll.gross_amount || 0),
      totalNet: acc.totalNet + (payroll.net_amount || 0),
      totalTasks: acc.totalTasks + (payroll.tasks_completed || 0)
    }), { totalGross: 0, totalNet: 0, totalTasks: 0 });
  };

  const getPayrollTypeLabel = (type) => {
    const types = {
      'monthly_salary': 'Месячный оклад',
      'hourly': 'Почасовая оплата',
      'piece_work': 'Сдельная работа'
    };
    return types[type] || type;
  };

  const getPaymentStatusLabel = (isPaid, paidAt) => {
    if (isPaid) {
      return (
        <span className="status-paid">
          Выплачено {paidAt ? formatDate(paidAt) : ''}
        </span>
      );
    }
    return <span className="status-pending">Ожидает выплаты</span>;
  };

  // Показываем загрузку
  if (isLoading || loading) {
    return (
      <div className="my-payroll-loading">
        <div className="loading-spinner"></div>
        <p>Загрузка данных о зарплате...</p>
      </div>
    );
  }

  // Показываем ошибку
  if (error) {
    return (
      <div className="my-payroll-error">
        <div className="error-message">
          <h3>Ошибка загрузки данных</h3>
          <p>{error}</p>
          <button onClick={() => loadPayroll()} className="retry-button">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const { totalGross, totalNet, totalTasks } = calculateTotals();
  const { label: periodLabel } = getPeriodDates(selectedPeriod);

  return (
    <div className="my-payroll-page">
      <div className="page-header">
        <h1>Моя зарплата</h1>
        <div className="user-info">
          <span className="user-name">
            {user?.first_name} {user?.last_name}
          </span>
          <span className="user-role">
            {user?.role === 'cleaner' && 'Уборщик'}
            {user?.role === 'technical_staff' && 'Технический персонал'}
            {user?.role === 'manager' && 'Менеджер'}
            {user?.role === 'accountant' && 'Бухгалтер'}
            {user?.role === 'admin' && 'Администратор'}
            {user?.role === 'storekeeper' && 'Кладовщик'}
          </span>
        </div>
      </div>

      {/* Селектор периода */}
      <div className="period-selector">
        <h3>Период: {periodLabel}</h3>
        <div className="period-buttons">
          <button 
            className={selectedPeriod === 'current_month' ? 'active' : ''}
            onClick={() => handlePeriodChange('current_month')}
          >
            Текущий месяц
          </button>
          <button 
            className={selectedPeriod === 'last_month' ? 'active' : ''}
            onClick={() => handlePeriodChange('last_month')}
          >
            Прошлый месяц
          </button>
          <button 
            className={selectedPeriod === 'last_3_months' ? 'active' : ''}
            onClick={() => handlePeriodChange('last_3_months')}
          >
            3 месяца
          </button>
          <button 
            className={selectedPeriod === 'current_year' ? 'active' : ''}
            onClick={() => handlePeriodChange('current_year')}
          >
            Год
          </button>
        </div>
      </div>

      {/* Общая сводка */}
      {payrollData.length > 0 && (
        <div className="payroll-summary">
          <h3>Сводка за период</h3>
          <div className="summary-cards">
            <div className="summary-card">
              <span className="card-label">Общее начисление</span>
              <span className="card-value">{formatCurrency(totalGross)}</span>
            </div>
            <div className="summary-card">
              <span className="card-label">К выплате</span>
              <span className="card-value highlight">{formatCurrency(totalNet)}</span>
            </div>
            <div className="summary-card">
              <span className="card-label">Задач выполнено</span>
              <span className="card-value">{totalTasks}</span>
            </div>
          </div>
        </div>
      )}

      {/* Список зарплат */}
      <div className="payroll-list">
        {payrollData.length === 0 ? (
          <div className="no-data">
            <div className="no-data-message">
              <h3>Нет данных за выбранный период</h3>
              <p>За период "{periodLabel}" зарплатных начислений не найдено.</p>
              <p>Попробуйте выбрать другой период или обратитесь к бухгалтеру.</p>
            </div>
          </div>
        ) : (
          payrollData.map((payroll, index) => (
            <div key={payroll.payroll_id || index} className="payroll-card">
              <div className="payroll-header">
                <div className="payroll-period">
                  <h4>
                    {formatDate(payroll.period_start)} — {formatDate(payroll.period_end)}
                  </h4>
                  <span className="payroll-type">
                    {getPayrollTypeLabel(payroll.payroll_type)}
                  </span>
                </div>
                <div className="payroll-status">
                  {getPaymentStatusLabel(payroll.is_paid, payroll.paid_at)}
                </div>
              </div>

              <div className="payroll-amounts">
                <div className="amount-row">
                  <span className="amount-label">Базовая ставка:</span>
                  <span className="amount-value">{formatCurrency(payroll.base_rate)}</span>
                </div>
                
                {payroll.hours_worked > 0 && (
                  <div className="amount-row">
                    <span className="amount-label">Отработано часов:</span>
                    <span className="amount-value">{payroll.hours_worked}</span>
                  </div>
                )}

                {payroll.tasks_completed > 0 && (
                  <div className="amount-row">
                    <span className="amount-label">Выполнено задач:</span>
                    <span className="amount-value">{payroll.tasks_completed}</span>
                  </div>
                )}

                {payroll.tasks_payment > 0 && (
                  <div className="amount-row">
                    <span className="amount-label">Доплата за задачи:</span>
                    <span className="amount-value">{formatCurrency(payroll.tasks_payment)}</span>
                  </div>
                )}

                {payroll.bonus > 0 && (
                  <div className="amount-row bonus">
                    <span className="amount-label">Премия:</span>
                    <span className="amount-value">{formatCurrency(payroll.bonus)}</span>
                  </div>
                )}

                {payroll.tips > 0 && (
                  <div className="amount-row">
                    <span className="amount-label">Чаевые:</span>
                    <span className="amount-value">{formatCurrency(payroll.tips)}</span>
                  </div>
                )}

                {payroll.other_income > 0 && (
                  <div className="amount-row">
                    <span className="amount-label">Другие доходы:</span>
                    <span className="amount-value">{formatCurrency(payroll.other_income)}</span>
                  </div>
                )}

                {payroll.deductions > 0 && (
                  <div className="amount-row deduction">
                    <span className="amount-label">Удержания:</span>
                    <span className="amount-value">-{formatCurrency(payroll.deductions)}</span>
                  </div>
                )}

                {payroll.taxes > 0 && (
                  <div className="amount-row deduction">
                    <span className="amount-label">Налоги:</span>
                    <span className="amount-value">-{formatCurrency(payroll.taxes)}</span>
                  </div>
                )}

                <div className="amount-row total">
                  <span className="amount-label">Начислено:</span>
                  <span className="amount-value">{formatCurrency(payroll.gross_amount)}</span>
                </div>

                <div className="amount-row final">
                  <span className="amount-label">К выплате:</span>
                  <span className="amount-value">{formatCurrency(payroll.net_amount)}</span>
                </div>
              </div>

              {/* Детализация по задачам */}
              {payroll.breakdown && payroll.breakdown.length > 0 && (
                <details className="task-breakdown">
                  <summary>
                    Детализация по задачам ({payroll.breakdown.length})
                  </summary>
                  <div className="tasks-list">
                    {payroll.breakdown.map((task, taskIndex) => (
                      <div key={task.task_id || taskIndex} className="task-item">
                        <div className="task-info">
                          <span className="task-title">{task.title}</span>
                          <span className="task-type">{task.task_type}</span>
                        </div>
                        <div className="task-details">
                          <span className="task-date">
                            {formatDate(task.completed_at)}
                          </span>
                          <span className="task-payment">
                            {formatCurrency(task.payment_amount)}
                          </span>
                          {task.quality_rating && (
                            <span className="task-rating">
                              ⭐ {task.quality_rating}/5
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyPayroll;