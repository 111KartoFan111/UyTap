import { useState, useEffect } from 'react';
import { FiDownload, FiCalendar, FiUsers, FiTrendingUp, FiDollarSign, FiHome, FiBarChart2 } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
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

    } catch (error) {
      console.error('Failed to load reports data:', error);
      utils.showError('Не удалось загрузить данные отчетов');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (reportType, format = 'xlsx') => {
    try {
      const startDateTime = dateRange.start + 'T00:00:00';
      const endDateTime = dateRange.end + 'T23:59:59';

      let blob;
      switch (reportType) {
        case 'financial':
          blob = await reports.exportFinancialSummary(startDateTime, endDateTime, format);
          break;
        default:
          utils.showWarning('Экспорт для этого отчета пока не доступен');
          return;
      }

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report_${dateRange.start}_${dateRange.end}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      utils.showSuccess('Отчет успешно экспортирован');
    } catch (error) {
      console.error('Failed to export report:', error);
      utils.showError('Не удалось экспортировать отчет');
    }
  };

  const formatCurrency = (amount) => {
    return amount ? `₸ ${amount.toLocaleString()}` : '₸ 0';
  };

  const formatPercentage = (value) => {
    return value ? `${Math.round(value)}%` : '0%';
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Отчеты и аналитика</h1>
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
            <button 
              className="btn-outline"
              onClick={() => handleExport('financial', 'xlsx')}
              disabled={!reportsData.financialSummary}
            >
              <FiDownload /> Скачать
            </button>
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
            <button 
              className="btn-outline"
              onClick={() => utils.showInfo('Экспорт отчета по загруженности будет добавлен в следующей версии')}
            >
              <FiDownload /> Скачать
            </button>
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
            <button 
              className="btn-outline"
              onClick={() => utils.showInfo('Экспорт клиентской аналитики будет добавлен в следующей версии')}
            >
              <FiDownload /> Скачать
            </button>
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
            <button 
              className="btn-outline"
              onClick={() => utils.showInfo('Экспорт отчета по производительности будет добавлен в следующей версии')}
            >
              <FiDownload /> Скачать
            </button>
          </div>

          {/* Детальная аналитика */}
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
            <button 
              className="btn-outline"
              onClick={() => utils.showInfo('Комплексный отчет будет добавлен в следующей версии')}
            >
              <FiDownload /> Скачать
            </button>
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
            <button 
              className="btn-outline"
              onClick={() => utils.showInfo('Сравнительная аналитика будет добавлена в следующей версии')}
              disabled
            >
              <FiDownload /> Скачать
            </button>
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