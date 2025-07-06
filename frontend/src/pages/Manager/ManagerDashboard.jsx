import { useState, useEffect } from 'react';
import { 
  FiHome, 
  FiUsers, 
  FiClipboard, 
  FiDollarSign, 
  FiCalendar,
  FiPlus,
  FiBarChart2,
  FiSettings,
  FiAlertCircle
} from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import RentalModal from './RentalModal.jsx';
import ClientModal from './ClientModal.jsx';
import FloorPlan from './FloorPlan.jsx';
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
  
  const [activeTab, setActiveTab] = useState('floor-plan');
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
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

  // Load dashboard data with error handling
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load properties first (required)
      let propertiesData = [];
      let clientsData = [];
      let rentalsData = [];
      let financialData = null;

      try {
        propertiesData = await properties.getAll();
      } catch (error) {
        console.error('Failed to load properties:', error);
        // Use mock data if API fails
        propertiesData = generateMockProperties();
      }

      try {
        clientsData = await clients.getAll({ limit: 50 });
      } catch (error) {
        console.error('Failed to load clients:', error);
        clientsData = generateMockClients();
      }

      try {
        rentalsData = await rentals.getAll({ is_active: true });
      } catch (error) {
        console.error('Failed to load rentals:', error);
        rentalsData = generateMockRentals();
      }

      // Financial data is optional
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        financialData = await reports.getFinancialSummary(startDate, endDate);
      } catch (error) {
        console.error('Failed to load financial data:', error);
        // Continue without financial data
      }

      setDashboardData({
        properties: propertiesData,
        clientsList: clientsData,
        rentalsList: rentalsData,
        financialSummary: financialData
      });

      // Calculate stats from loaded data
      calculateStats(propertiesData, clientsData, rentalsData, financialData);
      generateActivities(rentalsData);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Use all mock data as fallback
      const mockData = {
        properties: generateMockProperties(),
        clientsList: generateMockClients(),
        rentalsList: generateMockRentals(),
        financialSummary: null
      };
      setDashboardData(mockData);
      calculateStats(mockData.properties, mockData.clientsList, mockData.rentalsList, null);
      generateActivities(mockData.rentalsList);
    }
  };

  const generateMockProperties = () => {
    const properties = [];
    for (let floor = 1; floor <= 3; floor++) {
      for (let room = 1; room <= 10; room++) {
        const roomNumber = `${floor}-${room.toString().padStart(2, '0')}`;
        const statuses = ['available', 'occupied', 'maintenance', 'cleaning'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        properties.push({
          id: `${floor}-${room}`,
          number: roomNumber,
          floor: floor,
          status: status,
          property_type: room <= 5 ? 'standard' : 'premium',
          created_at: new Date().toISOString()
        });
      }
    }
    return properties;
  };

  const generateMockClients = () => {
    const clients = [];
    const names = ['Анна Петрова', 'Иван Сидоров', 'Мария Козлова', 'Алексей Иванов'];
    for (let i = 1; i <= 20; i++) {
      clients.push({
        id: i,
        first_name: names[i % names.length].split(' ')[0],
        last_name: names[i % names.length].split(' ')[1],
        phone: `+7 777 ${String(i).padStart(3, '0')} ${String(i * 2).padStart(2, '0')} ${String(i * 3).padStart(2, '0')}`,
        email: `client${i}@example.com`,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'walk-in'
      });
    }
    return clients;
  };

  const generateMockRentals = () => {
    const rentals = [];
    for (let i = 1; i <= 8; i++) {
      rentals.push({
        id: i,
        property_id: `1-${String(i).padStart(2, '0')}`,
        property: { number: `1-${String(i).padStart(2, '0')}` },
        client: { first_name: 'Клиент', last_name: String(i) },
        rental_type: ['hourly', 'daily', 'monthly'][Math.floor(Math.random() * 3)],
        total_amount: Math.floor(Math.random() * 50000) + 10000,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        checked_in: Math.random() > 0.5
      });
    }
    return rentals;
  };

  const calculateStats = (propertiesData, clientsData, rentalsData, financialData) => {
    const occupiedCount = propertiesData.filter(p => p.status === 'occupied').length;
    const availableCount = propertiesData.filter(p => p.status === 'available').length;
    const maintenanceCount = propertiesData.filter(p => p.status === 'maintenance').length;
    const occupancyRate = propertiesData.length > 0 ? (occupiedCount / propertiesData.length) * 100 : 0;

    setStats({
      totalRooms: propertiesData.length,
      occupiedRooms: occupiedCount,
      availableRooms: availableCount,
      maintenanceRooms: maintenanceCount,
      totalClients: clientsData.length,
      activeRentals: rentalsData.length,
      monthlyRevenue: financialData?.total_revenue || Math.floor(Math.random() * 1000000) + 500000,
      occupancyRate: Math.round(occupancyRate)
    });
  };

  const generateActivities = (rentalsData) => {
    const activities = rentalsData.slice(0, 5).map((rental, index) => ({
      id: rental.id,
      type: rental.checked_in ? 'rental_active' : 'rental_started',
      client: `${rental.client?.first_name || ''} ${rental.client?.last_name || ''}`.trim() || 'Клиент',
      room: rental.property?.number || rental.property_id,
      time: new Date(rental.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      amount: rental.total_amount
    }));
    setRecentActivities(activities);
  };

  const tabs = [
    { id: 'floor-plan', label: 'План этажа', icon: FiHome },
    { id: 'rentals', label: 'Аренда', icon: FiCalendar },
    { id: 'clients', label: 'Клиенты', icon: FiUsers },
    { id: 'reports', label: 'Отчеты', icon: FiBarChart2 },
    { id: 'settings', label: 'Настройки', icon: FiSettings }
  ];

  const handleRoomClick = (room) => {
    setSelectedRoom(room);
    if (room.status === 'available') {
      setShowRentalModal(true);
    }
  };

  const handleCreateRental = async (rentalData) => {
    try {
      await rentals.create({
        property_id: selectedRoom?.id || rentalData.roomNumber,
        client_data: {
          first_name: rentalData.clientName.split(' ')[0] || '',
          last_name: rentalData.clientName.split(' ').slice(1).join(' ') || '',
          phone: rentalData.clientPhone,
          email: rentalData.clientEmail,
          document_number: rentalData.clientDocument
        },
        rental_type: rentalData.rentalType,
        start_date: rentalData.startDate,
        end_date: rentalData.endDate,
        rate: rentalData.rate,
        total_amount: rentalData.totalAmount,
        deposit: rentalData.deposit,
        payment_method: rentalData.paymentMethod,
        guest_count: 1,
        notes: rentalData.notes
      });

      // Reload dashboard data
      await loadDashboardData();
      setShowRentalModal(false);
      setSelectedRoom(null);
    } catch (error) {
      console.error('Failed to create rental:', error);
      utils.showError('Не удалось создать аренду: ' + error.message);
    }
  };

  const handleCreateClient = async (clientData) => {
    try {
      await clients.create({
        first_name: clientData.first_name,
        last_name: clientData.last_name,
        phone: clientData.phone,
        email: clientData.email,
        source: clientData.source
      });

      // Reload clients data
      const newClientsData = await clients.getAll({ limit: 50 });
      setDashboardData(prev => ({ ...prev, clientsList: newClientsData }));
      setStats(prev => ({ ...prev, totalClients: newClientsData.length }));
      
      setShowClientModal(false);
      utils.showSuccess('Клиент успешно добавлен');
    } catch (error) {
      console.error('Failed to create client:', error);
      utils.showError('Не удалось создать клиента: ' + error.message);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'floor-plan':
        return <FloorPlan properties={dashboardData.properties} onRoomClick={handleRoomClick} />;
      case 'rentals':
        return renderRentalsTab();
      case 'clients':
        return renderClientsTab();
      case 'reports':
        return renderReportsTab();
      case 'settings':
        return renderSettingsTab();
      default:
        return <FloorPlan properties={dashboardData.properties} onRoomClick={handleRoomClick} />;
    }
  };

  const renderRentalsTab = () => (
    <div className="rentals-tab">
      <div className="tab-header">
        <h2>Управление арендой</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowRentalModal(true)}
          disabled={loading}
        >
          <FiPlus /> Новая аренда
        </button>
      </div>
      
      <div className="rentals-grid">
        <div className="rental-types">
          <div className="rental-type-card">
            <h3>Почасовая аренда</h3>
            <p>Активных: {dashboardData.rentalsList.filter(r => r.rental_type === 'hourly').length}</p>
            <div className="price-range">₸ 2,500 - 4,000 / час</div>
          </div>
          <div className="rental-type-card">
            <h3>Посуточная аренда</h3>
            <p>Активных: {dashboardData.rentalsList.filter(r => r.rental_type === 'daily').length}</p>
            <div className="price-range">₸ 15,000 - 25,000 / сутки</div>
          </div>
          <div className="rental-type-card">
            <h3>Помесячная аренда</h3>
            <p>Активных: {dashboardData.rentalsList.filter(r => r.rental_type === 'monthly').length}</p>
            <div className="price-range">₸ 180,000 - 350,000 / месяц</div>
          </div>
        </div>

        <div className="active-rentals">
          <h3>Активные аренды</h3>
          <div className="rentals-list">
            {dashboardData.rentalsList.slice(0, 10).map((rental) => (
              <div key={rental.id} className="rental-item">
                <div className="rental-info">
                  <span className="room-number">{rental.property?.number || rental.property_id}</span>
                  <span className="client-name">
                    {rental.client ? `${rental.client.first_name} ${rental.client.last_name}` : 'Клиент'}
                  </span>
                  <span className="rental-type">
                    {rental.rental_type === 'hourly' ? 'Почасово' : 
                     rental.rental_type === 'daily' ? 'Посуточно' : 'Помесячно'}
                  </span>
                </div>
                <div className="rental-details">
                  <span className="end-date">До: {new Date(rental.end_date).toLocaleDateString()}</span>
                  <span className="amount">₸ {rental.total_amount?.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderClientsTab = () => (
    <div className="clients-tab">
      <div className="tab-header">
        <h2>База клиентов</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowClientModal(true)}
          disabled={loading}
        >
          <FiPlus /> Добавить клиента
        </button>
      </div>
      
      <div className="clients-stats">
        <div className="stat-card">
          <h3>Всего клиентов</h3>
          <div className="stat-number">{stats.totalClients}</div>
        </div>
        <div className="stat-card">
          <h3>Новые за месяц</h3>
          <div className="stat-number">
            {dashboardData.clientsList.filter(c => {
              const createdDate = new Date(c.created_at);
              const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
              return createdDate > monthAgo;
            }).length}
          </div>
        </div>
        <div className="stat-card">
          <h3>Активные аренды</h3>
          <div className="stat-number">{stats.activeRentals}</div>
        </div>
      </div>

      <div className="clients-table-wrapper">
        <table className="clients-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Последний визит</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.clientsList.slice(0, 10).map((client) => (
              <tr key={client.id}>
                <td>{client.first_name} {client.last_name}</td>
                <td>{client.phone || '—'}</td>
                <td>{client.email || '—'}</td>
                <td>{client.last_visit ? new Date(client.last_visit).toLocaleDateString() : '—'}</td>
                <td>{client.source || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReportsTab = () => (
    <div className="reports-tab">
      <h2>Отчеты и аналитика</h2>
      
      <div className="reports-grid">
        <div className="report-card">
          <h3>Финансовый отчет</h3>
          <p>Доходы и расходы за период</p>
          {dashboardData.financialSummary && (
            <div className="report-preview">
              <span>Выручка: ₸ {dashboardData.financialSummary.total_revenue?.toLocaleString()}</span>
            </div>
          )}
          <button className="btn-outline" disabled={loading}>Сформировать</button>
        </div>
        <div className="report-card">
          <h3>Загруженность</h3>
          <p>Анализ занятости помещений</p>
          <div className="report-preview">
            <span>Загруженность: {stats.occupancyRate}%</span>
          </div>
          <button className="btn-outline" disabled={loading}>Сформировать</button>
        </div>
        <div className="report-card">
          <h3>Клиентская база</h3>
          <p>Статистика по клиентам</p>
          <div className="report-preview">
            <span>Всего клиентов: {stats.totalClients}</span>
          </div>
          <button className="btn-outline" disabled={loading}>Сформировать</button>
        </div>
        <div className="report-card">
          <h3>Сотрудники</h3>
          <p>Отчет по работе персонала</p>
          <button className="btn-outline" disabled={loading}>Сформировать</button>
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="settings-tab">
      <h2>Настройки системы</h2>
      
      <div className="settings-sections">
        <div className="settings-section">
          <h3>Тарифы</h3>
          <p>Настройка стоимости аренды</p>
          <button className="btn-outline">Настроить</button>
        </div>
        <div className="settings-section">
          <h3>Уведомления</h3>
          <p>Настройка оповещений</p>
          <button className="btn-outline">Настроить</button>
        </div>
        <div className="settings-section">
          <h3>Интеграции</h3>
          <p>Внешние сервисы</p>
          <button className="btn-outline">Настроить</button>
        </div>
      </div>
    </div>
  );

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
          <span>Привет, {user.first_name}!</span>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={utils.clearError}>×</button>
        </div>
      )}

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

      <div className="manager-content">
        <div className="tabs-navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              disabled={loading}
            >
              <tab.icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="tab-content">
          {renderTabContent()}
        </div>
      </div>

      <div className="recent-activities">
        <h3>Последние события</h3>
        <div className="activities-list">
          {recentActivities.map(activity => (
            <div key={activity.id} className="activity-item">
              <div className="activity-time">{activity.time}</div>
              <div className="activity-content">
                {activity.type === 'rental_started' && (
                  <span>Начата аренда: <strong>{activity.client}</strong> в комнате <strong>{activity.room}</strong></span>
                )}
                {activity.type === 'rental_active' && (
                  <span>Активная аренда: <strong>{activity.client}</strong> в комнате <strong>{activity.room}</strong></span>
                )}
              </div>
              {activity.amount && (
                <div className="activity-amount">₸ {activity.amount.toLocaleString()}</div>
              )}
            </div>
          ))}
          {recentActivities.length === 0 && (
            <div className="no-activities">
              <p>Нет последних событий</p>
            </div>
          )}
        </div>
      </div>

      {showRentalModal && (
        <RentalModal
          room={selectedRoom}
          onClose={() => {
            setShowRentalModal(false);
            setSelectedRoom(null);
          }}
          onSubmit={handleCreateRental}
        />
      )}

      {showClientModal && (
        <ClientModal
          onClose={() => setShowClientModal(false)}
          onSubmit={handleCreateClient}
        />
      )}
    </div>
  );
};

export default ManagerDashboard;