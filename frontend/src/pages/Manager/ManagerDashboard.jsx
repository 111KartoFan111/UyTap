// frontend/src/pages/Manager/ManagerDashboard.jsx - ОБНОВЛЕННЫЙ
import { useState, useEffect } from 'react';
import { 
  FiHome, 
  FiUsers, 
  FiDollarSign, 
  FiBarChart2,
  FiAlertCircle,
  FiTrendingUp,
  FiCalendar,
  FiArrowRight,
  FiRefreshCw
} from 'react-icons/fi';

import { FaUsersGear } from "react-icons/fa6";
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
    organization,
    loading, 
    error, 
    utils 
  } = useData();
  
  const [stats, setStats] = useState({
    totalRooms: 0,
    occupiedRooms: 0,
    availableRooms: 0,
    maintenanceRooms: 0,
    cleaningRooms: 0,
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
    financialSummary: null,
    organizationStats: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsRefreshing(true);
      console.log('Loading dashboard data...');
      
      // Load data with error handling for each request
      const dataPromises = [
        properties.getAll().catch(err => {
          console.warn('Properties load failed:', err);
          return [];
        }),
        clients.getAll({ limit: 100 }).catch(err => {
          console.warn('Clients load failed:', err);
          return [];
        }),
        rentals.getAll({ is_active: true }).catch(err => {
          console.warn('Rentals load failed:', err);
          return [];
        }),
        organization.getDashboardStatistics().catch(err => {
          console.warn('Organization stats load failed:', err);
          return null;
        })
      ];

      const [
        propertiesData, 
        clientsData, 
        rentalsData, 
        orgStats
      ] = await Promise.all(dataPromises);

      // Try to load financial data (optional)
      let financialData = null;
      try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        financialData = await reports.getFinancialSummary(
          startDate.toISOString(), 
          endDate.toISOString()
        );
      } catch (error) {
        console.warn('Failed to load financial data:', error.message);
        // Create mock financial data if API fails
        financialData = {
          total_revenue: 0,
          rental_revenue: 0,
          orders_revenue: 0,
          total_expenses: 0,
          net_profit: 0,
          occupancy_rate: 0,
          active_rentals: rentalsData.length,
          properties_count: propertiesData.length
        };
      }

      setDashboardData({
        properties: propertiesData,
        clientsList: clientsData,
        rentalsList: rentalsData,
        financialSummary: financialData,
        organizationStats: orgStats
      });

      // Calculate stats from loaded data
      calculateStats(propertiesData, clientsData, rentalsData, financialData);
      generateActivities(rentalsData, propertiesData, clientsData);
      
      setDataLoaded(true);
      console.log('Dashboard data loaded successfully');

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      utils.showError('Ошибка загрузки данных дашборда');
    } finally {
      setIsRefreshing(false);
    }
  };

  const calculateStats = (propertiesData, clientsData, rentalsData, financialData) => {
    // Count properties by status
    const statusCounts = propertiesData.reduce((acc, prop) => {
      const status = prop.status || 'available';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const totalRooms = propertiesData.length;
    const occupiedRooms = statusCounts.occupied || 0;
    const availableRooms = statusCounts.available || 0;
    const maintenanceRooms = statusCounts.maintenance || 0;
    const cleaningRooms = statusCounts.cleaning || 0;

    const occupancyRate = totalRooms > 0 
      ? Math.round((occupiedRooms / totalRooms) * 100) 
      : 0;

    // Calculate monthly revenue from rentals or financial data
    const monthlyRevenue = financialData?.rental_revenue || 
      rentalsData.reduce((total, rental) => total + (rental.paid_amount || 0), 0);

    setStats({
      totalRooms,
      occupiedRooms,
      availableRooms,
      maintenanceRooms,
      cleaningRooms,
      totalClients: clientsData.length,
      activeRentals: rentalsData.length,
      monthlyRevenue,
      occupancyRate
    });
  };

  const generateActivities = (rentalsData, propertiesData, clientsData) => {
    const activities = [];
    
    // Add rental activities
    rentalsData
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .forEach((rental) => {
        const property = propertiesData.find(p => p.id === rental.property_id);
        const client = clientsData.find(c => c.id === rental.client_id);
        
        activities.push({
          id: `rental-${rental.id}`,
          type: rental.checked_in ? 'rental_active' : 'rental_started',
          client: client ? `${client.first_name} ${client.last_name}`.trim() : 'Клиент',
          room: property?.number || rental.property_id,
          time: new Date(rental.created_at).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          amount: rental.total_amount,
          date: new Date(rental.created_at).toLocaleDateString('ru-RU')
        });
      });

    // Add recent client registrations
    clientsData
      .filter(client => {
        const createdAt = new Date(client.created_at);
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        return createdAt > threeDaysAgo;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 2)
      .forEach((client) => {
        activities.push({
          id: `client-${client.id}`,
          type: 'client_registered',
          client: `${client.first_name} ${client.last_name}`.trim(),
          time: new Date(client.created_at).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          date: new Date(client.created_at).toLocaleDateString('ru-RU')
        });
      });

    // Sort all activities by date
    activities.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateB - dateA;
    });
    
    setRecentActivities(activities.slice(0, 8));
  };

  // Handle room click from floor plan
  const handleRoomClick = (room) => {
    console.log('Room clicked:', room);
    // You can navigate to room details or open a modal
  };

  // Handle refresh
  const handleRefresh = async () => {
    await loadDashboardData();
  };

  // Show loading state only on initial load
  if (loading && !dataLoaded) {
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
            className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Обновить данные"
          >
            <FiRefreshCw className={isRefreshing ? 'spinning' : ''} />
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
        <div className="stats-card">
          <div className="stat-icon rooms-icon">
            <FiHome />
          </div>
          <div className="stat-content">
            <h3>Помещения</h3>
            <div className="stat-number">{stats.occupiedRooms}/{stats.totalRooms}</div>
            <div className="stat-label">Занято</div>
          </div>
        </div>
        
        <div className="stats-card">
          <div className="stat-icon clients-icon">
            <FiUsers />
          </div>
          <div className="stat-content">
            <h3>Клиенты</h3>
            <div className="stat-number">{stats.totalClients}</div>
            <div className="stat-label">Всего</div>
          </div>
        </div>
        
        <div className="stats-card">
          <div className="stat-icon revenue-icon">
            <FiDollarSign />
          </div>
          <div className="stat-content">
            <h3>Выручка</h3>
            <div className="stat-number">₸ {stats.monthlyRevenue.toLocaleString()}</div>
            <div className="stat-label">За месяц</div>
          </div>
        </div>
        
        <div className="stats-card">
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
      <div className="quick-actions1">
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

          <Link to="/manager/staff" className="action-card">
            <div className="action-icon">
              <FaUsersGear />
            </div>
            <h3>Персонал</h3>
            <p>Управление сотрудниками</p>
            <div className="action-arrow">
              <FiArrowRight />
            </div>
          </Link>

          <Link to="/manager/settings" className="action-card">
            <div className="action-icon">
              <FiBarChart2 />
            </div>
            <h3>Настройки</h3>
            <p>Конфигурация системы</p>
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
        {dashboardData.properties.length > 0 ? (
          <FloorPlan 
            onRoomClick={handleRoomClick}
            compact={true} 
          />
        ) : (
          <div className="no-properties-message">
            <p>Нет созданных помещений</p>
            <Link to="/manager/floor-plan" className="btn-primary">
              Создать первое помещение
            </Link>
          </div>
        )}
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
                  {activity.type === 'client_registered' && (
                    <span>
                      Новый клиент: <strong>{activity.client}</strong>
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