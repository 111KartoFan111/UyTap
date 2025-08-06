// frontend/src/pages/Manager/Floor/PropertyDetailsModal.jsx - Исправленная версия

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
  FiMaximize,
  FiPlay,
  FiPause,
  FiRotateCcw,
  FiCheck
} from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';
import './PropertyDetailsModal.css';
import { TbStatusChange } from "react-icons/tb";

const PropertyDetailsModal = ({ 
  property, 
  onClose, 
  onCreateRental, 
  onCreateTask, 
  onEdit,
  onCheckIn,
  onCheckOut,
  onCancelRental
}) => {
  const { tasks, utils, properties } = useData();
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

  const handleChange = (e) => {
    const newStatus = e.target.value;
    properties.updateStatus(property.id, newStatus);
  };

  // ДОБАВЛЯЕМ функцию продления прямо в компонент
  const handleExtendRental = async (property, days) => {
    try {
      if (!property.activeRental) {
        utils.showError('Нет активной аренды для продления');
        return;
      }

      // Определяем дневную ставку для расчета стоимости продления
      let dailyRate = 0;
      if (property.activeRental.rental_type === 'daily') {
        dailyRate = property.activeRental.rate;
      } else if (property.activeRental.rental_type === 'hourly') {
        dailyRate = property.activeRental.rate * 24; // конвертируем часовую в дневную
      } else if (property.activeRental.rental_type === 'monthly') {
        dailyRate = property.activeRental.rate / 30; // конвертируем месячную в дневную
      } else {
        dailyRate = property.daily_rate || property.activeRental.rate || 0;
      }

      const additionalAmount = dailyRate * days;
      
      if (additionalAmount <= 0) {
        utils.showError('Не удалось определить стоимость продления. Проверьте тарифы.');
        return;
      }

      const confirmed = confirm(
        `Продлить аренду на ${days} дн.?\n` +
        `Доплата: ₸${additionalAmount.toLocaleString()}\n` +
        `Клиенту будет создан платеж для оплаты продления.`
      );

      if (!confirmed) return;

      const currentEndDate = new Date(property.activeRental.end_date);
      const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);

      // Отправляем запрос на продление
      const response = await fetch(`http://localhost:8000/api/rentals/${property.activeRental.id}/extend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_end_date: newEndDate.toISOString(),
          additional_amount: additionalAmount,
          payment_method: 'cash',
          payment_notes: `Продление на ${days} дн.`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось продлить аренду');
      }

      const result = await response.json();

      utils.showSuccess(
        `Аренда продлена на ${days} дн. до ${newEndDate.toLocaleDateString()}!\n` +
        `Создан платеж на доплату: ₸${additionalAmount.toLocaleString()}`
      );

      // Закрываем модальное окно, чтобы обновились данные в родительском компоненте
      onClose();

    } catch (error) {
      console.error('Failed to extend rental:', error);
      utils.showError('Не удалось продлить аренду: ' + error.message);
    }
  };

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
      case 'check_in': return 'Заселение';
      case 'check_out': return 'Выселение';
      case 'delivery': return 'Доставка';
      case 'laundry': return 'Стирка';
      default: return type;
    }
  };

  const getTaskTypeIcon = (type) => {
    switch (type) {
      case 'cleaning': return '🧹';
      case 'maintenance': return '🔧';
      case 'check_in': return '🔑';
      case 'check_out': return '🚪';
      case 'delivery': return '📦';
      case 'laundry': return '👕';
      default: return '📋';
    }
  };

  const QuickExtendButtons = () => (
    <div className="quick-extend-actions">
      <button
        onClick={() => handleExtendRental(property, 1)}
        className="extend-btn small"
        title="Продлить на 1 день"
      >
        +1д
      </button>
      <button
        onClick={() => handleExtendRental(property, 7)}
        className="extend-btn small"
        title="Продлить на неделю"
      >
        +1н
      </button>
      <button
        onClick={() => handleExtendRental(property, 30)}
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
          
          {property.status === 'occupied' && property.activeRental && (
            <>
              {!property.isCheckedIn && (
                <button 
                  className="quick-action-btn primary" 
                  onClick={() => onCheckIn(property)}
                >
                  <FiPlay /> Заселить
                </button>
              )}
              
              {property.isCheckedIn && !property.isCheckedOut && (
                <>
                  <QuickExtendButtons />
                  <button 
                    className="quick-action-btn secondary" 
                    onClick={() => onCheckOut(property)}
                  >
                    <FiPause /> Выселить
                  </button>
                </>
              )}
              
              <button 
                className="quick-action-btn danger" 
                onClick={() => onCancelRental(property)}
              >
                <FiRotateCcw /> Отменить аренду
              </button>
            </>
          )}
          
          <button className="quick-action-btn secondary" onClick={onCreateTask}>
            <FiTool /> Создать задачу
          </button>
          
          <div className="quick-actions">
            <select
              className="quick-action-btn secondary"
              value={property.status}
              onChange={handleChange}
            >
              <option value="available">Доступна</option>
              <option value="occupied">Занята</option>
              <option value="maintenance">На обслуживании</option>
              <option value="cleaning">Уборка</option>
              <option value="suspended">Приостановлена</option>
              <option value="out_of_order">Неисправна</option>
            </select>
          </div>
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
                        <div className="detail-item">
                          <span>Статус:</span>
                          <span>
                            {!property.isCheckedIn && (
                              <span className="status-badge pending">Ожидает заселения</span>
                            )}
                            {property.isCheckedIn && !property.isCheckedOut && (
                              <span className="status-badge active">Заселен</span>
                            )}
                            {property.isCheckedOut && (
                              <span className="status-badge completed">Выселен</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      <div className="rental-actions">
                        <h5>Действия с арендой:</h5>
                        
                        {!property.isCheckedIn && (
                          <button 
                            className="action-btn primary"
                            onClick={() => onCheckIn(property)}
                          >
                            <FiPlay /> Заселить клиента
                          </button>
                        )}
                        
                        {property.isCheckedIn && !property.isCheckedOut && (
                          <>
                            <div className="action-group">
                              <span>Продлить аренду:</span>
                              <QuickExtendButtons />
                            </div>
                            <button 
                              className="action-btn secondary"
                              onClick={() => onCheckOut(property)}
                            >
                              <FiPause /> Выселить клиента
                            </button>
                          </>
                        )}
                        
                        <button 
                          className="action-btn danger full-width"
                          onClick={() => onCancelRental(property)}
                        >
                          <FiRotateCcw /> Отменить аренду
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
                              {task.assignee?.first_name ? `${task.assignee.first_name} ${task.assignee.last_name}` : 'Не назначен'}
                            </span>
                            <span className="task-due">
                              {task.due_date ? formatDate(task.due_date) : 'Без срока'}
                            </span>
                            <span className="task-due">
                              Завершено за : {task.actual_duration ? `${task.actual_duration} мин.` : 'Без срока'}
                            </span>
                            
                          </div>
                          <div className={`task-status ${task.status}`}>
                            {getTaskStatusText(task.status)}
                          </div>
                          <div className="task-actions">
                            <button 
                              className="action-btn edit small" 
                              onClick={() => onEdit(task)}
                              title="Редактировать задачу"
                            >
                              <FiEdit2 />
                            </button>
                            {task.status === 'pending' && (
                              <button 
                                className="action-btn complete small" 
                                onClick={() => tasks.complete(task.id)}
                                title="Завершить задачу"
                              >
                                <FiCheck />
                              </button>
                            )}
                            {task.status !== 'cancelled' && (
                              <button 
                                className="action-btn cancel small" 
                                onClick={() => tasks.cancel(task.id)}
                                title="Отменить задачу"
                              >
                                <FiX />
                              </button>
                            )}
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