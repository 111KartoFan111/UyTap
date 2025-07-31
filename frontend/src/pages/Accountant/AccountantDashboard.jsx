// frontend/src/pages/Accountant/AccountantDashboard.jsx
import { useState, useEffect } from 'react';
import { 
  FiDollarSign, 
  FiTrendingUp, 
  FiTrendingDown, 
  FiFileText,
  FiCalendar,
  FiCreditCard,
  FiPieChart,
  FiBarChart,
  FiUser,
  FiMapPin,
  FiCheck,
  FiAlertCircle
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import '../TechnicalStaff/TechnicalStaffDashboard.css'; // Используем те же стили

const AccountantDashboard = () => {
  const { user } = useAuth();
  const { reports, rentals, utils } = useData();
  
  const [financialData, setFinancialData] = useState({
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    netProfit: 0,
    pendingPayments: 0,
    paidRentals: 0,
    unpaidRentals: 0
  });
  
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinancialData();
    loadRecentTransactions();
    loadPendingPayments();
  }, []);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      
      // Получаем финансовые данные за текущий месяц
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const financialSummary = await reports.getFinancialSummary(
        startOfMonth.toISOString(),
        endOfMonth.toISOString()
      );
      
      setFinancialData({
        monthlyRevenue: financialSummary.total_revenue || 0,
        monthlyExpenses: financialSummary.total_expenses || 0,
        netProfit: financialSummary.net_profit || 0,
        pendingPayments: financialSummary.pending_payments || 0,
        paidRentals: financialSummary.paid_rentals || 0,
        unpaidRentals: financialSummary.unpaid_rentals || 0
      });
    } catch (error) {
      console.error('Error loading financial data:', error);
      utils.showError('Ошибка загрузки финансовых данных');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      // Получаем последние аренды как транзакции
      const recentRentals = await rentals.getAll({ 
        limit: 10, 
        is_active: true 
      });
      
      setRecentTransactions(recentRentals.map(rental => ({
        id: rental.id,
        type: 'rental',
        description: `Аренда ${rental.property?.name || 'Объект'}`,
        amount: rental.total_amount,
        paid_amount: rental.paid_amount,
        client: `${rental.client?.first_name} ${rental.client?.last_name}`,
        date: rental.created_at,
        status: rental.paid_amount >= rental.total_amount ? 'paid' : 'pending'
      })));
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    }
  };

  const loadPendingPayments = async () => {
    try {
      // Получаем неоплаченные аренды
      const unpaidRentals = await rentals.getAll({ 
        limit: 20,
        is_active: true
      });
      
      const pending = unpaidRentals.filter(rental => 
        rental.paid_amount < rental.total_amount
      ).map(rental => ({
        id: rental.id,
        client: `${rental.client?.first_name} ${rental.client?.last_name}`,
        property: rental.property?.name || `Объект ${rental.property_id}`,
        total_amount: rental.total_amount,
        paid_amount: rental.paid_amount,
        remaining: rental.total_amount - rental.paid_amount,
        due_date: rental.end_date,
        overdue: new Date(rental.end_date) < new Date()
      }));
      
      setPendingPayments(pending);
    } catch (error) {
      console.error('Error loading pending payments:', error);
    }
  };

  const formatCurrency = (amount) => {
    return `₸ ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getTransactionIcon = (type, status) => {
    if (status === 'paid') return <FiCheck style={{ color: '#27ae60' }} />;
    if (status === 'pending') return <FiAlertCircle style={{ color: '#f39c12' }} />;
    return <FiDollarSign />;
  };

  if (loading) {
    return (
      <div className="technical-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка финансовых данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="technical-dashboard">
      <div className="technical-header">
        <h1>Финансовая отчетность</h1>
        <div className="user-greeting">
          Привет, {user.first_name}! Контролируем финансы!
        </div>
      </div>

      {/* Финансовая статистика */}
      <div className="daily-stats">
        <div className="stat-card">
          <div className="stat-icon completed" style={{ background: '#27ae60' }}>
            <FiTrendingUp />
          </div>
          <div className="stat-content">
            <h3>Доходы</h3>
            <div className="stat-number">{formatCurrency(financialData.monthlyRevenue)}</div>
            <div className="stat-label">за этот месяц</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon active" style={{ background: '#e74c3c' }}>
            <FiTrendingDown />
          </div>
          <div className="stat-content">
            <h3>Расходы</h3>
            <div className="stat-number">{formatCurrency(financialData.monthlyExpenses)}</div>
            <div className="stat-label">за этот месяц</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon urgent" style={{ 
            background: financialData.netProfit >= 0 ? '#27ae60' : '#e74c3c' 
          }}>
            <FiBarChart />
          </div>
          <div className="stat-content">
            <h3>Прибыль</h3>
            <div className="stat-number">{formatCurrency(financialData.netProfit)}</div>
            <div className="stat-label">чистая прибыль</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon hours" style={{ background: '#f39c12' }}>
            <FiAlertCircle />
          </div>
          <div className="stat-content">
            <h3>К оплате</h3>
            <div className="stat-number">{pendingPayments.length}</div>
            <div className="stat-label">ожидают оплаты</div>
          </div>
        </div>
      </div>

      {/* Ожидающие платежи */}
      {pendingPayments.length > 0 && (
        <div className="urgent-requests">
          <h2>
            <FiAlertCircle />
            Ожидающие оплаты ({pendingPayments.length})
          </h2>
          <div className="requests-grid">
            {pendingPayments.slice(0, 6).map(payment => (
              <div key={payment.id} className={`request-card ${payment.overdue ? 'urgent' : ''}`}>
                <div className="request-header">
                  <div className="request-type">
                    <FiDollarSign style={{ color: payment.overdue ? '#e74c3c' : '#f39c12' }} />
                    <span>Платеж</span>
                  </div>
                  <div className={`priority ${payment.overdue ? 'urgent' : ''}`}>
                    {payment.overdue ? 'ПРОСРОЧЕН' : 'ОЖИДАЕТСЯ'}
                  </div>
                </div>
                
                <h4>{payment.client}</h4>
                <div className="request-details">
                  <div className="request-room">
                    <FiMapPin />
                    {payment.property}
                  </div>
                  <div className="request-client">
                    <FiCreditCard />
                    К доплате: {formatCurrency(payment.remaining)}
                  </div>
                </div>
                
                <div className="request-meta">
                  <div className="request-time">
                    <FiCalendar />
                    Срок: {formatDate(payment.due_date)}
                  </div>
                  <div className="request-created">
                    Всего: {formatCurrency(payment.total_amount)}
                  </div>
                </div>
                
                <div className="request-actions">
                  <button 
                    className={`btn-start ${payment.overdue ? 'urgent' : ''}`}
                    onClick={() => utils.showInfo('Переход к оплате')}
                  >
                    <FiDollarSign /> Принять оплату
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Последние транзакции */}
      <div className="requests-sections">
        <div className="requests-section">
          <h2>Последние транзакции ({recentTransactions.length})</h2>
          <div className="requests-list">
            {recentTransactions.map(transaction => (
              <div key={transaction.id} className="request-card">
                <div className="request-header">
                  <div className="request-type">
                    {getTransactionIcon(transaction.type, transaction.status)}
                    <span>{transaction.description}</span>
                  </div>
                  <div 
                    className="priority"
                    style={{ 
                      color: transaction.status === 'paid' ? '#27ae60' : '#f39c12' 
                    }}
                  >
                    {transaction.status === 'paid' ? 'ОПЛАЧЕНО' : 'ОЖИДАЕТСЯ'}
                  </div>
                </div>
                
                <h4>{formatCurrency(transaction.amount)}</h4>
                <div className="request-details">
                  <div className="request-room">
                    <FiUser />
                    {transaction.client}
                  </div>
                  <div className="request-client">
                    <FiCreditCard />
                    Оплачено: {formatCurrency(transaction.paid_amount)}
                  </div>
                </div>
                
                <div className="request-meta">
                  <div className="request-time">
                    <FiCalendar />
                    {formatDate(transaction.date)}
                  </div>
                  <div className="request-created">
                    Остаток: {formatCurrency(transaction.amount - transaction.paid_amount)}
                  </div>
                </div>
                
                {transaction.status === 'pending' && (
                  <div className="request-actions">
                    <button 
                      className="btn-start"
                      onClick={() => utils.showInfo('Открыть детали платежа')}
                    >
                      <FiFileText /> Детали
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {recentTransactions.length === 0 && (
            <div className="no-tasks">
              <FiPieChart size={48} />
              <h3>Нет транзакций</h3>
              <p>Транзакции появятся здесь по мере поступления.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountantDashboard;