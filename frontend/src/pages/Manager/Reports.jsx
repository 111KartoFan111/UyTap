import { useState, useEffect } from 'react';
import { FiDownload, FiCalendar, FiUsers, FiTrendingUp, FiDollarSign, FiHome, FiBarChart2, FiRefreshCw } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import { debugExport } from '../../utils/exportDebug';
import './Pages.css';

const Reports = () => {
  const { reports, utils } = useData();
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [reportsData, setReportsData] = useState({
    financialSummary: null,
    propertyOccupancy: null,
    clientAnalytics: null,
    employeePerformance: null
  });
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState({});

  // Устанавливаем даты по умолчанию (последние 30 дней)
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    setDateRange({
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    });
  }, []);

  // Загружаем данные при изменении диапазона дат
  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      loadReportsData();
    }
  }, [dateRange]);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      
      const startDateTime = dateRange.start + 'T00:00:00';
      const endDateTime = dateRange.end + 'T23:59:59';

      // Загружаем все отчеты параллельно
      const [
        financialData,
        occupancyData,
        clientData,
        performanceData
      ] = await Promise.allSettled([
        reports.getFinancialSummary(startDateTime, endDateTime),
        reports.getPropertyOccupancy(startDateTime, endDateTime),
        reports.getClientAnalytics(startDateTime, endDateTime),
        reports.getEmployeePerformance(startDateTime, endDateTime)
      ]);

      setReportsData({
        financialSummary: financialData.status === 'fulfilled' ? financialData.value : null,
        propertyOccupancy: occupancyData.status === 'fulfilled' ? occupancyData.value : null,
        clientAnalytics: clientData.status === 'fulfilled' ? clientData.value : null,
        employeePerformance: performanceData.status === 'fulfilled' ? performanceData.value : null
      });

      // Показываем информацию об ошибках, если они есть
      const errors = [financialData, occupancyData, clientData, performanceData]
        .filter(result => result.status === 'rejected')
        .map(result => result.reason.message);
      
      if (errors.length > 0) {
        console.warn('Some reports failed to load:', errors);
        utils.showWarning(`Не удалось загрузить некоторые отчеты: ${errors.join(', ')}`);
      }

    } catch (error) {
      console.error('Failed to load reports data:', error);
      utils.showError('Не удалось загрузить данные отчетов');
    } finally {
      setLoading(false);
    }
  };

  // Функция для отладки данных отчетов
  const handleDebugReports = async () => {
    try {
      const startDateTime = dateRange.start + 'T00:00:00';
      const endDateTime = dateRange.end + 'T23:59:59';
      
      console.log('=== ОТЛАДКА ДАННЫХ ОТЧЕТОВ ===');
      
      // Получаем отладочную информацию через прямой API вызов
      const { reportsAPI } = await import('../../services/api');
      const debugData = await reportsAPI.debugDataSources(startDateTime, endDateTime);
      console.log('Debug data sources:', debugData);
      
      // Показываем информацию пользователю
      const message = `
Период отчета: ${debugData.report_period.start_date.split('T')[0]} - ${debugData.report_period.end_date.split('T')[0]}
Продолжительность: ${debugData.report_period.duration_days} дней

Данные в системе:
- Пользователи: ${debugData.data_sources.users?.count || 0}
- Аренды за период: ${debugData.data_sources.rentals?.count || 0}
- Выполненные задачи: ${debugData.data_sources.tasks?.count || 0}
- Зарплаты за период: ${debugData.data_sources.payrolls?.count || 0}
- Выплаченные зарплаты: ${debugData.data_sources.payrolls?.paid_count || 0}
- Общая сумма выплат: ₸ ${debugData.data_sources.payrolls?.total_paid_amount?.toLocaleString() || 0}
- Клиенты: ${debugData.data_sources.clients?.count || 0}
- Помещения: ${debugData.data_sources.properties?.count || 0}

Проблемы:
${debugData.data_sources.payrolls?.count === 0 ? '⚠️ Нет зарплат за выбранный период' : ''}
${debugData.data_sources.payrolls?.paid_count === 0 ? '⚠️ Нет выплаченных зарплат' : ''}
${debugData.data_sources.rentals?.count === 0 ? '⚠️ Нет аренд за период' : ''}
      `.trim();
      
      alert(message);
      
      // Если есть проблемы с зарплатами, показываем детали по каждому сотруднику
      if (reportsData.employeePerformance && reportsData.employeePerformance.length > 0) {
        for (const emp of reportsData.employeePerformance) {
          if (emp.earnings === 0) {
            console.log(`Debugging employee ${emp.user_name}...`);
            try {
              const empDebug = await reportsAPI.debugEmployeeEarnings(emp.user_id, startDateTime, endDateTime);
              console.log(`Employee debug for ${emp.user_name}:`, empDebug);
            } catch (error) {
              console.error(`Failed to debug employee ${emp.user_name}:`, error);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Debug failed:', error);
      utils.showError('Не удалось получить отладочную информацию');
    }
  };

  // Универсальная функция для экспорта с улучшенной отладкой
  const handleExport = async (reportType, format = 'xlsx') => {
    const exportKey = `${reportType}_${format}`;
    
    try {
      setExportLoading(prev => ({ ...prev, [exportKey]: true }));
      
      const startDateTime = dateRange.start + 'T00:00:00';
      const endDateTime = dateRange.end + 'T23:59:59';

      console.log(`Starting export: ${reportType} (${format})`);
      console.log('Date range:', { startDateTime, endDateTime });

      let blob;
      let filename;
      
      switch (reportType) {
        case 'financial':
          blob = await reports.exportFinancialSummary(startDateTime, endDateTime, format);
          filename = `financial_report_${dateRange.start}_${dateRange.end}.${format}`;
          break;
          
        case 'property_occupancy':
          blob = await reports.exportPropertyOccupancy(startDateTime, endDateTime, null, format);
          filename = `property_occupancy_${dateRange.start}_${dateRange.end}.${format}`;
          break;
          
        case 'client_analytics':
          blob = await reports.exportClientAnalytics(startDateTime, endDateTime, format);
          filename = `client_analytics_${dateRange.start}_${dateRange.end}.${format}`;
          break;
          
        case 'employee_performance':
          blob = await reports.exportEmployeePerformance(startDateTime, endDateTime, null, null, format);
          filename = `employee_performance_${dateRange.start}_${dateRange.end}.${format}`;
          break;
          
        case 'general_statistics':
          // Импортируем API напрямую для новых методов
          const { reportsAPI } = await import('../../services/api');
          blob = await reportsAPI.exportGeneralStatistics(startDateTime, endDateTime, format);
          filename = `general_statistics_${dateRange.start}_${dateRange.end}.${format}`;
          break;
          
        case 'comparative_analysis':
          const { reportsAPI: reportsAPI2 } = await import('../../services/api');
          blob = await reportsAPI2.exportComparativeAnalysis(startDateTime, endDateTime, format);
          filename = `comparative_analysis_${dateRange.start}_${dateRange.end}.${format}`;
          break;
          
        default:
          throw new Error('Неподдерживаемый тип отчета');
      }

      // Проверяем blob с помощью отладочной утилиты
      if (!blob || blob.size === 0) {
        console.error('Received empty blob');
        throw new Error('Получен пустой файл');
      }

      // Логируем информацию о файле
      debugExport.logBlobInfo(blob, filename);
      
      // Проверяем MIME тип
      debugExport.validateMimeType(blob);

      // Используем улучшенную функцию скачивания
      const downloadSuccess = debugExport.downloadBlob(blob, filename);
      
      if (!downloadSuccess) {
        throw new Error('Не удалось скачать файл');
      }
      
      utils.showSuccess('Отчет успешно скачан');
      
    } catch (error) {
      console.error('Export failed:', error);
      
      let errorMessage = 'Не удалось экспортировать отчет';
      if (error.message) {
        if (error.message.includes('404')) {
          errorMessage = 'Эндпоинт экспорта не найден. Проверьте, что бэкенд поддерживает экспорт.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Ошибка сервера при генерации отчета. Попробуйте позже.';
        } else if (error.message.includes('403')) {
          errorMessage = 'Нет прав для экспорта отчетов';
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      utils.showError(errorMessage);
      
      // Дополнительная информация для отладки
      console.log('Error details:', {
        reportType,
        format,
        dateRange,
        error: error.message,
        stack: error.stack
      });
    } finally {
      setExportLoading(prev => ({ ...prev, [exportKey]: false }));
    }
  };

  const formatCurrency = (amount) => {
    return amount ? `₸ ${amount.toLocaleString()}` : '₸ 0';
  };

  const formatPercentage = (value) => {
    return value ? `${Math.round(value)}%` : '0%';
  };

  const isExportLoading = (reportType, format = 'xlsx') => {
    return exportLoading[`${reportType}_${format}`] || false;
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Отчеты и аналитика</h1>
        <div className="header-controls">
          <div className="date-range-picker">
            <input 
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              disabled={loading}
            />
            <span>—</span>
            <input 
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              disabled={loading}
            />
          </div>
          {process.env.NODE_ENV === 'development' && (
            <button 
              className="btn-outline debug-btn"
              onClick={handleDebugReports}
              disabled={loading}
              title="Отладка данных отчетов"
              style={{ backgroundColor: '#ff6b6b', color: 'white', border: '1px solid #ff5252' }}
            >
              🐛 Debug
            </button>
          )}
          <button 
            className="btn-outline"
            onClick={loadReportsData}
            disabled={loading}
          >
            <FiRefreshCw className={loading ? 'spinning' : ''} />
            Обновить
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Загрузка отчетов...</p>
        </div>
      )}

      {!loading && (
        <div className="reports-grid">
          {/* Финансовый отчет */}
          <div className="report-card">
            <div className="report-icon">
              <FiDollarSign />
            </div>
            <h3>Финансовый отчет</h3>
            <p>Доходы и расходы за период</p>
            {reportsData.financialSummary ? (
              <div className="report-preview">
                <span>Выручка: {formatCurrency(reportsData.financialSummary.total_revenue)}</span>
                <span>Расходы: {formatCurrency(reportsData.financialSummary.total_expenses)}</span>
                <span>Прибыль: {formatCurrency(reportsData.financialSummary.net_profit)}</span>
                <span>Аренда: {formatCurrency(reportsData.financialSummary.rental_revenue)}</span>
              </div>
            ) : (
              <div className="report-preview">
                <span>Нет данных за выбранный период</span>
              </div>
            )}
            <div className="export-buttons">
              <button 
                className="btn-outline"
                onClick={() => handleExport('financial', 'xlsx')}
                disabled={!reportsData.financialSummary || isExportLoading('financial', 'xlsx')}
              >
                {isExportLoading('financial', 'xlsx') ? <FiRefreshCw className="spinning" /> : <FiDownload />}
                {isExportLoading('financial', 'xlsx') ? 'Экспорт...' : 'Excel'}
              </button>
              <button 
                className="btn-outline"
                onClick={() => handleExport('financial', 'pdf')}
                disabled={!reportsData.financialSummary || isExportLoading('financial', 'pdf')}
              >
                {isExportLoading('financial', 'pdf') ? <FiRefreshCw className="spinning" /> : <FiDownload />}
                {isExportLoading('financial', 'pdf') ? 'Экспорт...' : 'PDF'}
              </button>
            </div>
          </div>

          {/* Загруженность помещений */}
          <div className="report-card">
            <div className="report-icon">
              <FiHome />
            </div>
            <h3>Загруженность помещений</h3>
            <p>Анализ занятости помещений</p>
            {reportsData.propertyOccupancy && reportsData.propertyOccupancy.length > 0 ? (
              <div className="report-preview">
                <span>Всего помещений: {reportsData.propertyOccupancy.length}</span>
                <span>Средняя загруженность: {formatPercentage(
                  reportsData.propertyOccupancy.reduce((acc, prop) => acc + prop.occupancy_rate, 0) / reportsData.propertyOccupancy.length
                )}</span>
                <span>Общая выручка: {formatCurrency(
                  reportsData.propertyOccupancy.reduce((acc, prop) => acc + prop.revenue, 0)
                )}</span>
              </div>
            ) : (
              <div className="report-preview">
                <span>Нет данных за выбранный период</span>
              </div>
            )}
            <div className="export-buttons">
              <button 
                className="btn-outline"
                onClick={() => handleExport('property_occupancy', 'xlsx')}
                disabled={!reportsData.propertyOccupancy || isExportLoading('property_occupancy', 'xlsx')}
              >
                {isExportLoading('property_occupancy', 'xlsx') ? <FiRefreshCw className="spinning" /> : <FiDownload />}
                {isExportLoading('property_occupancy', 'xlsx') ? 'Экспорт...' : 'Excel'}
              </button>
            </div>
          </div>

          {/* Клиентская аналитика */}
          <div className="report-card">
            <div className="report-icon">
              <FiUsers />
            </div>
            <h3>Клиентская аналитика</h3>
            <p>Статистика по клиентам</p>
            {reportsData.clientAnalytics ? (
              <div className="report-preview">
                <span>Всего клиентов: {reportsData.clientAnalytics.total_clients}</span>
                <span>Новые клиенты: {reportsData.clientAnalytics.new_clients}</span>
                <span>Постоянные клиенты: {reportsData.clientAnalytics.returning_clients}</span>
                <span>Средний чек: {formatCurrency(reportsData.clientAnalytics.average_spending)}</span>
              </div>
            ) : (
              <div className="report-preview">
                <span>Нет данных за выбранный период</span>
              </div>
            )}
            <div className="export-buttons">
              <button 
                className="btn-outline"
                onClick={() => handleExport('client_analytics', 'xlsx')}
                disabled={!reportsData.clientAnalytics || isExportLoading('client_analytics', 'xlsx')}
              >
                {isExportLoading('client_analytics', 'xlsx') ? <FiRefreshCw className="spinning" /> : <FiDownload />}
                {isExportLoading('client_analytics', 'xlsx') ? 'Экспорт...' : 'Excel'}
              </button>
            </div>
          </div>

          {/* Производительность сотрудников */}
          <div className="report-card">
            <div className="report-icon">
              <FiBarChart2 />
            </div>
            <h3>Производительность сотрудников</h3>
            <p>Статистика работы персонала</p>
            {reportsData.employeePerformance && reportsData.employeePerformance.length > 0 ? (
              <div className="report-preview">
                <span>Активных сотрудников: {reportsData.employeePerformance.length}</span>
                <span>Выполнено задач: {reportsData.employeePerformance.reduce((acc, emp) => acc + emp.tasks_completed, 0)}</span>
                <span>Средняя оценка: {(
                  reportsData.employeePerformance.reduce((acc, emp) => acc + (emp.quality_rating || 0), 0) / 
                  reportsData.employeePerformance.filter(emp => emp.quality_rating).length || 0
                ).toFixed(1)}</span>
                <span>Общие выплаты: {formatCurrency(
                  reportsData.employeePerformance.reduce((acc, emp) => acc + emp.earnings, 0)
                )}</span>
              </div>
            ) : (
              <div className="report-preview">
                <span>Нет данных за выбранный период</span>
              </div>
            )}
            <div className="export-buttons">
              <button 
                className="btn-outline"
                onClick={() => handleExport('employee_performance', 'xlsx')}
                disabled={!reportsData.employeePerformance || isExportLoading('employee_performance', 'xlsx')}
              >
                {isExportLoading('employee_performance', 'xlsx') ? <FiRefreshCw className="spinning" /> : <FiDownload />}
                {isExportLoading('employee_performance', 'xlsx') ? 'Экспорт...' : 'Excel'}
              </button>
            </div>
          </div>

          {/* Общая статистика */}
          <div className="report-card">
            <div className="report-icon">
              <FiTrendingUp />
            </div>
            <h3>Общая статистика</h3>
            <p>Сводная информация по всем показателям</p>
            <div className="report-preview">
              {reportsData.financialSummary && (
                <>
                  <span>Рентабельность: {formatPercentage(
                    (reportsData.financialSummary.net_profit / reportsData.financialSummary.total_revenue) * 100
                  )}</span>
                  <span>Активных аренд: {reportsData.financialSummary.active_rentals}</span>
                  <span>Загруженность: {formatPercentage(reportsData.financialSummary.occupancy_rate)}</span>
                </>
              )}
              {!reportsData.financialSummary && (
                <span>Нет данных за выбранный период</span>
              )}
            </div>
            <div className="export-buttons">
              <button 
                className="btn-outline"
                onClick={() => handleExport('general_statistics', 'xlsx')}
                disabled={!reportsData.financialSummary || isExportLoading('general_statistics', 'xlsx')}
              >
                {isExportLoading('general_statistics', 'xlsx') ? <FiRefreshCw className="spinning" /> : <FiDownload />}
                {isExportLoading('general_statistics', 'xlsx') ? 'Экспорт...' : 'Скачать'}
              </button>
            </div>
          </div>

          {/* Сравнительная аналитика */}
          <div className="report-card">
            <div className="report-icon">
              <FiCalendar />
            </div>
            <h3>Сравнительная аналитика</h3>
            <p>Сравнение с предыдущими периодами</p>
            <div className="report-preview">
              <span>Динамика доходов: В разработке</span>
              <span>Рост клиентской базы: В разработке</span>
              <span>Эффективность персонала: В разработке</span>
              <span>Сезонные тренды: В разработке</span>
            </div>
            <div className="export-buttons">
              <button 
                className="btn-outline"
                onClick={() => handleExport('comparative_analysis', 'xlsx')}
                disabled={!reportsData.financialSummary || isExportLoading('comparative_analysis', 'xlsx')}
              >
                {isExportLoading('comparative_analysis', 'xlsx') ? <FiRefreshCw className="spinning" /> : <FiDownload />}
                {isExportLoading('comparative_analysis', 'xlsx') ? 'Экспорт...' : 'Скачать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && (!dateRange.start || !dateRange.end) && (
        <div className="empty-state">
          <FiCalendar size={48} />
          <h3>Выберите период для отчета</h3>
          <p>Укажите начальную и конечную дату для генерации отчетов</p>
        </div>
      )}
    </div>
  );
};

export default Reports;