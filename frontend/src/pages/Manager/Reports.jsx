import { useState } from 'react';
import { FiDownload, FiCalendar,FiUsers, FiTrendingUp } from 'react-icons/fi';
import './Pages.css';

const Reports = () => {
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Отчеты и аналитика</h1>
        <div className="date-range-picker">
          <input 
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          />
          <span>—</span>
          <input 
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          />
        </div>
      </div>
      
      <div className="reports-grid">
        <div className="report-card">
          <div className="report-icon">
            <FiTrendingUp />
          </div>
          <h3>Финансовый отчет</h3>
          <p>Доходы и расходы за период</p>
          <div className="report-preview">
            <span>Выручка: ₸ 2,450,000</span>
            <span>Прибыль: ₸ 1,200,000</span>
          </div>
          <button className="btn-outline">
            <FiDownload /> Скачать
          </button>
        </div>
        
        <div className="report-card">
          <div className="report-icon">
            <FiCalendar />
          </div>
          <h3>Загруженность</h3>
          <p>Анализ занятости помещений</p>
          <div className="report-preview">
            <span>Средняя загруженность: 78%</span>
            <span>Пиковые дни: выходные</span>
          </div>
          <button className="btn-outline">
            <FiDownload /> Скачать
          </button>
        </div>
        
        <div className="report-card">
          <div className="report-icon">
            <FiUsers />
          </div>
          <h3>Клиентская база</h3>
          <p>Статистика по клиентам</p>
          <div className="report-preview">
            <span>Всего клиентов: 156</span>
            <span>Постоянные: 89</span>
          </div>
          <button className="btn-outline">
            <FiDownload /> Скачать
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;