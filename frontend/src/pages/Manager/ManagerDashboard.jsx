// frontend/src/pages/Manager/ManagerDashboard.jsx
import { useState, useEffect } from 'react';
import { 
  FiHome, 
  FiUsers, 
  FiDollarSign, 
  FiBarChart2,
  FiAlertCircle,
  FiTrendingUp,
  FiCalendar,
  FiArrowRight
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import FloorPlan from './Floor/FloorPlan';
import './ManagerDashboard.css';

const ManagerDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { 
    properties, 
    clients, 
    rentals, 
    reports,
    loading, 
    error, 
    utils 
  } = useData();
  
  const [stats, setStats] = useState({
    totalRooms: 0,
    occupiedRooms: 0,
    availableRooms: 0,
    maintenanceRooms: 0,
    totalClients: 0,
    activeRentals: 0,
    monthlyRevenue: 0,
    occupancyRate: 0
  });

  const [recentActivities, setRecentActivities] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    properties: [],
    clientsList: [],
    rentalsList: [],
    financialSummary: null
  });

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      console.log('Loading dashboard data...');
      
      // Load all data in parallel
      const [propertiesData, clientsData, rentalsData] = await Promise.allSettled([
        properties.getAll(),
        clients.getAll({ limit: 50 }),
        rentals.getAll({ is_active: true })
      ]);

      console.log('Data loaded:', { propertiesData, clientsData, rentalsData });

      // Extract successful results or fallback to empty arrays
      const propsList = propertiesData.status === 'fulfilled' ? propertiesData.value : [];
      const clientsList = clientsData.status === 'fulfilled' ? clientsData.value : [];
      const rentalsList = rentalsData.status === 'fulfilled' ? rentalsData.value : [];

      // Try to load financial data (optional)
      let financialData = null;
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        financialData = await reports.getFinancialSummary(startDate, endDate);
      } catch (error) {
        console.warn('Failed to load financial data:', error.message);
      }

      setDashboardData({
        properties: propsList,
        clientsList: clientsList,
        rentalsList: rentalsList,
        financialSummary: financialData
      });

      // Calculate stats from loaded data
      calculateStats(propsList, clientsList, rentalsList, financialData);
      generateActivities(rentalsList);

      console.log('Dashboard data updated successfully');

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      utils.showError('Ошибка загрузки данных дашборда');
    }
  };

  const calculateStats = (propertiesData, clientsData, rentalsData, financialData) => {
    // Count properties by status
    const statusCounts = propertiesData.reduce((acc, prop) => {
      acc[prop.status] = (acc[prop.status] || 0) + 1;
      return acc;
    }, {});

    const occupancyRate = propertiesData.length > 0 
      ? Math.round((statusCounts.occupied || 0) / propertiesData.length * 100) 
      : 0;

    setStats({
      totalRooms: propertiesData.length,
      occupiedRooms: statusCounts.occupied || 0,
      availableRooms: statusCounts.available || 0,
      maintenanceRooms: statusCounts.maintenance || 0,
      totalClients: clientsData.length,
      activeRentals: rentalsData.length,
      monthlyRevenue: financialData?.total_revenue || 0,
      occupancyRate: occupancyRate
    });
  };

  const generateActivities = (rentalsData) => {
    const activities = rentalsData
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map((rental) => ({
        id: rental.id,
        type: rental.checked_in ? 'rental_active' : 'rental_started',
        client: rental.client 
          ? `${rental.client.first_name} ${rental.client.last_name}`.trim() 
          : 'Клиент',
        room: rental.property?.number || rental.property_id,
        time: new Date(rental.created_at).toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        amount: rental.total_amount,
        date: new Date(rental.created_at).toLocaleDateString('ru-RU')
      }));
    
    setRecentActivities(activities);
  };

  // Handle room click from floor plan
  const handleRoomClick = (room) => {
    console.log('Room clicked:', room);
    // You can navigate to room details or open a modal
  };

  if (loading && !dashboardData.properties.length) {
    return (
      <div className="manager-dashboard loading">
        <div className="loading-spinner"></div>
        <p>Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      <div className="manager-header">
        <h1>Управление арендой</h1>
        <div className="user-info">
          <span>Привет, {user?.first_name || 'Менеджер'}!</span>
          <button 
            className="refresh-btn"
            onClick={loadDashboardData}
            disabled={loading}
            title="Обновить данные"
          >
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={utils.clearError}>×</button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon rooms-icon">
            <FiHome />
          </div>
          <div className="stat-content">
            <h3>Помещения</h3>
            <div className="stat-number">{stats.occupiedRooms}/{stats.totalRooms}</div>
            <div className="stat-label">Занято</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon clients-icon">
            <FiUsers />
          </div>
          <div className="stat-content">
            <h3>Клиенты</h3>
            <div className="stat-number">{stats.totalClients}</div>
            <div className="stat-label">Всего</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon revenue-icon">
            <FiDollarSign />
          </div>
          <div className="stat-content">
            <h3>Выручка</h3>
            <div className="stat-number">₸ {stats.monthlyRevenue.toLocaleString()}</div>
            <div className="stat-label">За месяц</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon occupancy-icon">
            <FiBarChart2 />
          </div>
          <div className="stat-content">
            <h3>Загруженность</h3>
            <div className="stat-number">{stats.occupancyRate}%</div>
            <div className="stat-label">Средняя</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Быстрые действия</h2>
        <div className="actions-grid">
          <Link to="/manager/floor-plan" className="action-card">
            <div className="action-icon">
              <FiHome />
            </div>
            <h3>План этажа</h3>
            <p>Просмотр состояния всех помещений</p>
            <div className="action-arrow">
              <FiArrowRight />
            </div>
          </Link>

          <Link to="/manager/rentals" className="action-card">
            <div className="action-icon">
              <FiCalendar />
            </div>
            <h3>Аренда</h3>
            <p>Управление арендами и бронированиями</p>
            <div className="action-arrow">
              <FiArrowRight />
            </div>
          </Link>

          <Link to="/manager/clients" className="action-card">
            <div className="action-icon">
              <FiUsers />
            </div>
            <h3>Клиенты</h3>
            <p>База клиентов и их история</p>
            <div className="action-arrow">
              <FiArrowRight />
            </div>
          </Link>

          <Link to="/manager/reports" className="action-card">
            <div className="action-icon">
              <FiTrendingUp />
            </div>
            <h3>Отчеты</h3>
            <p>Аналитика и финансовые отчеты</p>
            <div className="action-arrow">
              <FiArrowRight />
            </div>
          </Link>
        </div>
      </div>

      {/* Floor Plan Preview */}
      <div className="floor-plan-preview">
        <div className="section-header">
          <h2>Текущее состояние помещений</h2>
          <Link to="/manager/floor-plan" className="view-all-link">
            Подробный план <FiArrowRight />
          </Link>
        </div>
        <FloorPlan 
          properties={dashboardData.properties} 
          onRoomClick={handleRoomClick}
          compact={true} 
        />
      </div>

      {/* Recent Activities */}
      <div className="recent-activities">
        <div className="section-header">
          <h3>Последние события</h3>
          <Link to="/manager/rentals" className="view-all-link">
            Все аренды <FiArrowRight />
          </Link>
        </div>
        
        <div className="activities-list">
          {recentActivities.length > 0 ? (
            recentActivities.map(activity => (
              <div key={activity.id} className="activity-item">
                <div className="activity-time">
                  <span className="time">{activity.time}</span>
                  <span className="date">{activity.date}</span>
                </div>
                <div className="activity-content">
                  {activity.type === 'rental_started' && (
                    <span>
                      Начата аренда: <strong>{activity.client}</strong> в комнате <strong>{activity.room}</strong>
                    </span>
                  )}
                  {activity.type === 'rental_active' && (
                    <span>
                      Активная аренда: <strong>{activity.client}</strong> в комнате <strong>{activity.room}</strong>
                    </span>
                  )}
                </div>
                {activity.amount && (
                  <div className="activity-amount">₸ {activity.amount.toLocaleString()}</div>
                )}
              </div>
            ))
          ) : (
            <div className="no-activities">
              <p>Нет последних событий</p>
              <Link to="/manager/rentals" className="btn-outline">
                Создать аренду
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;