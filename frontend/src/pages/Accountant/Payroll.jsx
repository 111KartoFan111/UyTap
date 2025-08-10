import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiPlus, 
  FiDownload,
  FiCalendar,
  FiAlertCircle,
  FiRefreshCw
} from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { PayrollModal, TemplateModal, OperationModal } from './Payrolls';
import PayrollExportButton from './Payrolls/PayrollExportButton';
// Импортируем существующие модальные окна

import './Payroll.css';

const Payroll = () => {
  const { payroll, organization, utils } = useData();
  const { user } = useAuth();
  
  // Основные данные
  const [payrollList, setPayrollList] = useState([]);
  const [filteredPayrolls, setFilteredPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Фильтры
  const [filters, setFilters] = useState({
    searchTerm: '',
    statusFilter: 'all',
    employeeFilter: 'all'
  });
  
  // UI состояния
  const [loading, setLoading] = useState(true);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  
  // Период
  const [currentPeriod, setCurrentPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  
  // Статистика (правильная структура)
  const [stats, setStats] = useState({
    totalPayrolls: 0,
    pendingPayrolls: 0,
    paidPayrolls: 0,
    totalAmount: 0,
    avgSalary: 0
  });

  // Загрузка данных при монтировании компонента и изменении периода
  useEffect(() => {
    loadData();
  }, [currentPeriod]);

  // Фильтрация при изменении поисковых параметров
  useEffect(() => {
    filterPayrolls();
  }, [payrollList, filters]);

  // Загрузка всех данных
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [payrollsData, employeesData] = await Promise.allSettled([
        payroll.getAll({
          year: currentPeriod.year,
          month: currentPeriod.month,
          limit: 200
        }).catch(err => {
          console.warn('Failed to load payrolls:', err);
          return [];
        }),
        organization.getUsers({ status: 'active', limit: 200 }).catch(err => {
          console.warn('Failed to load employees:', err);
          return [];
        })
      ]);

      // ИСПРАВЛЕНО: Правильное извлечение данных
      const payrolls = payrollsData.status === 'fulfilled' && Array.isArray(payrollsData.value) 
        ? payrollsData.value 
        : [];
      
      const employeesResult = employeesData.status === 'fulfilled' && Array.isArray(employeesData.value) 
        ? employeesData.value 
        : [];

      console.log('Loaded payrolls:', payrolls); // Для отладки
      console.log('Loaded employees:', employeesResult); // Для отладки

      setPayrollList(payrolls);
      setEmployees(employeesResult);
      
      calculateStats(payrolls);
      
    } catch (error) {
      console.error('Failed to load payroll data:', error);
      utils.showError('Не удалось загрузить данные о зарплатах');
      
      setPayrollList([]);
      setEmployees([]);
      setStats({
        totalPayrolls: 0,
        pendingPayrolls: 0,
        paidPayrolls: 0,
        totalAmount: 0,
        avgSalary: 0
      });
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, payroll, organization, utils]);

  // ИСПРАВЛЕНО: Правильный расчет статистики с учетом структуры API
  const calculateStats = useCallback((payrolls) => {
    if (!Array.isArray(payrolls)) {
      console.warn('calculateStats received non-array data:', payrolls);
      payrolls = [];
    }

    const totalPayrolls = payrolls.length;
    
    // ИСПРАВЛЕНО: Используем is_paid boolean вместо status string
    const pendingPayrolls = payrolls.filter(p => p && !p.is_paid).length;
    const paidPayrolls = payrolls.filter(p => p && p.is_paid).length;
    
    // ИСПРАВЛЕНО: Используем net_amount из API
    const totalAmount = payrolls.reduce((sum, p) => {
      const netAmount = p && typeof p.net_amount === 'number' ? p.net_amount : 0;
      return sum + netAmount;
    }, 0);
    
    const avgSalary = totalPayrolls > 0 ? totalAmount / totalPayrolls : 0;

    setStats({
      totalPayrolls,
      pendingPayrolls,
      paidPayrolls,
      totalAmount,
      avgSalary
    });

    console.log('Calculated stats:', { // Для отладки
      totalPayrolls,
      pendingPayrolls,
      paidPayrolls,
      totalAmount,
      avgSalary
    });
  }, []);

  // ИСПРАВЛЕНО: Правильная фильтрация
  const filterPayrolls = useCallback(() => {
    let filtered = [...payrollList];

    // Фильтр по поисковому запросу
    if (filters.searchTerm) {
      filtered = filtered.filter(payrollItem => {
        const employee = employees.find(emp => emp.id === payrollItem.user_id);
        const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : '';
        
        return (
          employeeName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          payrollItem.id.toLowerCase().includes(filters.searchTerm.toLowerCase())
        );
      });
    }

    // ИСПРАВЛЕНО: Фильтр по статусу с учетом is_paid
    if (filters.statusFilter !== 'all') {
      if (filters.statusFilter === 'pending') {
        filtered = filtered.filter(payrollItem => !payrollItem.is_paid);
      } else if (filters.statusFilter === 'paid') {
        filtered = filtered.filter(payrollItem => payrollItem.is_paid);
      }
    }

    // Фильтр по сотруднику
    if (filters.employeeFilter !== 'all') {
      filtered = filtered.filter(payrollItem => payrollItem.user_id === filters.employeeFilter);
    }

    setFilteredPayrolls(filtered);
  }, [payrollList, filters, employees]);

  // ИСПРАВЛЕНО: Обработчики с правильными полями API
  const handleCreatePayroll = async (payrollData) => {
    try {
      const newPayroll = await payroll.create(payrollData);
      if (newPayroll) {
        setPayrollList(prev => [newPayroll, ...prev]);
        utils.showSuccess('Зарплата успешно создана');
      }
      setShowPayrollModal(false);
      setSelectedPayroll(null);
    } catch (error) {
      console.error('Failed to create payroll:', error);
      utils.showError('Не удалось создать зарплату: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleUpdatePayroll = async (payrollData) => {
    try {
      const updatedPayroll = await payroll.update(selectedPayroll.id, payrollData);
      if (updatedPayroll) {
        setPayrollList(prev => prev.map(p => 
          p.id === selectedPayroll.id ? updatedPayroll : p
        ));
        utils.showSuccess('Зарплата обновлена');
      }
      setShowPayrollModal(false);
      setSelectedPayroll(null);
    } catch (error) {
      console.error('Failed to update payroll:', error);
      utils.showError('Не удалось обновить зарплату: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleMarkAsPaid = async (payrollId, paymentMethod = 'bank_transfer') => {
    try {
      await payroll.markAsPaid(payrollId, paymentMethod);
      // ИСПРАВЛЕНО: Обновляем is_paid вместо status
      setPayrollList(prev => prev.map(p => 
        p.id === payrollId ? { ...p, is_paid: true, paid_at: new Date().toISOString() } : p
      ));
      utils.showSuccess('Зарплата отмечена как выплаченная');
    } catch (error) {
      console.error('Failed to mark payroll as paid:', error);
      utils.showError('Не удалось отметить зарплату как выплаченную: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleRecalculate = async (payrollId) => {
    try {
      const recalculatedPayroll = await payroll.recalculate(payrollId);
      if (recalculatedPayroll) {
        setPayrollList(prev => prev.map(p => 
          p.id === payrollId ? recalculatedPayroll : p
        ));
        utils.showSuccess('Зарплата пересчитана');
      }
    } catch (error) {
      console.error('Failed to recalculate payroll:', error);
      utils.showError('Не удалось пересчитать зарплату: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleAutoGenerate = async () => {
    if (!confirm('Вы уверены, что хотите автоматически сгенерировать зарплаты за текущий период?')) return;

    try {
      const result = await payroll.autoGenerate(
        currentPeriod.year, 
        currentPeriod.month, 
        false
      );
      
      console.log('Auto-generate result:', result); // Для отладки
      
      await loadData(); // Перезагружаем данные
      utils.showSuccess('Зарплаты сгенерированы успешно');
      
    } catch (error) {
      console.error('Failed to auto-generate payrolls:', error);
      utils.showError('Не удалось сгенерировать зарплаты: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleExport = async (format = 'xlsx') => {
    try {
      const blob = await payroll.export(format, currentPeriod.year, currentPeriod.month);
      if (blob) {
        utils.downloadFile(blob, `payroll_${currentPeriod.year}_${currentPeriod.month}.${format}`);
        utils.showSuccess('Данные экспортированы успешно');
      } else {
        utils.showError('Не удалось экспортировать данные');
      }
    } catch (error) {
      console.error('Failed to export payroll data:', error);
      utils.showError('Не удалось экспортировать данные: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  // Утилиты для отображения
  const formatCurrency = (amount) => `₸ ${(amount || 0).toLocaleString()}`;
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  // ИСПРАВЛЕНО: Извлекаем год и месяц из period_start
  const getPayrollPeriod = (payrollItem) => {
    if (!payrollItem.period_start) return { year: currentPeriod.year, month: currentPeriod.month };
    
    const date = new Date(payrollItem.period_start);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1
    };
  };

  const getStatusDisplayName = (payrollItem) => {
    return payrollItem.is_paid ? 'Выплачена' : 'Ожидает выплаты';
  };

  const getStatusBadgeClass = (payrollItem) => {
    return payrollItem.is_paid ? 'status-paid' : 'status-pending';
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      admin: 'Администратор',
      manager: 'Менеджер',
      technical_staff: 'Технический персонал',
      accountant: 'Бухгалтер',
      cleaner: 'Уборщик',
      storekeeper: 'Кладовщик'
    };
    return roleNames[role] || role;
  };

  const handlePeriodChange = (direction) => {
    setCurrentPeriod(prev => {
      let newMonth = prev.month + direction;
      let newYear = prev.year;
      
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
      
      return { year: newYear, month: newMonth };
    });
  };

  const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: 'pending', label: 'Ожидают выплаты' },
    { value: 'paid', label: 'Выплачены' }
  ];

  const getMonthName = (month) => {
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return monthNames[month - 1];
  };

  if (loading) {
    return (
      <div className="payroll-page loading">
        <div className="loading-spinner"></div>
        <p>Загрузка данных о зарплатах...</p>
      </div>
    );
  }

  return (
    <div className="payroll-page">
      {/* Заголовок страницы */}
      <div className="page-header">
        <div className="header-left">
          <h1>Управление зарплатами</h1>
          <div className="period-selector">
            <button 
              className="period-btn"
              onClick={() => handlePeriodChange(-1)}
            >
              ←
            </button>
            <span className="current-period">
              <FiCalendar />
              {getMonthName(currentPeriod.month)} {currentPeriod.year}
            </span>
            <button 
              className="period-btn"
              onClick={() => handlePeriodChange(1)}
            >
              →
            </button>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn-outline"
            onClick={() => handleExport('xlsx')}
            disabled={filteredPayrolls.length === 0}
          >
            <FiDownload /> Экспорт
          </button>

          <button 
            className="btn-outline"
            onClick={handleAutoGenerate}
            disabled={loading}
          >
            <FiRefreshCw /> Автогенерация
          </button>
          
          <button 
            className="btn-primary"
            onClick={() => {
              setSelectedPayroll(null);
              setShowPayrollModal(true);
            }}
          >
            <FiPlus /> Добавить зарплату
          </button>
        </div>
      </div>

      {/* Предупреждения */}
      {stats.pendingPayrolls > 0 && (
        <div className="alert warning">
          <FiAlertCircle />
          <span>
            У вас {stats.pendingPayrolls} зарплат ожидают выплаты на общую сумму{' '}
            {formatCurrency(stats.totalAmount)}
          </span>
        </div>
      )}
      
      {/* Статистика */}
      <div className="payroll-statistics">
        <div className="stats-header">
          <h3>
            Статистика за {getMonthName(currentPeriod.month)} {currentPeriod.year}
          </h3>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-content">
              <div className="stat-value">{stats.totalPayrolls}</div>
              <div className="stat-label">Всего зарплат</div>
            </div>
          </div>

          <div className="stat-card warning">
            <div className="stat-content">
              <div className="stat-value">{stats.pendingPayrolls}</div>
              <div className="stat-label">Ожидают выплаты</div>
            </div>
          </div>

          <div className="stat-card success">
            <div className="stat-content">
              <div className="stat-value">{stats.paidPayrolls}</div>
              <div className="stat-label">Выплачено</div>
            </div>
          </div>

          <div className="stat-card info">
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(stats.totalAmount)}</div>
              <div className="stat-label">Общая сумма</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(stats.avgSalary)}</div>
              <div className="stat-label">Средняя зарплата</div>
            </div>
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="payroll-filters">
        <div className="filters-main">
          <div className="filters-left">
            <div className="search-box">
              <input 
                type="text" 
                placeholder="Поиск сотрудников..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              />
            </div>
            
            <select 
              className="filter-select"
              value={filters.statusFilter}
              onChange={(e) => setFilters({ ...filters, statusFilter: e.target.value })}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select 
              className="filter-select"
              value={filters.employeeFilter}
              onChange={(e) => setFilters({ ...filters, employeeFilter: e.target.value })}
            >
              <option value="all">Все сотрудники</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ИСПРАВЛЕННАЯ Таблица зарплат */}
      <div className="payroll-table-container">
        {filteredPayrolls.length > 0 ? (
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Должность</th>
                <th>Период</th>
                <th>Базовая ставка</th>
                <th>Итого начислено</th>
                <th>К выплате</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayrolls.map(payrollItem => {
                const employee = employees.find(emp => emp.id === payrollItem.user_id);
                const period = getPayrollPeriod(payrollItem);
                
                return (
                  <tr key={payrollItem.id} className="payroll-row">
                    <td>
                      <div className="employee-cell">
                        <div className="employee-details">
                          <div className="employee-name">
                            {employee ? `${employee.first_name} ${employee.last_name}` : 'Не найден'}
                          </div>
                          <div className="employee-email">
                            {employee?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${employee?.role}`}>
                        {getRoleDisplayName(employee?.role)}
                      </span>
                    </td>
                    <td>
                      <div className="period-cell">
                        <div className="period-main">
                          {period.month}/{period.year}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="amount-cell">
                        {formatCurrency(payrollItem.base_rate)}
                      </div>
                    </td>
                    <td>
                      <div className="amount-cell">
                        {formatCurrency(payrollItem.gross_amount)}
                      </div>
                    </td>
                    <td>
                      <div className="net-amount-cell">
                        <div className="net-amount">
                          {formatCurrency(payrollItem.net_amount)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="status-cell">
                        <span className={`status-badge ${getStatusBadgeClass(payrollItem)}`}>
                          {getStatusDisplayName(payrollItem)}
                        </span>
                        {payrollItem.paid_at && (
                          <div className="paid-date">
                            {formatDate(payrollItem.paid_at)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        {!payrollItem.is_paid && (
                          <>
                            <button 
                              className="btn-icon edit"
                              onClick={() => {
                                setSelectedPayroll(payrollItem);
                                setShowPayrollModal(true);
                              }}
                              title="Редактировать"
                            >
                              ✏️
                            </button>
                            
                            <button 
                              className="btn-icon recalculate"
                              onClick={() => handleRecalculate(payrollItem.id)}
                              title="Пересчитать"
                            >
                              🔄
                            </button>
                            
                            <button 
                              className="btn-icon pay"
                              onClick={() => handleMarkAsPaid(payrollItem.id)}
                              title="Отметить как выплаченную"
                            >
                              ✅
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-payrolls">
            <div className="empty-state">
              <h3>
                {filters.searchTerm || filters.statusFilter !== 'all' || filters.employeeFilter !== 'all'
                  ? 'Зарплаты не найдены' 
                  : 'Нет зарплат'
                }
              </h3>
              <p>
                {filters.searchTerm || filters.statusFilter !== 'all' || filters.employeeFilter !== 'all'
                  ? 'Попробуйте изменить условия поиска'
                  : `Нет зарплат за ${getMonthName(currentPeriod.month)} ${currentPeriod.year}`
                }
              </p>
              {(!filters.searchTerm && filters.statusFilter === 'all' && filters.employeeFilter === 'all') && (
                <div className="empty-actions">
                  <button 
                    className="btn-primary"
                    onClick={handleAutoGenerate}
                  >
                    <FiRefreshCw /> Автоматически сгенерировать зарплаты
                  </button>
                  <button 
                    className="btn-outline"
                    onClick={() => {
                      setSelectedPayroll(null);
                      setShowPayrollModal(true);
                    }}
                  >
                    <FiPlus /> Добавить вручную
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Модальные окна */}
      {showPayrollModal && (
        <PayrollModal
          payroll={selectedPayroll}
          employees={employees}
          onClose={() => {
            setShowPayrollModal(false);
            setSelectedPayroll(null);
          }}
          onSubmit={selectedPayroll ? handleUpdatePayroll : handleCreatePayroll}
        />
      )}

      {showTemplateModal && (
        <TemplateModal
          employees={employees}
          onClose={() => setShowTemplateModal(false)}
          onUpdate={loadData}
        />
      )}

      {showOperationModal && (
        <OperationModal
          employees={employees}
          onClose={() => setShowOperationModal(false)}
          onSubmit={loadData}
        />
      )}
    </div>
  );
};

export default Payroll;