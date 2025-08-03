import { useState, useEffect } from 'react';
import { 
  FiPlus, 
  FiSearch, 
  FiFilter, 
  FiEdit2, 
  FiTrash2, 
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
  FiSettings,
  FiAlertCircle
} from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
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
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
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
      const blob = await payroll.exportData(format, currentPeriod.year, currentPeriod.month);
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

  const periodOptions = [
    { value: 'current', label: 'Текущий месяц' },
    { value: 'previous', label: 'Предыдущий месяц' },
    { value: 'all', label: 'Все периоды' }
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

      {/* Модальные окна будут добавлены позже */}
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

// Компонент модального окна для создания/редактирования зарплаты
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
    if (!formData.base_salary || formData.base_salary <= 0) {
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
                      {new Date(2023, i).toLocaleDateString('ru-RU', { month: 'long' })}
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

// Компонент модального окна для управления шаблонами
const TemplateModal = ({ templates, onClose, onUpdate }) => {
  const { payroll, utils } = useData();
  const [activeTab, setActiveTab] = useState('list');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    user_id: '', // Можно оставить пустым для шаблонов по ролям
    payroll_type: 'monthly',
    base_rate: '',
    overtime_rate: '',
    overtime_multiplier: 1.5,
    tax_rate: 0.1,
    pension_rate: 0.1,
    effective_from: new Date().toISOString().split('T')[0],
    role: '', // Дополнительное поле для удобства
    is_active: true
  });

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    
    // Валидация
    if (!formData.name.trim()) {
      utils.showError('Введите название шаблона');
      return;
    }
    if (!formData.base_rate || parseFloat(formData.base_rate) <= 0) {
      utils.showError('Введите базовую ставку');
      return;
    }

    try {
      const templateData = {
        name: formData.name.trim(),
        payroll_type: formData.payroll_type,
        base_rate: parseFloat(formData.base_rate),
        overtime_rate: formData.overtime_rate ? parseFloat(formData.overtime_rate) : null,
        overtime_multiplier: parseFloat(formData.overtime_multiplier),
        tax_rate: parseFloat(formData.tax_rate),
        pension_rate: parseFloat(formData.pension_rate),
        effective_from: formData.effective_from,
        is_active: formData.is_active,
        // Дополнительные поля если нужны
        role: formData.role || null,
        description: `Шаблон для ${formData.role || 'сотрудников'}`
      };

      // Если указана роль, но не указан user_id, можно пропустить user_id
      // или найти любого пользователя с этой ролью для примера
      if (!formData.user_id && formData.role) {
        // Пропускаем user_id для шаблонов по ролям
        // Или можно установить специальное значение
        templateData.user_id = null;
      } else if (formData.user_id) {
        templateData.user_id = formData.user_id;
      }

      await payroll.createTemplate(templateData);
      utils.showSuccess('Шаблон создан');
      onUpdate();
      setActiveTab('list');
      setFormData({
        name: '',
        user_id: '',
        payroll_type: 'monthly',
        base_rate: '',
        overtime_rate: '',
        overtime_multiplier: 1.5,
        tax_rate: 0.1,
        pension_rate: 0.1,
        effective_from: new Date().toISOString().split('T')[0],
        role: '',
        is_active: true
      });
    } catch (error) {
      console.error('Failed to create template:', error);
      const errorMessage = error.message || 'Не удалось создать шаблон';
      utils.showError('Ошибка создания шаблона: ' + errorMessage);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) return;
    
    try {
      await payroll.deactivateTemplate(templateId);
      utils.showSuccess('Шаблон деактивирован');
      onUpdate();
    } catch (error) {
      console.error('Failed to delete template:', error);
      utils.showError('Не удалось удалить шаблон: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const payrollTypes = [
    { value: 'hourly', label: 'Почасовая' },
    { value: 'daily', label: 'Ежедневная' },
    { value: 'weekly', label: 'Еженедельная' },
    { value: 'monthly', label: 'Ежемесячная' },
    { value: 'yearly', label: 'Годовая' }
  ];

  const roles = [
    { value: 'admin', label: 'Администратор' },
    { value: 'manager', label: 'Менеджер' },
    { value: 'technical_staff', label: 'Технический персонал' },
    { value: 'accountant', label: 'Бухгалтер' },
    { value: 'cleaner', label: 'Уборщик' },
    { value: 'storekeeper', label: 'Кладовщик' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content template-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiSettings /> Управление шаблонами зарплат
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="template-tabs">
          <button 
            className={`tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Список шаблонов
          </button>
          <button 
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Создать шаблон
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="templates-list">
            {templates.length > 0 ? (
              <table className="templates-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Базовая ставка</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(template => (
                    <tr key={template.id}>
                      <td>
                        <div>
                          <div className="template-name">{template.name}</div>
                          {template.description && (
                            <div className="template-role">{template.description}</div>
                          )}
                        </div>
                      </td>
                      <td>{template.payroll_type}</td>
                      <td>₸ {template.base_rate?.toLocaleString()}</td>
                      <td>
                        {template.user_id ? (
                          <div className="template-user">
                            {employees.find(emp => emp.id === template.user_id)?.first_name || 'Не найден'} {' '}
                            {employees.find(emp => emp.id === template.user_id)?.last_name || ''}
                          </div>
                        ) : (
                          <span className="text-muted">Общий</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${template.is_active ? 'active' : 'inactive'}`}>
                          {template.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>
                      <td>
                        <div className="template-actions">
                          <button 
                            className="btn-icon edit"
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <FiEdit2 />
                          </button>
                          <button 
                            className="btn-icon delete"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-templates">
                <p>Нет созданных шаблонов</p>
                <button 
                  className="btn-primary"
                  onClick={() => setActiveTab('create')}
                >
                  Создать первый шаблон
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <form className="template-form" onSubmit={handleCreateTemplate}>
            <div className="form-grid">
              <div className="form-field">
                <label>Название шаблона *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Администратор - базовый"
                  required
                />
              </div>

              <div className="form-field">
                <label>Тип зарплаты *</label>
                <select
                  value={formData.payroll_type}
                  onChange={(e) => setFormData({ ...formData, payroll_type: e.target.value })}
                  required
                >
                  {payrollTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Роль (для фильтрации сотрудников)</label>
                <select
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                >
                  <option value="">Все роли</option>
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Сотрудник *</label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  required
                >
                  <option value="">
                    {filteredEmployees.length === 0 
                      ? 'Нет доступных сотрудников' 
                      : 'Выберите сотрудника'}
                  </option>
                  {filteredEmployees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} - {employee.role}
                    </option>
                  ))}
                </select>
                {filteredEmployees.length === 0 && employees.length > 0 && (
                  <small className="text-warning">
                    Нет сотрудников с выбранной ролью. Выберите "Все роли" чтобы увидеть всех сотрудников.
                  </small>
                )}
              </div>

              <div className="form-field">
                <label>Базовая ставка *</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.base_rate}
                  onChange={(e) => setFormData({ ...formData, base_rate: e.target.value })}
                  placeholder="150000"
                  required
                />
              </div>

              <div className="form-field">
                <label>Сверхурочная ставка</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.overtime_rate}
                  onChange={(e) => setFormData({ ...formData, overtime_rate: e.target.value })}
                  placeholder="2000"
                />
              </div>

              <div className="form-field">
                <label>Коэффициент сверхурочных</label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  step="0.1"
                  value={formData.overtime_multiplier}
                  onChange={(e) => setFormData({ ...formData, overtime_multiplier: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Ставка ИПН (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={formData.tax_rate * 100}
                  onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value / 100 })}
                />
              </div>

              <div className="form-field">
                <label>Ставка пенсионных взносов (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={formData.pension_rate * 100}
                  onChange={(e) => setFormData({ ...formData, pension_rate: e.target.value / 100 })}
                />
              </div>

              <div className="form-field">
                <label>Дата вступления в силу *</label>
                <input
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  required
                />
              </div>
            </div>

            {employees.length === 0 && (
              <div className="warning-message">
                <FiAlertCircle />
                <span>
                  Нет активных сотрудников для создания шаблона. 
                  Сначала добавьте сотрудников в систему.
                </span>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => setActiveTab('list')}>
                Отмена
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={employees.length === 0}
              >
                Создать шаблон
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Компонент модального окна для добавления операций
const OperationModal = ({ employees, onClose, onSubmit }) => {
  const { payroll, utils } = useData();
  const [operationType, setOperationType] = useState('bonus');
  const [formData, setFormData] = useState({
    user_id: '',
    amount: '',
    description: '',
    operation_date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        operation_type: operationType
      };

      switch (operationType) {
        case 'bonus':
          await payroll.addQuickBonus(formData.user_id, submitData);
          break;
        case 'penalty':
          await payroll.addQuickPenalty(formData.user_id, submitData);
          break;
        case 'overtime':
          await payroll.addOvertimePayment(formData.user_id, submitData);
          break;
        case 'allowance':
          await payroll.addAllowance(formData.user_id, submitData);
          break;
        case 'deduction':
          await payroll.addDeduction(formData.user_id, submitData);
          break;
      }

      utils.showSuccess('Операция добавлена');
      onSubmit();
      onClose();
    } catch (error) {
      console.error('Failed to add operation:', error);
    }
  };

  const operationTypes = [
    { value: 'bonus', label: 'Премия', icon: '💰' },
    { value: 'penalty', label: 'Штраф', icon: '⚠️' },
    { value: 'overtime', label: 'Сверхурочные', icon: '⏰' },
    { value: 'allowance', label: 'Надбавка', icon: '📈' },
    { value: 'deduction', label: 'Удержание', icon: '📉' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content operation-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiPlus /> Добавить операцию
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form className="operation-form" onSubmit={handleSubmit}>
          <div className="operation-types">
            {operationTypes.map(type => (
              <button
                key={type.value}
                type="button"
                className={`operation-type-btn ${operationType === type.value ? 'active' : ''}`}
                onClick={() => setOperationType(type.value)}
              >
                <span className="operation-icon">{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Сотрудник *</label>
              <select
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                required
              >
                <option value="">Выберите сотрудника</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Сумма *</label>
              <input
                type="number"
                min="0"
                step="100"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
                required
              />
            </div>

            <div className="form-field">
              <label>Дата</label>
              <input
                type="date"
                value={formData.operation_date}
                onChange={(e) => setFormData({ ...formData, operation_date: e.target.value })}
              />
            </div>

            <div className="form-field full-width">
              <label>Описание *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Причина операции..."
                rows="3"
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              Добавить операцию
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Payroll;