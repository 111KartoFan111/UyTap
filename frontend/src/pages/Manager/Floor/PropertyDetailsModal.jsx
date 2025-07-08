import { useState } from 'react';
import { 
  FiX, 
  FiHome, 
  FiUser, 
  FiCalendar, 
  FiDollarSign, 
  FiEdit2, 
  FiPlus, 
  FiTool,
  FiClock,
  FiMapPin,
  FiInfo,
  FiUsers,
  FiMaximize
} from 'react-icons/fi';
import './PropertyDetailsModal.css';

const PropertyDetailsModal = ({ 
  property, 
  onClose, 
  onCreateRental, 
  onCreateTask, 
  onEdit,
  onExtendRental,
  onTerminateRental 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [extendDays, setExtendDays] = useState(1);

  if (!property) return null;

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return 'Свободно';
      case 'occupied': return 'Занято';
      case 'maintenance': return 'Ремонт';
      case 'cleaning': return 'Уборка';
      default: return 'Неизвестно';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#27ae60';
      case 'occupied': return '#e74c3c';
      case 'maintenance': return '#f39c12';
      case 'cleaning': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'apartment': return 'Квартира';
      case 'room': return 'Комната';
      case 'studio': return 'Студия';
      case 'villa': return 'Вилла';
      case 'office': return 'Офис';
      default: return '';
    }
  };

  const formatCurrency = (amount) => {
    return amount ? `₸ ${amount.toLocaleString()}` : 'Не указано';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const QuickExtendButtons = () => (
    <div className="quick-extend-actions">
      <button
        onClick={() => onExtendRental(property, 1)}
        className="extend-btn small"
        title="Продлить на 1 день"
      >
        +1д
      </button>
      <button
        onClick={() => onExtendRental(property, 7)}
        className="extend-btn small"
        title="Продлить на неделю"
      >
        +1н
      </button>
      <button
        onClick={() => onExtendRental(property, 30)}
        className="extend-btn small"
        title="Продлить на месяц"
      >
        +1м
      </button>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: FiInfo },
    { id: 'rental', label: 'Аренда', icon: FiCalendar },
    { id: 'tasks', label: 'Задачи', icon: FiTool },
    { id: 'history', label: 'История', icon: FiClock }
  ];

  return (
    <div className="property-details-overlay" onClick={onClose}>
      <div className="property-details-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="property-details-header">
          <div className="header-info">
            <h2>
              <FiHome /> {property.name || `Комната ${property.number}`}
            </h2>
            <div className="property-meta">
              <span className="property-number">#{property.number}</span>
              <span 
                className="property-status"
                style={{ backgroundColor: getStatusColor(property.status) }}
              >
                {getStatusText(property.status)}
              </span>
              <span className="property-type">{getTypeText(property.property_type)}</span>
            </div>
          </div>
          <div className="header-actions">
            <button className="action-btn edit" onClick={onEdit} title="Редактировать">
              <FiEdit2 />
            </button>
            <button className="close-btn" onClick={onClose}>
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          {property.status === 'available' && (
            <button className="quick-action-btn primary" onClick={onCreateRental}>
              <FiPlus /> Создать аренду
            </button>
          )}
          
          {property.status === 'occupied' && (
            <>
              <QuickExtendButtons />
              <button 
                className="quick-action-btn danger" 
                onClick={() => onTerminateRental(property)}
              >
                <FiX /> Завершить аренду
              </button>
            </>
          )}
          
          <button className="quick-action-btn secondary" onClick={onCreateTask}>
            <FiTool /> Создать задачу
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <div className="tabs-header">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="tabs-content">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="tab-content">
                <div className="info-grid">
                  <div className="info-card">
                    <h4><FiMapPin /> Местоположение</h4>
                    <div className="info-item">
                      <span>Этаж:</span>
                      <span>{property.floor || 'Не указан'}</span>
                    </div>
                    <div className="info-item">
                      <span>Здание:</span>
                      <span>{property.building || 'Не указано'}</span>
                    </div>
                    <div className="info-item">
                      <span>Адрес:</span>
                      <span>{property.address || 'Не указан'}</span>
                    </div>
                  </div>

                  <div className="info-card">
                    <h4><FiMaximize /> Характеристики</h4>
                    <div className="info-item">
                      <span>Площадь:</span>
                      <span>{property.area ? `${property.area} м²` : 'Не указано'}</span>
                    </div>
                    <div className="info-item">
                      <span>Комнат:</span>
                      <span>{property.rooms_count || 'Не указано'}</span>
                    </div>
                    <div className="info-item">
                      <span>Вместимость:</span>
                      <span>{property.max_occupancy || 'Не указано'} чел.</span>
                    </div>
                  </div>

                  <div className="info-card">
                    <h4><FiDollarSign /> Тарифы</h4>
                    <div className="rates-list">
                      {property.hourly_rate && (
                        <div className="rate-item">
                          <span>Почасово:</span>
                          <span>{formatCurrency(property.hourly_rate)}/час</span>
                        </div>
                      )}
                      {property.daily_rate && (
                        <div className="rate-item">
                          <span>Посуточно:</span>
                          <span>{formatCurrency(property.daily_rate)}/день</span>
                        </div>
                      )}
                      {property.monthly_rate && (
                        <div className="rate-item">
                          <span>Помесячно:</span>
                          <span>{formatCurrency(property.monthly_rate)}/мес</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {property.description && (
                  <div className="description-section">
                    <h4>Описание</h4>
                    <p>{property.description}</p>
                  </div>
                )}

                {property.amenities && property.amenities.length > 0 && (
                  <div className="amenities-section">
                    <h4>Удобства</h4>
                    <div className="amenities-list">
                      {property.amenities.map((amenity, index) => (
                        <span key={index} className="amenity-tag">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rental Tab */}
            {activeTab === 'rental' && (
              <div className="tab-content">
                {property.status === 'occupied' && property.activeRental ? (
                  <div className="rental-info">
                    <div className="rental-card">
                      <h4><FiUser /> Текущая аренда</h4>
                      <div className="rental-details">
                        <div className="detail-item">
                          <span>Клиент:</span>
                          <span>{property.currentGuests?.[0] || 'Не указан'}</span>
                        </div>
                        <div className="detail-item">
                          <span>Заселение:</span>
                          <span>{property.checkIn || 'Не указано'}</span>
                        </div>
                        <div className="detail-item">
                          <span>Выселение:</span>
                          <span>{property.checkOut || 'Не указано'}</span>
                        </div>
                        <div className="detail-item">
                          <span>Сумма:</span>
                          <span>{formatCurrency(property.activeRental?.total_amount)}</span>
                        </div>
                      </div>
                      
                      <div className="rental-actions">
                        <h5>Быстрые действия:</h5>
                        <QuickExtendButtons />
                        <button 
                          className="action-btn danger full-width"
                          onClick={() => onTerminateRental(property)}
                        >
                          <FiX /> Завершить аренду
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-rental">
                    <div className="empty-state">
                      <FiCalendar size={48} />
                      <h4>Нет активной аренды</h4>
                      <p>Помещение свободно и готово к заселению</p>
                      <button className="action-btn primary" onClick={onCreateRental}>
                        <FiPlus /> Создать аренду
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="tab-content">
                <div className="section-header">
                  <h4>Активные задачи</h4>
                  <button className="action-btn secondary small" onClick={onCreateTask}>
                    <FiPlus /> Новая задача
                  </button>
                </div>
                
                <div className="tasks-list">
                  {/* Mock tasks - в реальном приложении загружать из API */}
                  <div className="task-item">
                    <div className="task-info">
                      <span className="task-title">Генеральная уборка</span>
                      <span className="task-type cleaning">🧹 Уборка</span>
                    </div>
                    <div className="task-meta">
                      <span className="task-assignee">Мария И.</span>
                      <span className="task-due">До 15:00</span>
                    </div>
                    <div className="task-status pending">В ожидании</div>
                  </div>
                  
                  <div className="task-item">
                    <div className="task-info">
                      <span className="task-title">Проверка сантехники</span>
                      <span className="task-type maintenance">🔧 Техобслуживание</span>
                    </div>
                    <div className="task-meta">
                      <span className="task-assignee">Алексей П.</span>
                      <span className="task-due">Завтра</span>
                    </div>
                    <div className="task-status in-progress">В работе</div>
                  </div>
                  
                  <div className="empty-state small">
                    <FiTool size={32} />
                    <p>Нет активных задач для этого помещения</p>
                    <button className="action-btn secondary" onClick={onCreateTask}>
                      <FiPlus /> Создать первую задачу
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="tab-content">
                <div className="history-list">
                  {/* Mock history - в реальном приложении загружать из API */}
                  <div className="history-item">
                    <div className="history-icon rental">
                      <FiCalendar />
                    </div>
                    <div className="history-info">
                      <span className="history-title">Аренда завершена</span>
                      <span className="history-details">Клиент: Иван Петров • 7 дней</span>
                      <span className="history-date">3 дня назад</span>
                    </div>
                    <div className="history-amount">₸ 126,000</div>
                  </div>
                  
                  <div className="history-item">
                    <div className="history-icon task">
                      <FiTool />
                    </div>
                    <div className="history-info">
                      <span className="history-title">Задача выполнена</span>
                      <span className="history-details">Уборка после выселения • Мария И.</span>
                      <span className="history-date">3 дня назад</span>
                    </div>
                  </div>
                  
                  <div className="history-item">
                    <div className="history-icon rental">
                      <FiUser />
                    </div>
                    <div className="history-info">
                      <span className="history-title">Заселение</span>
                      <span className="history-details">Клиент: Иван Петров</span>
                      <span className="history-date">10 дней назад</span>
                    </div>
                  </div>
                  
                  <div className="empty-state small">
                    <FiClock size={32} />
                    <p>История операций пуста</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailsModal;