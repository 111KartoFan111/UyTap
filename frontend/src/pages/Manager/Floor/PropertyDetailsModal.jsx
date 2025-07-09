import { useState, useEffect } from 'react';
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
import { useData } from '../../../contexts/DataContext';
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
  const { tasks, utils } = useData();
  const [activeTab, setActiveTab] = useState('overview');
  const [propertyTasks, setPropertyTasks] = useState([]);
  const [propertyHistory, setPropertyHistory] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Загрузка задач для свойства
  useEffect(() => {
    if (property && activeTab === 'tasks') {
      loadPropertyTasks();
    }
  }, [property, activeTab]);

  // Загрузка истории для свойства
  useEffect(() => {
    if (property && activeTab === 'history') {
      loadPropertyHistory();
    }
  }, [property, activeTab]);

  const loadPropertyTasks = async () => {
    try {
      setLoadingTasks(true);
      const tasksData = await tasks.getAll({ property_id: property.id });
      setPropertyTasks(tasksData);
    } catch (error) {
      console.error('Failed to load property tasks:', error);
      utils.showError('Не удалось загрузить задачи');
    } finally {
      setLoadingTasks(false);
    }
  };

  const loadPropertyHistory = async () => {
    try {
      setLoadingHistory(true);
      // Здесь будет API для получения истории помещения
      // const historyData = await properties.getHistory(property.id);
      // setPropertyHistory(historyData);
      setPropertyHistory([]);
    } catch (error) {
      console.error('Failed to load property history:', error);
      utils.showError('Не удалось загрузить историю');
    } finally {
      setLoadingHistory(false);
    }
  };

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

  const getTaskStatusText = (status) => {
    switch (status) {
      case 'pending': return 'В ожидании';
      case 'in_progress': return 'В работе';
      case 'completed': return 'Завершена';
      case 'cancelled': return 'Отменена';
      default: return status;
    }
  };

  const getTaskTypeText = (type) => {
    switch (type) {
      case 'cleaning': return 'Уборка';
      case 'maintenance': return 'Техобслуживание';
      case 'repair': return 'Ремонт';
      case 'inspection': return 'Инспекция';
      case 'decoration': return 'Декор';
      default: return type;
    }
  };

  const getTaskTypeIcon = (type) => {
    switch (type) {
      case 'cleaning': return '🧹';
      case 'maintenance': return '🔧';
      case 'repair': return '🛠️';
      case 'inspection': return '🔍';
      case 'decoration': return '🎨';
      default: return '📋';
    }
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
                
                {loadingTasks ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <div className="tasks-list">
                    {propertyTasks.length > 0 ? (
                      propertyTasks.map(task => (
                        <div key={task.id} className="task-item">
                          <div className="task-info">
                            <span className="task-title">{task.title}</span>
                            <span className={`task-type ${task.task_type}`}>
                              {getTaskTypeIcon(task.task_type)} {getTaskTypeText(task.task_type)}
                            </span>
                          </div>
                          <div className="task-meta">
                            <span className="task-assignee">
                              {task.assigned_to_name || 'Не назначен'}
                            </span>
                            <span className="task-due">
                              {task.due_date ? formatDate(task.due_date) : 'Без срока'}
                            </span>
                          </div>
                          <div className={`task-status ${task.status}`}>
                            {getTaskStatusText(task.status)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state small">
                        <FiTool size={32} />
                        <p>Нет задач для этого помещения</p>
                        <button className="action-btn secondary" onClick={onCreateTask}>
                          <FiPlus /> Создать первую задачу
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="tab-content">
                {loadingHistory ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <div className="history-list">
                    {propertyHistory.length > 0 ? (
                      propertyHistory.map((historyItem, index) => (
                        <div key={index} className="history-item">
                          <div className={`history-icon ${historyItem.type}`}>
                            {historyItem.type === 'rental' ? <FiCalendar /> : <FiTool />}
                          </div>
                          <div className="history-info">
                            <span className="history-title">{historyItem.title}</span>
                            <span className="history-details">{historyItem.details}</span>
                            <span className="history-date">{formatDate(historyItem.date)}</span>
                          </div>
                          {historyItem.amount && (
                            <div className="history-amount">
                              {formatCurrency(historyItem.amount)}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-state small">
                        <FiClock size={32} />
                        <p>История операций пуста</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailsModal;