import React, { useState } from 'react';
import { 
  FiUser, 
  FiEye, 
  FiEdit2, 
  FiRefreshCw, 
  FiCheck, 
  FiDownload,
  FiDollarSign,
  FiChevronUp,
  FiChevronDown,
  FiMoreHorizontal
} from 'react-icons/fi';

const PayrollTable = ({ 
  payrolls, 
  employees, 
  onViewDetails, 
  onEdit, 
  onMarkPaid, 
  onRecalculate,
  onBulkSelect,
  selectedItems = [],
  loading 
}) => {
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedRows, setExpandedRows] = useState(new Set());

  const formatCurrency = (amount) => `₸ ${(amount || 0).toLocaleString()}`;
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('ru-RU') : 'Не указано';

  const getStatusBadgeClass = (status) => {
    const classes = {
      'pending': 'status-pending',
      'paid': 'status-paid',
      'cancelled': 'status-cancelled',
      'draft': 'status-draft'
    };
    return classes[status] || 'status-default';
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <FiChevronUp /> : <FiChevronDown />;
  };

  const toggleRowExpansion = (payrollId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(payrollId)) {
      newExpanded.delete(payrollId);
    } else {
      newExpanded.add(payrollId);
    }
    setExpandedRows(newExpanded);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onBulkSelect(payrolls.map(p => p.id));
    } else {
      onBulkSelect([]);
    }
  };

  const handleSelectItem = (payrollId, isSelected) => {
    if (isSelected) {
      onBulkSelect([...selectedItems, payrollId]);
    } else {
      onBulkSelect(selectedItems.filter(id => id !== payrollId));
    }
  };

  if (loading) {
    return (
      <div className="table-loading">
        <div className="loading-spinner"></div>
        <p>Загрузка зарплат...</p>
      </div>
    );
  }

  if (payrolls.length === 0) {
    return (
      <div className="empty-payrolls">
        <div className="empty-state">
          <FiDollarSign size={48} />
          <h3>Зарплаты не найдены</h3>
          <p>Попробуйте изменить условия поиска или создайте новые зарплаты</p>
        </div>
      </div>
    );
  }

  // Сортировка данных
  const sortedPayrolls = [...payrolls].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Специальная обработка для полей сотрудника
    if (sortField === 'employee_name') {
      const empA = employees.find(emp => emp.id === a.user_id);
      const empB = employees.find(emp => emp.id === b.user_id);
      aValue = empA ? `${empA.first_name} ${empA.last_name}` : '';
      bValue = empB ? `${empB.first_name} ${empB.last_name}` : '';
    }

    if (sortField === 'net_amount') {
      const grossA = (a.base_salary || 0) + (a.bonuses || 0) + (a.allowances || 0);
      const deductionsA = (a.tax_amount || 0) + (a.pension_deduction || 0) + (a.other_deductions || 0);
      aValue = grossA - deductionsA;

      const grossB = (b.base_salary || 0) + (b.bonuses || 0) + (b.allowances || 0);
      const deductionsB = (b.tax_amount || 0) + (b.pension_deduction || 0) + (b.other_deductions || 0);
      bValue = grossB - deductionsB;
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return (
    <div className="payroll-table-container">
      {/* Массовые действия */}
      {selectedItems.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">
            Выбрано: {selectedItems.length} из {payrolls.length}
          </span>
          <div className="bulk-actions">
            <button className="btn-secondary">
              <FiCheck /> Отметить выплаченными
            </button>
            <button className="btn-secondary">
              <FiDownload /> Экспорт выбранных
            </button>
            <button className="btn-secondary">
              <FiRefreshCw /> Пересчитать
            </button>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="payroll-table">
          <thead>
            <tr>
              <th className="select-column">
                <input 
                  type="checkbox"
                  checked={selectedItems.length === payrolls.length && payrolls.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th 
                className={`sortable ${sortField === 'employee_name' ? 'sorted' : ''}`}
                onClick={() => handleSort('employee_name')}
              >
                Сотрудник {getSortIcon('employee_name')}
              </th>
              <th>Должность</th>
              <th 
                className={`sortable ${sortField === 'period_month' ? 'sorted' : ''}`}
                onClick={() => handleSort('period_month')}
              >
                Период {getSortIcon('period_month')}
              </th>
              <th 
                className={`sortable ${sortField === 'base_salary' ? 'sorted' : ''}`}
                onClick={() => handleSort('base_salary')}
              >
                Базовая ставка {getSortIcon('base_salary')}
              </th>
              <th>Доплаты</th>
              <th>Удержания</th>
              <th 
                className={`sortable ${sortField === 'net_amount' ? 'sorted' : ''}`}
                onClick={() => handleSort('net_amount')}
              >
                К выплате {getSortIcon('net_amount')}
              </th>
              <th 
                className={`sortable ${sortField === 'status' ? 'sorted' : ''}`}
                onClick={() => handleSort('status')}
              >
                Статус {getSortIcon('status')}
              </th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sortedPayrolls.map(payrollItem => {
              const employee = employees.find(emp => emp.id === payrollItem.user_id);
              const grossAmount = (payrollItem.base_salary || 0) + (payrollItem.bonuses || 0) + (payrollItem.allowances || 0) + (payrollItem.overtime_pay || 0);
              const deductions = (payrollItem.tax_amount || 0) + (payrollItem.pension_deduction || 0) + (payrollItem.other_deductions || 0);
              const netAmount = grossAmount - deductions;
              const isExpanded = expandedRows.has(payrollItem.id);
              const isSelected = selectedItems.includes(payrollItem.id);
              
              return (
                <React.Fragment key={payrollItem.id}>
                  <tr className={`payroll-row ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}>
                    <td className="select-column">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectItem(payrollItem.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <div className="employee-cell">
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
                        <button 
                          className="expand-btn"
                          onClick={() => toggleRowExpansion(payrollItem.id)}
                        >
                          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
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
                          {payrollItem.period_month}/{payrollItem.period_year}
                        </div>
                        <div className="work-days">
                          {payrollItem.work_days || 0} раб. дней
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="amount-cell">
                        {formatCurrency(payrollItem.base_salary)}
                      </div>
                    </td>
                    <td>
                      <div className="additions-cell">
                        {payrollItem.bonuses > 0 && (
                          <div className="addition-line bonus">
                            Премии: {formatCurrency(payrollItem.bonuses)}
                          </div>
                        )}
                        {payrollItem.allowances > 0 && (
                          <div className="addition-line allowance">
                            Надбавки: {formatCurrency(payrollItem.allowances)}
                          </div>
                        )}
                        {payrollItem.overtime_pay > 0 && (
                          <div className="addition-line overtime">
                            Сверхур.: {formatCurrency(payrollItem.overtime_pay)}
                          </div>
                        )}
                        {grossAmount === (payrollItem.base_salary || 0) && (
                          <div className="no-additions">—</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="deductions-cell">
                        {payrollItem.tax_amount > 0 && (
                          <div className="deduction-line tax">
                            ИПН: {formatCurrency(payrollItem.tax_amount)}
                          </div>
                        )}
                        {payrollItem.pension_deduction > 0 && (
                          <div className="deduction-line pension">
                            Пенс.: {formatCurrency(payrollItem.pension_deduction)}
                          </div>
                        )}
                        {payrollItem.other_deductions > 0 && (
                          <div className="deduction-line other">
                            Прочее: {formatCurrency(payrollItem.other_deductions)}
                          </div>
                        )}
                        {deductions === 0 && (
                          <div className="no-deductions">—</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="net-amount-cell">
                        <div className="net-amount">
                          {formatCurrency(netAmount)}
                        </div>
                        <div className="amount-breakdown">
                          {formatCurrency(grossAmount)} - {formatCurrency(deductions)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="status-cell">
                        <span className={`status-badge ${getStatusBadgeClass(payrollItem.status)}`}>
                          {getStatusDisplayName(payrollItem.status)}
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
                        <button 
                          className="btn-icon view"
                          onClick={() => onViewDetails(payrollItem)}
                          title="Подробности"
                        >
                          <FiEye />
                        </button>
                        
                        {payrollItem.status === 'pending' && (
                          <div className="pending-actions">
                            <button 
                              className="btn-icon edit"
                              onClick={() => onEdit(payrollItem)}
                              title="Редактировать"
                            >
                              <FiEdit2 />
                            </button>
                            
                            <button 
                              className="btn-icon recalculate"
                              onClick={() => onRecalculate(payrollItem.id)}
                              title="Пересчитать"
                            >
                              <FiRefreshCw />
                            </button>
                            
                            <button 
                              className="btn-icon pay"
                              onClick={() => onMarkPaid(payrollItem.id)}
                              title="Отметить выплаченной"
                            >
                              <FiCheck />
                            </button>
                          </div>
                        )}
                        
                        <div className="more-actions">
                          <button className="btn-icon more">
                            <FiMoreHorizontal />
                          </button>
                          <div className="dropdown-menu">
                            <button onClick={() => {}}>
                              <FiDownload /> Скачать справку
                            </button>
                            <button onClick={() => {}}>
                              Отправить на email
                            </button>
                            <button onClick={() => {}}>
                              История изменений
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Расширенная информация */}
                  {isExpanded && (
                    <tr className="expanded-row">
                      <td colSpan="10">
                        <div className="expanded-content">
                          <div className="expanded-grid">
                            <div className="expanded-section">
                              <h4>Детали расчета</h4>
                              <div className="calculation-details">
                                <div className="calc-row">
                                  <span>Базовая ставка:</span>
                                  <span>{formatCurrency(payrollItem.base_salary)}</span>
                                </div>
                                {payrollItem.bonuses > 0 && (
                                  <div className="calc-row">
                                    <span>Премии:</span>
                                    <span className="positive">+{formatCurrency(payrollItem.bonuses)}</span>
                                  </div>
                                )}
                                {payrollItem.allowances > 0 && (
                                  <div className="calc-row">
                                    <span>Надбавки:</span>
                                    <span className="positive">+{formatCurrency(payrollItem.allowances)}</span>
                                  </div>
                                )}
                                {payrollItem.overtime_pay > 0 && (
                                  <div className="calc-row">
                                    <span>Сверхурочные:</span>
                                    <span className="positive">+{formatCurrency(payrollItem.overtime_pay)}</span>
                                  </div>
                                )}
                                <div className="calc-divider"></div>
                                <div className="calc-row total">
                                  <span>Начислено:</span>
                                  <span>{formatCurrency(grossAmount)}</span>
                                </div>
                                {deductions > 0 && (
                                  <>
                                    <div className="calc-row">
                                      <span>Удержания:</span>
                                      <span className="negative">-{formatCurrency(deductions)}</span>
                                    </div>
                                    <div className="calc-divider"></div>
                                  </>
                                )}
                                <div className="calc-row final">
                                  <span>К выплате:</span>
                                  <span>{formatCurrency(netAmount)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="expanded-section">
                              <h4>Дополнительная информация</h4>
                              <div className="info-details">
                                <div className="info-row">
                                  <span>ID записи:</span>
                                  <span className="mono">{payrollItem.id.slice(0, 8)}...</span>
                                </div>
                                <div className="info-row">
                                  <span>Создано:</span>
                                  <span>{formatDate(payrollItem.created_at)}</span>
                                </div>
                                <div className="info-row">
                                  <span>Обновлено:</span>
                                  <span>{formatDate(payrollItem.updated_at)}</span>
                                </div>
                                {payrollItem.notes && (
                                  <div className="info-row">
                                    <span>Примечания:</span>
                                    <span>{payrollItem.notes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination можно добавить здесь */}
      <div className="table-footer">
        <div className="table-info">
          Показано {payrolls.length} записей
        </div>
      </div>
    </div>
  );
};

export default PayrollTable;