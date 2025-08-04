import React, { useState } from 'react';
import { 
  FiFilter, 
  FiX, 
  FiSearch, 
  FiUser, 
  FiCalendar,
  FiDollarSign,
  FiRefreshCw 
} from 'react-icons/fi';

const PayrollFilters = ({ 
  filters, 
  onFiltersChange, 
  employees, 
  statusOptions,
  onReset,
  onQuickFilter 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tempFilters, setTempFilters] = useState(filters);

  const payrollTypeOptions = [
    { value: 'all', label: 'Все типы' },
    { value: 'monthly_salary', label: 'Месячный оклад' },
    { value: 'hourly', label: 'Почасовая' },
    { value: 'piece_work', label: 'Сдельная' }
  ];

  const roleOptions = [
    { value: 'all', label: 'Все должности' },
    { value: 'admin', label: 'Администратор' },
    { value: 'manager', label: 'Менеджер' },
    { value: 'accountant', label: 'Бухгалтер' },
    { value: 'technical_staff', label: 'Технический персонал' },
    { value: 'cleaner', label: 'Уборщик' },
    { value: 'storekeeper', label: 'Кладовщик' }
  ];

  const amountRanges = [
    { value: 'all', label: 'Любая сумма' },
    { value: '0-200000', label: 'До 200,000 ₸' },
    { value: '200000-400000', label: '200,000 - 400,000 ₸' },
    { value: '400000-600000', label: '400,000 - 600,000 ₸' },
    { value: '600000+', label: 'Свыше 600,000 ₸' }
  ];

  // Быстрые фильтры
  const quickFilters = [
    {
      id: 'false',
      label: 'Не выплачены',
      icon: FiCalendar,
      filter: { status: 'false' }
    },
    {
      id: 'true',
      label: 'Выплачены',
      icon: FiDollarSign,
      filter: { status: 'true' }
    },
    {
      id: 'high-salary',
      label: 'Высокие зарплаты',
      icon: FiUser,
      filter: { amountRange: '600000+' }
    },
    {
      id: 'cleaners',
      label: 'Уборщики',
      icon: FiUser,
      filter: { roleFilter: 'cleaner' }
    }
  ];

  const hasActiveFilters = () => {
    return filters.statusFilter !== 'all' || 
           filters.employeeFilter !== 'all' || 
           filters.payrollType !== 'all' ||
           filters.roleFilter !== 'all' ||
           filters.amountRange !== 'all' ||
           filters.searchTerm;
  };

  const applyFilters = () => {
    onFiltersChange(tempFilters);
    setIsExpanded(false);
  };

  const resetTempFilters = () => {
    const defaultFilters = {
      searchTerm: '',
      status: 'all',
      employeeFilter: 'all',
      payrollType: 'all',
      roleFilter: 'all',
      amountRange: 'all'
    };
    setTempFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const handleQuickFilter = (quickFilter) => {
    const newFilters = { ...filters, ...quickFilter.filter };
    onFiltersChange(newFilters);
    setTempFilters(newFilters);
    if (onQuickFilter) {
      onQuickFilter(quickFilter.id);
    }
  };

  return (
    <div className="payroll-filters">
      {/* Основная строка фильтров */}
      <div className="filters-main">
        <div className="filters-left">
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Поиск по имени или ID сотрудника..."
              value={filters.searchTerm}
              onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
            />
            {filters.searchTerm && (
              <button 
                className="clear-search"
                onClick={() => onFiltersChange({ ...filters, searchTerm: '' })}
              >
                <FiX />
              </button>
            )}
          </div>

          <select 
            className="filter-select"
            value={filters.statusFilter}
            onChange={(e) => onFiltersChange({ ...filters, statusFilter: e.target.value })}
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
            onChange={(e) => onFiltersChange({ ...filters, employeeFilter: e.target.value })}
          >
            <option value="all">Все сотрудники</option>
            {employees.map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>
        </div>

        <div className="filters-right">
          <button 
            className={`filters-toggle ${isExpanded ? 'active' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <FiFilter /> 
            Дополнительные фильтры
            {hasActiveFilters() && (
              <span className="filter-indicator"></span>
            )}
          </button>
          
          {hasActiveFilters() && (
            <button className="btn-text reset-filters" onClick={onReset}>
              <FiX /> Сбросить ({Object.values(filters).filter(v => v && v !== 'all').length})
            </button>
          )}
        </div>
      </div>

      {/* Быстрые фильтры */}
      <div className="quick-filters">
        {quickFilters.map(quickFilter => {
          const IconComponent = quickFilter.icon;
          const isActive = Object.entries(quickFilter.filter).every(
            ([key, value]) => filters[key] === value
          );
          
          return (
            <button
              key={quickFilter.id}
              className={`quick-filter ${isActive ? 'active' : ''}`}
              onClick={() => handleQuickFilter(quickFilter)}
            >
              <IconComponent />
              <span>{quickFilter.label}</span>
            </button>
          );
        })}
      </div>

      {/* Расширенные фильтры */}
      {isExpanded && (
        <div className="filters-expanded">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Тип зарплаты</label>
              <select 
                value={tempFilters.payrollType || 'all'}
                onChange={(e) => setTempFilters({ ...tempFilters, payrollType: e.target.value })}
              >
                {payrollTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Должность</label>
              <select 
                value={tempFilters.roleFilter || 'all'}
                onChange={(e) => setTempFilters({ ...tempFilters, roleFilter: e.target.value })}
              >
                {roleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Диапазон суммы</label>
              <select 
                value={tempFilters.amountRange || 'all'}
                onChange={(e) => setTempFilters({ ...tempFilters, amountRange: e.target.value })}
              >
                {amountRanges.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Дата создания</label>
              <div className="date-range">
                <input 
                  type="date"
                  value={tempFilters.dateFrom || ''}
                  onChange={(e) => setTempFilters({ ...tempFilters, dateFrom: e.target.value })}
                  placeholder="От"
                />
                <span>—</span>
                <input 
                  type="date"
                  value={tempFilters.dateTo || ''}
                  onChange={(e) => setTempFilters({ ...tempFilters, dateTo: e.target.value })}
                  placeholder="До"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Рабочих дней</label>
              <div className="range-input">
                <input 
                  type="number"
                  min="0"
                  max="31"
                  value={tempFilters.minWorkDays || ''}
                  onChange={(e) => setTempFilters({ ...tempFilters, minWorkDays: e.target.value })}
                  placeholder="От"
                />
                <span>—</span>
                <input 
                  type="number"
                  min="0"
                  max="31"
                  value={tempFilters.maxWorkDays || ''}
                  onChange={(e) => setTempFilters({ ...tempFilters, maxWorkDays: e.target.value })}
                  placeholder="До"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Особые условия</label>
              <div className="checkbox-group">
                <label className="checkbox-item">
                  <input 
                    type="checkbox"
                    checked={tempFilters.hasBonus || false}
                    onChange={(e) => setTempFilters({ ...tempFilters, hasBonus: e.target.checked })}
                  />
                  <span>Есть премии</span>
                </label>
                <label className="checkbox-item">
                  <input 
                    type="checkbox"
                    checked={tempFilters.hasOvertime || false}
                    onChange={(e) => setTempFilters({ ...tempFilters, hasOvertime: e.target.checked })}
                  />
                  <span>Есть сверхурочные</span>
                </label>
                <label className="checkbox-item">
                  <input 
                    type="checkbox"
                    checked={tempFilters.hasDeductions || false}
                    onChange={(e) => setTempFilters({ ...tempFilters, hasDeductions: e.target.checked })}
                  />
                  <span>Есть удержания</span>
                </label>
              </div>
            </div>
          </div>

          <div className="filters-actions">
            <button className="btn-secondary" onClick={resetTempFilters}>
              <FiRefreshCw /> Сбросить все
            </button>
            <button className="btn-primary" onClick={applyFilters}>
              <FiFilter /> Применить фильтры
            </button>
          </div>
        </div>
      )}

      {/* Активные фильтры */}
      {hasActiveFilters() && (
        <div className="active-filters">
          <span className="active-filters-label">Активные фильтры:</span>
          <div className="filter-tags">
            {filters.statusFilter !== 'all' && (
              <span className="filter-tag">
                Статус: {statusOptions.find(o => o.value === filters.statusFilter)?.label}
                <button onClick={() => onFiltersChange({ ...filters, statusFilter: 'all' })}>
                  <FiX />
                </button>
              </span>
            )}
            {filters.payrollType !== 'all' && (
              <span className="filter-tag">
                Тип: {payrollTypeOptions.find(o => o.value === filters.payrollType)?.label}
                <button onClick={() => onFiltersChange({ ...filters, payrollType: 'all' })}>
                  <FiX />
                </button>
              </span>
            )}
            {filters.roleFilter !== 'all' && (
              <span className="filter-tag">
                Должность: {roleOptions.find(o => o.value === filters.roleFilter)?.label}
                <button onClick={() => onFiltersChange({ ...filters, roleFilter: 'all' })}>
                  <FiX />
                </button>
              </span>
            )}
            {filters.employeeFilter !== 'all' && (
              <span className="filter-tag">
                Сотрудник: {employees.find(e => e.id === filters.employeeFilter)?.first_name}
                <button onClick={() => onFiltersChange({ ...filters, employeeFilter: 'all' })}>
                  <FiX />
                </button>
              </span>
            )}
            {filters.searchTerm && (
              <span className="filter-tag">
                Поиск: "{filters.searchTerm}"
                <button onClick={() => onFiltersChange({ ...filters, searchTerm: '' })}>
                  <FiX />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollFilters;