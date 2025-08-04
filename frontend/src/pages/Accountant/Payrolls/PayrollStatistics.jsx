import React from 'react';
import { 
  FiBarChart2, 
  FiUser, 
  FiClock, 
  FiCheck, 
  FiDollarSign, 
  FiTrendingUp, 
  FiTarget 
} from 'react-icons/fi';

const PayrollStatistics = ({ stats, currentPeriod }) => {
  const formatCurrency = (amount) => `₸ ${(amount || 0).toLocaleString()}`;
  
  const completionRate = stats.totalPayrolls > 0 
    ? Math.round((stats.paidPayrolls / stats.totalPayrolls) * 100) 
    : 0;

  const getMonthName = (month) => {
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return monthNames[month - 1];
  };
  
  return (
    <div className="payroll-statistics">
      <div className="stats-header">
        <h3>
          <FiBarChart2 /> Статистика за {getMonthName(currentPeriod.month)} {currentPeriod.year}
        </h3>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <FiUser />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalPayrolls}</div>
            <div className="stat-label">Всего зарплат</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <FiClock />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.pendingPayrolls}</div>
            <div className="stat-label">Ожидают выплаты</div>
            <div className="stat-sublabel">
              {stats.totalPayrolls > 0 
                ? `${Math.round((stats.pendingPayrolls / stats.totalPayrolls) * 100)}% от общего числа`
                : 'Нет данных'
              }
            </div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <FiCheck />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.paidPayrolls}</div>
            <div className="stat-label">Выплачено</div>
            <div className="stat-sublabel">
              {formatCurrency(stats.totalAmount - (stats.pendingPayrolls * stats.avgSalary))}
            </div>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">
            <FiDollarSign />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.totalAmount)}</div>
            <div className="stat-label">Общая сумма</div>
            <div className="stat-sublabel">
              Фонд оплаты труда
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiTrendingUp />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.avgSalary)}</div>
            <div className="stat-label">Средняя зарплата</div>
            <div className="stat-sublabel">
              На одного сотрудника
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiTarget />
          </div>
          <div className="stat-content">
            <div className="stat-value">{completionRate}%</div>
            <div className="stat-label">Процент выплат</div>
            <div className="stat-sublabel">
              {completionRate === 100 
                ? 'Все выплачено' 
                : `Осталось ${stats.pendingPayrolls} выплат`
              }
            </div>
          </div>
        </div>
      </div>

      {/* Дополнительные метрики */}
      <div className="additional-metrics">
        <div className="metrics-row">
          <div className="metric-item">
            <span className="metric-label">Налогов удержано:</span>
            <span className="metric-value">
              {formatCurrency(stats.totalAmount * 0.2)} {/* примерный расчет */}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">К доплате:</span>
            <span className="metric-value pending">
              {formatCurrency(stats.pendingPayrolls * stats.avgSalary)}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Экономия ФОТ:</span>
            <span className="metric-value">
              {stats.monthlyTotal > stats.totalAmount 
                ? `+${formatCurrency(stats.monthlyTotal - stats.totalAmount)}`
                : '—'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollStatistics;