// frontend/src/pages/Accountant/AccountantDashboard.jsx
import { useState, useEffect } from 'react';
import { 
  FiDollarSign, 
  FiTrendingUp, 
  FiFileText,
  FiPieChart,
  FiCalendar,
  FiDownload
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const AccountantDashboard = () => {
  const { user } = useAuth();
  const [financialData, setFinancialData] = useState({
    monthlyRevenue: 2450000,
    expenses: 850000,
    profit: 1600000,
    unpaidInvoices: 340000
  });

  return (
    <div className="accountant-dashboard">
      <div className="dashboard-header">
        <h1>Финансовая отчетность</h1>
        <div className="user-greeting">Привет, {user.first_name}!</div>
      </div>

      <div className="financial-stats">
        <div className="stat-card revenue">
          <FiDollarSign />
          <div>
            <h3>Выручка за месяц</h3>
            <div className="amount">₸ {financialData.monthlyRevenue.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="stat-card expenses">
          <FiTrendingUp />
          <div>
            <h3>Расходы</h3>
            <div className="amount">₸ {financialData.expenses.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="stat-card profit">
          <FiPieChart />
          <div>
            <h3>Прибыль</h3>
            <div className="amount">₸ {financialData.profit.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="stat-card unpaid">
          <FiFileText />
          <div>
            <h3>К получению</h3>
            <div className="amount">₸ {financialData.unpaidInvoices.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="reports-section">
        <h2>Отчеты и документы</h2>
        <div className="reports-grid">
          <div className="report-card">
            <h3>Финансовый отчет</h3>
            <p>Доходы и расходы за период</p>
            <button><FiDownload /> Скачать</button>
          </div>
          
          <div className="report-card">
            <h3>Налоговая отчетность</h3>
            <p>НДС, подоходный налог</p>
            <button><FiDownload /> Скачать</button>
          </div>
          
          <div className="report-card">
            <h3>Счета-фактуры</h3>
            <p>ЭСФ и ЭАВР</p>
            <button><FiFileText /> Управление</button>
          </div>
          
          <div className="report-card">
            <h3>Расчет зарплаты</h3>
            <p>Ведомость по сотрудникам</p>
            <button><FiCalendar /> Открыть</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountantDashboard;