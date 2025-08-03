import { useState, useEffect } from 'react';
import { 
  FiPlus, 
  FiSearch, 
  FiFilter, 
  FiEdit2, 
  FiEye, 
  FiDownload,
  FiX,
  FiUser,
  FiDollarSign,
  FiCalendar,
  FiTrendingUp,
  FiClock,
  FiCheck,
  FiRefreshCw,
  FiSettings
} from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { PayrollModal, TemplateModal, OperationModal } from './Payrolls';
import './Pages.css';

const Payroll = () => {
  const { payroll, organization, utils } = useData();
  const { user } = useAuth();
  
  const [payrollList, setPayrollList] = useState([]);
  const [filteredPayrolls, setFilteredPayrolls] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [operations, setOperations] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('current');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  
  const [loading, setLoading] = useState(true);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  
  const [currentPeriod, setCurrentPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  
  const [stats, setStats] = useState({
    totalPayrolls: 0,
    pendingPayrolls: 0,
    paidPayrolls: 0,
    totalAmount: 0,
    avgSalary: 0,
    monthlyTotal: 0
  });

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadData();
  }, [currentPeriod]);

  // Фильтрация при изменении поисковых параметров
  useEffect(() => {
    filterPayrolls();
  }, [payrollList, searchTerm, statusFilter, periodFilter, employeeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Загружаем данные параллельно с обработкой ошибок
      const [payrollsData, templatesData, operationsData, employeesData] = await Promise.allSettled([
        payroll.getAll({
          year: currentPeriod.year,
          month: currentPeriod.month,
          limit: 200
        }).catch(err => {
          console.warn('Failed to load payrolls:', err);
          return [];
        }),
        payroll.getTemplates({ status: 'active' }).catch(err => {
          console.warn('Failed to load templates:', err);
          return [];
        }),
        payroll.getOperations({
          year: currentPeriod.year,
          month: currentPeriod.month,
          limit: 100
        }).catch(err => {
          console.warn('Failed to load operations:', err);
          return [];
        }),
        organization.getUsers({ status: 'active', limit: 200 }).catch(err => {
          console.warn('Failed to load employees:', err);
          return [];
        })
      ]);

      // Безопасное извлечение данных
      const payrolls = payrollsData.status === 'fulfilled' && Array.isArray(payrollsData.value) 
        ? payrollsData.value 
        : [];
      
      const templatesResult = templatesData.status === 'fulfilled' && Array.isArray(templatesData.value) 
        ? templatesData.value 
        : [];
      
      const operationsResult = operationsData.status === 'fulfilled' && Array.isArray(operationsData.value) 
        ? operationsData.value 
        : [];
      
      const employeesResult = employeesData.status === 'fulfilled' && Array.isArray(employeesData.value) 
        ? employeesData.value 
        : [];

      setPayrollList(payrolls);
      setTemplates(templatesResult);
      setOperations(operationsResult);
      setEmployees(employeesResult);
      
      calculateStats(payrolls);
      
    } catch (error) {
      console.error('Failed to load payroll data:', error);
      utils.showError('Не удалось загрузить данные о зарплатах');
      
      // Устанавливаем пустые массивы в случае критической ошибки
      setPayrollList([]);
      setTemplates([]);
      setOperations([]);
      setEmployees([]);
      setStats({
        totalPayrolls: 0,
        pendingPayrolls: 0,
        paidPayrolls: 0,
        totalAmount: 0,
        avgSalary: 0,
        monthlyTotal: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (payrolls) => {
    // Проверяем, что payrolls - это массив
    if (!Array.isArray(payrolls)) {
      console.warn('calculateStats received non-array data:', payrolls);
      payrolls = [];
    }

    const totalPayrolls = payrolls.length;
    const pendingPayrolls = payrolls.filter(p => p && p.status === 'pending').length;
    const paidPayrolls = payrolls.filter(p => p && p.status === 'paid').length;
    
    const totalAmount = payrolls.reduce((sum, p) => {
      const amount = p && typeof p.total_amount === 'number' ? p.total_amount : 0;
      return sum + amount;
    }, 0);
    
    const avgSalary = totalPayrolls > 0 ? totalAmount / totalPayrolls : 0;
    
    const monthlyTotal = payrolls.reduce((sum, p) => {
      const salary = p && typeof p.base_salary === 'number' ? p.base_salary : 0;
      return sum + salary;
    }, 0);

    setStats({
      totalPayrolls,
      pendingPayrolls,
      paidPayrolls,
      totalAmount,
      avgSalary,
      monthlyTotal
    });
  };

  const filterPayrolls = () => {
    let filtered = payrollList;

    // Фильтр по поисковому запросу
    if (searchTerm) {
      filtered = filtered.filter(payroll => {
        const employee = employees.find(emp => emp.id === payroll.user_id);
        const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : '';
        
        return (
          employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payroll.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(payroll => payroll.status === statusFilter);
    }

    // Фильтр по сотруднику
    if (employeeFilter !== 'all') {
      filtered = filtered.filter(payroll => payroll.user_id === employeeFilter);
    }

    setFilteredPayrolls(filtered);
  };

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
      setPayrollList(prev => prev.map(p => 
        p.id === payrollId ? { ...p, status: 'paid', paid_at: new Date().toISOString() } : p
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
      
      // Проверяем, что результат содержит данные
      let generatedPayrolls = [];
      
      if (Array.isArray(result)) {
        generatedPayrolls = result;
      } else if (result && Array.isArray(result.payrolls)) {
        generatedPayrolls = result.payrolls;
      } else if (result && Array.isArray(result.data)) {
        generatedPayrolls = result.data;
      } else {
        console.warn('Unexpected result format from autoGenerate:', result);
        // Если формат неожиданный, просто перезагружаем данные
        await loadData();
        utils.showSuccess('Зарплаты сгенерированы успешно');
        return;
      }
      
      if (generatedPayrolls.length > 0) {
        setPayrollList(prev => [...generatedPayrolls, ...prev]);
        utils.showSuccess(`Сгенерировано ${generatedPayrolls.length} зарплат`);
      } else {
        utils.showInfo('Зарплаты уже созданы за этот период или нет активных сотрудников');
      }
      
      // В любом случае перезагружаем данные для актуализации
      await loadData();
      
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

  const formatCurrency = (amount) => {
    return amount ? `₸ ${amount.toLocaleString()}` : '₸ 0';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getStatusDisplayName = (status) => {
    const statusNames = {
      'pending': 'Ожидает выплаты',
      'paid': 'Выплачена',
      'cancelled': 'Отменена',
      'draft': 'Черновик'
    };
    return statusNames[status] || status;
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'pending': 'status-pending',
      'paid': 'status-paid',
      'cancelled': 'status-cancelled',
      'draft': 'status-draft'
    };
    return classes[status] || 'status-default';
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

  const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: 'pending', label: 'Ожидают выплаты' },
    { value: 'paid', label: 'Выплачены' },
    { value: 'cancelled', label: 'Отменены' },
    { value: 'draft', label: 'Черновики' }
  ];

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
      <div className="page-header">
        <h1>Управление зарплатами</h1>
        <div className="header-controls">
          <div className="period-selector">
            <button 
              className="period-btn"
              onClick={() => handlePeriodChange(-1)}
            >
              ←
            </button>
            <span className="current-period">
              {getMonthName(currentPeriod.month)} {currentPeriod.year}
            </span>
            <button 
              className="period-btn"
              onClick={() => handlePeriodChange(1)}
            >
              →
            </button>
          </div>
          
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Поиск сотрудников..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="clear-search"
                onClick={() => setSearchTerm('')}
              >
                <FiX />
              </button>
            )}
          </div>
          
          <div className="filter-group">
            <FiFilter />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <FiUser />
            <select 
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            >
              <option value="all">Все сотрудники</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name}
                </option>
              ))}
            </select>
          </div>

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
      
      {/* Статистика */}
      <div className="payroll-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <FiUser />
          </div>
          <div className="stat-content">
            <h3>Всего зарплат</h3>
            <div className="stat-number">{stats.totalPayrolls}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FiClock />
          </div>
          <div className="stat-content">
            <h3>Ожидают выплаты</h3>
            <div className="stat-number">{stats.pendingPayrolls}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FiCheck />
          </div>
          <div className="stat-content">
            <h3>Выплачено</h3>
            <div className="stat-number">{stats.paidPayrolls}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FiDollarSign />
          </div>
          <div className="stat-content">
            <h3>Общая сумма</h3>
            <div className="stat-number">{formatCurrency(stats.totalAmount)}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FiTrendingUp />
          </div>
          <div className="stat-content">
            <h3>Средняя зарплата</h3>
            <div className="stat-number">{formatCurrency(stats.avgSalary)}</div>
          </div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="payroll-quick-actions">
        <button 
          className="quick-action-btn"
          onClick={() => setShowTemplateModal(true)}
        >
          <FiSettings />
          <span>Управление шаблонами</span>
        </button>
        
        <button 
          className="quick-action-btn"
          onClick={() => setShowOperationModal(true)}
        >
          <FiPlus />
          <span>Добавить операцию</span>
        </button>
        
        <button 
          className="quick-action-btn"
          onClick={() => handleAutoGenerate()}
        >
          <FiRefreshCw />
          <span>Пересчитать все</span>
        </button>
      </div>

      {/* Таблица зарплат */}
      <div className="payroll-table-wrapper">
        {filteredPayrolls.length > 0 ? (
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Должность</th>
                <th>Период</th>
                <th>Базовая ставка</th>
                <th>Бонусы/Надбавки</th>
                <th>Удержания</th>
                <th>К выплате</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayrolls.map(payrollItem => {
                const employee = employees.find(emp => emp.id === payrollItem.user_id);
                
                return (
                  <tr key={payrollItem.id}>
                    <td>
                      <div className="employee-info">
                        <div className="employee-avatar">
                          <FiUser />
                        </div>
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
                      <div className="period-info">
                        <div className="period-text">
                          {getMonthName(payrollItem.period_month)} {payrollItem.period_year}
                        </div>
                        <div className="work-days">
                          Рабочих дней: {payrollItem.work_days || 0}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="salary-amount">
                        {formatCurrency(payrollItem.base_salary)}
                      </div>
                    </td>
                    <td>
                      <div className="bonuses-info">
                        <div className="bonus-amount">
                          +{formatCurrency(payrollItem.bonuses || 0)}
                        </div>
                        <div className="overtime-amount">
                          Сверхур.: +{formatCurrency(payrollItem.overtime_pay || 0)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="deductions-info">
                        <div className="tax-amount">
                          ИПН: -{formatCurrency(payrollItem.tax_amount || 0)}
                        </div>
                        <div className="pension-amount">
                          Пенс.: -{formatCurrency(payrollItem.pension_deduction || 0)}
                        </div>
                        <div className="other-deductions">
                          Прочее: -{formatCurrency(payrollItem.other_deductions || 0)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="final-amount">
                        <div className="net-salary">
                          {formatCurrency(payrollItem.net_salary)}
                        </div>
                        <div className="total-amount">
                          Всего: {formatCurrency(payrollItem.total_amount)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(payrollItem.status)}`}>
                        {getStatusDisplayName(payrollItem.status)}
                      </span>
                      {payrollItem.paid_at && (
                        <div className="paid-date">
                          {formatDate(payrollItem.paid_at)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon view"
                          onClick={() => {
                            setSelectedPayroll(payrollItem);
                            setShowPayrollModal(true);
                          }}
                          title="Просмотр"
                        >
                          <FiEye />
                        </button>
                        
                        {payrollItem.status === 'pending' && (
                          <>
                            <button 
                              className="btn-icon edit"
                              onClick={() => {
                                setSelectedPayroll(payrollItem);
                                setShowPayrollModal(true);
                              }}
                              title="Редактировать"
                            >
                              <FiEdit2 />
                            </button>
                            
                            <button 
                              className="btn-icon recalculate"
                              onClick={() => handleRecalculate(payrollItem.id)}
                              title="Пересчитать"
                            >
                              <FiRefreshCw />
                            </button>
                            
                            <button 
                              className="btn-icon pay"
                              onClick={() => handleMarkAsPaid(payrollItem.id)}
                              title="Отметить как выплаченную"
                            >
                              <FiCheck />
                            </button>
                          </>
                        )}
                        
                        <button 
                          className="btn-icon download"
                          onClick={() => {
                            // Экспорт отдельной зарплаты
                          }}
                          title="Скачать справку"
                        >
                          <FiDownload />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="no-payrolls">
            <div className="empty-state">
              <FiDollarSign size={48} />
              <h3>
                {searchTerm || statusFilter !== 'all' || employeeFilter !== 'all'
                  ? 'Зарплаты не найдены' 
                  : 'Нет зарплат'
                }
              </h3>
              <p>
                {searchTerm || statusFilter !== 'all' || employeeFilter !== 'all'
                  ? 'Попробуйте изменить условия поиска'
                  : `Нет зарплат за ${getMonthName(currentPeriod.month)} ${currentPeriod.year}`
                }
              </p>
              {(!searchTerm && statusFilter === 'all' && employeeFilter === 'all') && (
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
          templates={templates}
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