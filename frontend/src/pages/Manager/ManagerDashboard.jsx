import { useState, useEffect } from 'react';
import { 
  FiHome, 
  FiUsers, 
  FiClipboard, 
  FiDollarSign, 
  FiCalendar,
  FiPlus,
  FiBarChart2,
  FiSettings
} from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import RentalModal from './RentalModal.jsx';
import ClientModal from './ClientModal.jsx';
import FloorPlan from './FloorPlan.jsx';
import './ManagerDashboard.css';

const ManagerDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('floor-plan');
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [stats, setStats] = useState({
    totalRooms: 50,
    occupiedRooms: 32,
    availableRooms: 15,
    maintenanceRooms: 3,
    totalClients: 127,
    activeRentals: 32,
    monthlyRevenue: 2450000,
    occupancyRate: 64
  });

  const [recentActivities, setRecentActivities] = useState([
    {
      id: 1,
      type: 'rental_started',
      client: 'Анна Петрова',
      room: '2-15',
      time: '10:30',
      amount: 85000
    },
    {
      id: 2,
      type: 'rental_ended',
      client: 'Марат Саметов',
      room: '1-08',
      time: '09:15',
      amount: 65000
    },
    {
      id: 3,
      type: 'maintenance_requested',
      room: '3-22',
      issue: 'Сантехника',
      time: '08:45'
    }
  ]);

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'floor-plan':
        return <FloorPlan onRoomClick={handleRoomClick} />;
      case 'rentals':
        return renderRentalsTab();
      case 'clients':
        return renderClientsTab();
      case 'reports':
        return renderReportsTab();
      case 'settings':
        return renderSettingsTab();
      default:
        return <FloorPlan onRoomClick={handleRoomClick} />;
    }
  };

  const renderRentalsTab = () => (
    <div className="rentals-tab">
      <div className="tab-header">
        <h2>Управление арендой</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowRentalModal(true)}
        >
          <FiPlus /> Новая аренда
        </button>
      </div>
      
      <div className="rentals-grid">
        <div className="rental-types">
          <div className="rental-type-card">
            <h3>Почасовая аренда</h3>
            <p>Активных: 8</p>
            <div className="price-range">₸ 2,500 - 4,000 / час</div>
          </div>
          <div className="rental-type-card">
            <h3>Посуточная аренда</h3>
            <p>Активных: 18</p>
            <div className="price-range">₸ 15,000 - 25,000 / сутки</div>
          </div>
          <div className="rental-type-card">
            <h3>Помесячная аренда</h3>
            <p>Активных: 6</p>
            <div className="price-range">₸ 180,000 - 350,000 / месяц</div>
          </div>
        </div>

        <div className="active-rentals">
          <h3>Активные аренды</h3>
          <div className="rentals-list">
            {[
              { room: '2-15', client: 'Анна Петрова', type: 'Посуточно', endDate: '2025-07-05', amount: 20000 },
              { room: '1-08', client: 'Дмитрий Ким', type: 'Помесячно', endDate: '2025-07-31', amount: 250000 },
              { room: '3-22', client: 'Света Жанова', type: 'Почасово', endDate: '2025-07-01 18:00', amount: 3500 }
            ].map((rental, index) => (
              <div key={index} className="rental-item">
                <div className="rental-info">
                  <span className="room-number">{rental.room}</span>
                  <span className="client-name">{rental.client}</span>
                  <span className="rental-type">{rental.type}</span>
                </div>
                <div className="rental-details">
                  <span className="end-date">До: {rental.endDate}</span>
                  <span className="amount">₸ {rental.amount.toLocaleString()}</span>
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
        >
          <FiPlus /> Добавить клиента
        </button>
      </div>
      
      <div className="clients-stats">
        <div className="stat-card">
          <h3>Всего клиентов</h3>
          <div className="stat-number">127</div>
        </div>
        <div className="stat-card">
          <h3>Новые за месяц</h3>
          <div className="stat-number">15</div>
        </div>
        <div className="stat-card">
          <h3>Повторные аренды</h3>
          <div className="stat-number">68%</div>
        </div>
      </div>

      <div className="clients-table-wrapper">
        <table className="clients-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Кол-во аренд</th>
              <th>Последний визит</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Анна Петрова', phone: '+7 777 123 45 67', rentals: 3, lastVisit: '2025-06-28', source: 'Instagram' },
              { name: 'Марат Саметов', phone: '+7 777 234 56 78', rentals: 1, lastVisit: '2025-06-25', source: 'Рекомендация' },
              { name: 'Дмитрий Ким', phone: '+7 777 345 67 89', rentals: 5, lastVisit: '2025-06-30', source: 'Booking.com' }
            ].map((client, index) => (
              <tr key={index}>
                <td>{client.name}</td>
                <td>{client.phone}</td>
                <td>{client.rentals}</td>
                <td>{client.lastVisit}</td>
                <td>{client.source}</td>
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
          <button className="btn-outline">Сформировать</button>
        </div>
        <div className="report-card">
          <h3>Загруженность</h3>
          <p>Анализ занятости помещений</p>
          <button className="btn-outline">Сформировать</button>
        </div>
        <div className="report-card">
          <h3>Клиентская база</h3>
          <p>Статистика по клиентам</p>
          <button className="btn-outline">Сформировать</button>
        </div>
        <div className="report-card">
          <h3>Сотрудники</h3>
          <p>Отчет по работе персонала</p>
          <button className="btn-outline">Сформировать</button>
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

  return (
    <div className="manager-dashboard">
      <div className="manager-header">
        <h1>Управление арендой</h1>
        <div className="user-info">
          <span>Привет, {user.first_name}!</span>
        </div>
      </div>

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
                {activity.type === 'rental_ended' && (
                  <span>Завершена аренда: <strong>{activity.client}</strong> в комнате <strong>{activity.room}</strong></span>
                )}
                {activity.type === 'maintenance_requested' && (
                  <span>Заявка на обслуживание: <strong>{activity.room}</strong> - {activity.issue}</span>
                )}
              </div>
              {activity.amount && (
                <div className="activity-amount">₸ {activity.amount.toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showRentalModal && (
        <RentalModal
          room={selectedRoom}
          onClose={() => {
            setShowRentalModal(false);
            setSelectedRoom(null);
          }}
          onSubmit={(rentalData) => {
            console.log('New rental:', rentalData);
            setShowRentalModal(false);
            setSelectedRoom(null);
          }}
        />
      )}

      {showClientModal && (
        <ClientModal
          onClose={() => setShowClientModal(false)}
          onSubmit={(clientData) => {
            console.log('New client:', clientData);
            setShowClientModal(false);
          }}
        />
      )}
    </div>
  );
};

export default ManagerDashboard;