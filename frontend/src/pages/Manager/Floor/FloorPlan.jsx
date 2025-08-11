import { useState, useEffect } from 'react';
import { FiEdit2, FiTool, FiCheck, FiPlus, FiAlertCircle, FiCalendar, FiClock, FiPlay, FiPause, FiX } from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';
import PropertyModal from './PropertyModal';
import RentalModal from './RentalModal';
import TaskModal from './TaskModal';
import PropertyDetailsModal from './PropertyDetailsModal.jsx';
import './FloorPlan.css';

const FloorPlan = ({ onRoomClick }) => {
  const { properties, rentals, tasks, organization, utils } = useData();
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [rooms, setRooms] = useState([]);
  const [activeRentals, setActiveRentals] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showPropertyDetails, setShowPropertyDetails] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [organizationLimits, setOrganizationLimits] = useState(null);

  // Загрузка данных
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Загружаем помещения, аренды и лимиты параллельно
      const [propertiesData, rentalsData, limitsData] = await Promise.allSettled([
        properties.getAll(),
        rentals.getAll({ is_active: true }),
        organization.getLimits()
      ]);

      const propsList = propertiesData.status === 'fulfilled' ? propertiesData.value : [];
      const rentalsList = rentalsData.status === 'fulfilled' ? rentalsData.value : [];
      const limits = limitsData.status === 'fulfilled' ? limitsData.value : null;

      // Обогащаем помещения данными об аренде
      const enrichedProperties = propsList.map(property => {
        const activeRental = rentalsList.find(rental => 
          rental.property_id === property.id && rental.is_active
        );

        return {
          ...property,
          activeRental,
          status: activeRental ? 'occupied' : property.status || 'available',
          currentGuests: activeRental ? [activeRental.client?.first_name + ' ' + activeRental.client?.last_name] : [],
          checkIn: activeRental?.start_date ? new Date(activeRental.start_date).toLocaleDateString() : null,
          checkOut: activeRental?.end_date ? new Date(activeRental.end_date).toLocaleDateString() : null,
          isCheckedIn: activeRental?.checked_in || false,
          isCheckedOut: activeRental?.checked_out || false
        };
      });

      setRooms(enrichedProperties);
      setActiveRentals(rentalsList);
      
      // Устанавливаем лимиты организации
      if (limits) {
        setOrganizationLimits({
          current: enrichedProperties.length,
          max: limits.max_properties || 50
        });
      }

    } catch (error) {
      console.error('Failed to load data:', error);
      utils.showError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация помещений по этажу и статусу
  const currentFloorRooms = selectedFloor === 0 
    ? rooms // Если выбраны все этажи (0), показываем все помещения
    : rooms.filter(room => room.floor === selectedFloor);

  const filteredRooms = filterStatus === 'all' 
    ? currentFloorRooms 
    : currentFloorRooms.filter(room => room.status === filterStatus);

  // Статистика по текущему этажу
  const statusCounts = filteredRooms.reduce((acc, room) => {
    acc[room.status] = (acc[room.status] || 0) + 1;
    return acc;
  }, {});

  // Статистика по всем помещениям
  const totalStatusCounts = rooms.reduce((acc, room) => {
    acc[room.status] = (acc[room.status] || 0) + 1;
    return acc;
  }, {});

  // Добавляем "Все этажи" в список этажей
  const floorOptions = [0, 1, 2, 3, 4]; // 0 означает "Все этажи"



  // Обработчики событий
  const handlePropertyCreate = async (propertyData) => {
    try {
      const newProperty = await properties.create(propertyData);
      setRooms(prev => [...prev, newProperty]);
      setShowPropertyModal(false);
      utils.showSuccess('Помещение успешно создано');
      loadData(); // Перезагружаем данные
    } catch (error) {
      console.error('Failed to create property:', error);
      utils.showError(error.message || 'Не удалось создать помещение');
    }
  };

  const handlePropertyEdit = async (propertyData) => {
    try {
      const updatedProperty = await properties.update(selectedProperty.id, propertyData);
      setRooms(prev => prev.map(room => 
        room.id === selectedProperty.id ? { ...updatedProperty, ...room } : room
      ));
      setShowPropertyModal(false);
      setSelectedProperty(null);
      utils.showSuccess('Помещение успешно обновлено');
    } catch (error) {
      console.error('Failed to update property:', error);
      utils.showError('Не удалось обновить помещение');
    }
  };

  const handleRentalCreate = async (rentalData) => {
    try {
      const newRental = await rentals.create(rentalData);
      
      // Обновляем статус помещения
      setRooms(prev => prev.map(room => 
        room.id === rentalData.property_id 
          ? { 
              ...room, 
              status: 'occupied', 
              activeRental: newRental,
              currentGuests: [rentalData.clientName || 'Клиент'],
              checkIn: new Date(rentalData.start_date).toLocaleDateString(),
              checkOut: new Date(rentalData.end_date).toLocaleDateString(),
              isCheckedIn: false,
              isCheckedOut: false
            }
          : room
      ));
      
      setShowRentalModal(false);
      setSelectedProperty(null);
      utils.showSuccess('Аренда успешно создана');
    } catch (error) {
      console.error('Failed to create rental:', error);
      utils.showError('Не удалось создать аренду');
    }
  };

  const handleTaskCreate = async (taskData) => {
    try {
      const newTask = await tasks.create({
        ...taskData,
        property_id: selectedProperty.id
      });
      
      // Обновляем статус помещения если нужно
      if (taskData.task_type === 'cleaning') {
        setRooms(prev => prev.map(room => 
          room.id === selectedProperty.id 
            ? { ...room, status: 'cleaning' }
            : room
        ));
      } else if (taskData.task_type === 'maintenance') {
        setRooms(prev => prev.map(room => 
          room.id === selectedProperty.id 
            ? { ...room, status: 'maintenance' }
            : room
        ));
      }
      
      setShowTaskModal(false);
      setSelectedProperty(null);
      utils.showSuccess('Задача успешно создана');
    } catch (error) {
      console.error('Failed to create task:', error);
      utils.showError('Не удалось создать задачу');
    }
  };

  const handleCheckIn = async (property) => {
    try {
      if (!property.activeRental) {
        utils.showError('Нет активной аренды для заселения');
        return;
      }

      await rentals.checkIn(property.activeRental.id);
      
      // Обновляем локальное состояние
      setRooms(prev => prev.map(room => 
        room.id === property.id 
          ? { 
              ...room, 
              isCheckedIn: true,
              activeRental: {
                ...room.activeRental,
                checked_in: true,
                check_in_time: new Date().toISOString()
              }
            }
          : room
      ));
      
      utils.showSuccess('Клиент заселен');
    } catch (error) {
      console.error('Failed to check in:', error);
      utils.showError('Не удалось заселить клиента');
    }
  };

  const handleCheckOut = async (property) => {
    try {
      if (!property.activeRental) {
        utils.showError('Нет активной аренды для выселения');
        return;
      }

      if (!property.isCheckedIn) {
        utils.showError('Клиент не заселен, сначала выполните заселение');
        return;
      }

      if (property.isCheckedOut) {
        utils.showError('Клиент уже выселен');
        return;
      }

      if (!confirm('Вы уверены, что хотите выселить клиента?')) return;
      
      await rentals.checkOut(property.activeRental.id);
      
      // Обновляем статус помещения
      setRooms(prev => prev.map(room => 
        room.id === property.id 
          ? { 
              ...room, 
              status: 'available',
              activeRental: null,
              currentGuests: [],
              checkIn: null,
              checkOut: null,
              isCheckedIn: false,
              isCheckedOut: false
            }
          : room
      ));
      
      utils.showSuccess('Клиент выселен');
    } catch (error) {
      console.error('Failed to check out:', error);
      utils.showError('Не удалось выселить клиента: ' + (error.message || 'Неизвестная ошибка'));
    }
  };
  const handleBulkReleaseFromCleaning = async () => {
  try {
    setLoading(true);
    
    const response = await fetch('http://92.38.49.43:8000/api/properties/bulk-release-from-cleaning', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Не удалось освободить помещения');
    }

    const result = await response.json();
    
    // Обновляем локальное состояние
    setRooms(prev => prev.map(room => {
      const wasReleased = result.released.some(r => r.id === room.id);
      if (wasReleased) {
        return { ...room, status: 'available' };
      }
      return room;
    }));

    utils.showSuccess(
      `Освобождено ${result.released.length} помещений из уборки. 
       Пропущено: ${result.skipped.length} (есть незавершенные задачи)`
    );
    
    // Обновляем данные с сервера
    loadData();
    
  } catch (error) {
    console.error('Failed to release properties:', error);
    utils.showError('Не удалось освободить помещения: ' + error.message);
  } finally {
    setLoading(false);
  }
  };


  const handleExtendRental = async (property, days) => {
    try {
      if (!property.activeRental) return;
      
      const currentEndDate = new Date(property.activeRental.end_date);
      const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);
      
      await rentals.update(property.activeRental.id, {
        end_date: newEndDate.toISOString()
      });
      
      // Обновляем локальное состояние
      setRooms(prev => prev.map(room => 
        room.id === property.id 
          ? { 
              ...room, 
              checkOut: newEndDate.toLocaleDateString(),
              activeRental: {
                ...room.activeRental,
                end_date: newEndDate.toISOString()
              }
            }
          : room
      ));
      
      utils.showSuccess(`Аренда продлена на ${days} дн.`);
    } catch (error) {
      console.error('Failed to extend rental:', error);
      utils.showError('Не удалось продлить аренду');
    }
  };

  const handleCancelRental = async (property) => {
    try {
      if (!property.activeRental) return;
      
      if (!confirm('Вы уверены, что хотите отменить аренду?')) return;
      
      await rentals.cancel(property.activeRental.id, 'Отменено администратором');
      
      // Обновляем статус помещения
      setRooms(prev => prev.map(room => 
        room.id === property.id 
          ? { 
              ...room, 
              status: 'available',
              activeRental: null,
              currentGuests: [],
              checkIn: null,
              checkOut: null,
              isCheckedIn: false,
              isCheckedOut: false
            }
          : room
      ));
      
      utils.showSuccess('Аренда отменена');
    } catch (error) {
      console.error('Failed to cancel rental:', error);
      utils.showError('Не удалось отменить аренду');
    }
  };

  // Обработка клика по помещению
  const handleRoomClick = (room) => {
    setSelectedProperty(room);
    setShowPropertyDetails(true);
    
    if (onRoomClick) {
      onRoomClick(room);
    }
  };

  const handleRoomEdit = (e, room) => {
    e.stopPropagation();
    setSelectedProperty(room);
    setShowPropertyModal(true);
  };

  const canCreateProperty = () => {
    if (!organizationLimits) return true;
    return organizationLimits.current < organizationLimits.max;
  };

  // Утилиты для стилизации
  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#27ae60';
      case 'occupied': return '#e74c3c';
      case 'maintenance': return '#f39c12';
      case 'cleaning': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return 'Свободно';
      case 'occupied': return 'Занято';
      case 'maintenance': return 'Ремонт';
      case 'cleaning': return 'Уборка';
      default: return 'Неизвестно';
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

  if (loading) {
    return (
      <div className="floor-plan-loading">
        <div className="loading-spinner"></div>
        <p>Загрузка помещений...</p>
      </div>
    );
  }

  return (
    <div className="floor-plan">
      <div className="floor-plan-header">
        <div className="floor-selector">
          <label>Этаж:</label>
          {[1, 2, 3, 4].map(floor => (
            <button
              key={floor}
              className={`floor-btn ${selectedFloor === floor ? 'active' : ''}`}
              onClick={() => setSelectedFloor(floor)}
            >
              {floor}
            </button>
          ))}
        </div>

        <div className="status-filter">
          <label>Фильтр:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Все статусы</option>
            <option value="available">Свободно</option>
            <option value="occupied">Занято</option>
            <option value="maintenance">Ремонт</option>
            <option value="cleaning">Уборка</option>
          </select>
        </div>

        <div className="floor-actions">
          <button 
            className="create-property-btn"
            onClick={() => {
              setSelectedProperty(null);
              setShowPropertyModal(true);
            }}
            disabled={!canCreateProperty()}
            title={!canCreateProperty() ? 'Достигнут лимит помещений' : 'Создать новое помещение'}
          >
            <FiPlus />
            Создать помещение
            {organizationLimits && (
              <span className="limits-badge">
                {organizationLimits.current}/{organizationLimits.max}
              </span>
            )}
          </button>
          <button 
            className="btn btn-outline"
            onClick={handleBulkReleaseFromCleaning}
            title="Освободить помещения после завершения уборки"
            disabled={loading}
          >
            <FiEdit2 />
            {loading ? 'Освобождение...' : 'Освободить после уборки'}
          </button>
        </div>

        <div className="floor-stats">
          <div className="stat-item">
            <span className="stat-dot available"></span>
            <span>Свободно: {totalStatusCounts.available || 0}</span>
            <span>Свободно на этаже: {statusCounts.available || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot occupied"></span>
            <span>Занято : {totalStatusCounts.occupied || 0}</span>
            <span>Занято на этаже: {statusCounts.occupied || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot maintenance"></span>
            <span>Ремонт : {totalStatusCounts.maintenance || 0}</span>
            <span>Ремонт на этаже: {statusCounts.maintenance || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot cleaning"></span>
            <span>Уборка : {totalStatusCounts.cleaning || 0}</span>
            <span>Уборка на этаже: {statusCounts.cleaning || 0}</span>
          </div>
        </div>
      </div>

      {!canCreateProperty() && (
        <div className="limits-warning">
          <FiAlertCircle />
          <span>
            Достигнут лимит помещений ({organizationLimits.max}). 
            Обратитесь к администратору для увеличения лимита.
          </span>
        </div>
      )}

      <div className="floor-plan-grid">
        {filteredRooms.map(room => (
          <div
            key={room.id}
            className={`room-card ${room.status}`}
            onClick={() => handleRoomClick(room)}
            style={{
              borderColor: getStatusColor(room.status),
              cursor: 'pointer'
            }}
          >
            <div className="room-header">
              <span className="room-number">{room.number}</span>
              <div className="room-actions">
                <button
                  className="room-edit-btn"
                  onClick={(e) => handleRoomEdit(e, room)}
                  title="Редактировать"
                >
                  <FiEdit2 size={14} />
                </button>
                <div className="room-status-indicator">
                  {room.status === 'available' && <FiCheck />}
                  {room.status === 'occupied' && <span className="occupied-dot"></span>}
                  {room.status === 'maintenance' && <FiTool />}
                  {room.status === 'cleaning' && <FiEdit2 />}
                </div>
              </div>
            </div>

            <div className="room-type">{getTypeText(room.property_type)}</div>
            
            <div className="room-status">{getStatusText(room.status)}</div>

            {room.status === 'occupied' && room.currentGuests && room.currentGuests.length > 0 && (
              <div className="room-client">
                <div className="client-name">{room.currentGuests[0]}</div>
                <div className="client-dates">
                  {room.checkIn} — {room.checkOut}
                </div>
                
                {/* Статус заселения */}
                <div className="checkin-status">
                  {!room.isCheckedIn && (
                    <span className="status-badge pending">Ожидает заселения</span>
                  )}
                  {room.isCheckedIn && !room.isCheckedOut && (
                    <span className="status-badge active">Заселен</span>
                  )}
                  {room.isCheckedOut && (
                    <span className="status-badge completed">Выселен</span>
                  )}
                </div>
                
                {/* Быстрые действия для аренды */}
                <div className="rental-quick-actions">
                  {!room.isCheckedIn && (
                    <button
                      className="quick-action-btn checkin"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckIn(room);
                      }}
                      title="Заселить"
                    >
                      <FiPlay size={12} />
                    </button>
                  )}
                  
                  {room.isCheckedIn && !room.isCheckedOut && (
                    <>
                      <button
                        className="quick-action-btn extend"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtendRental(room, 1);
                        }}
                        title="Продлить на 1 день"
                      >
                        +1д
                      </button>
                      <button
                        className="quick-action-btn extend"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtendRental(room, 7);
                        }}
                        title="Продлить на неделю"
                      >
                        +1н
                      </button>
                      <button
                        className="quick-action-btn checkout"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckOut(room);
                        }}
                        title="Выселить"
                      >
                        <FiPause size={12} />
                      </button>
                    </>
                  )}
                  
                  <button
                    className="quick-action-btn terminate"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelRental(room);
                    }}
                    title="Отменить аренду"
                  >
                    <FiX size={12} />
                  </button>
                </div>
              </div>
            )}

            {(room.hourly_rate || room.daily_rate || room.monthly_rate) && (
              <div className="room-rates">
                {room.hourly_rate && (
                  <div className="rate-item">₸ {room.hourly_rate.toLocaleString()}/час</div>
                )}
                {room.daily_rate && (
                  <div className="rate-item">₸ {room.daily_rate.toLocaleString()}/день</div>
                )}
                {room.monthly_rate && (
                  <div className="rate-item">₸ {room.monthly_rate.toLocaleString()}/мес</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="no-rooms">
          <p>
            {filterStatus === 'all' 
              ? 'Нет помещений на этом этаже' 
              : 'Нет помещений с выбранным статусом'
            }
          </p>
          {filterStatus === 'all' && canCreateProperty() && (
            <button 
              className="create-first-property-btn"
              onClick={() => {
                setSelectedProperty(null);
                setShowPropertyModal(true);
              }}
            >
              <FiPlus />
              Создать первое помещение
            </button>
          )}
        </div>
      )}

      {/* Модальные окна */}
      {showPropertyModal && (
        <PropertyModal
          property={selectedProperty}
          organizationLimits={organizationLimits}
          onClose={() => {
            setShowPropertyModal(false);
            setSelectedProperty(null);
          }}
          onSubmit={selectedProperty ? handlePropertyEdit : handlePropertyCreate}
        />
      )}

      {showRentalModal && selectedProperty && (
        <RentalModal
          room={selectedProperty}
          onClose={() => {
            setShowRentalModal(false);
            setSelectedProperty(null);
          }}
          onSubmit={handleRentalCreate}
        />
      )}

      {showTaskModal && selectedProperty && (
        <TaskModal
          property={selectedProperty}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedProperty(null);
          }}
          onSubmit={handleTaskCreate}
        />
      )}

  {showPropertyDetails && selectedProperty && (
    <PropertyDetailsModal
      property={selectedProperty}
      onClose={() => {
        setShowPropertyDetails(false);
        setSelectedProperty(null);
      }}
      onCreateRental={() => {
        setShowPropertyDetails(false);
        setShowRentalModal(true);
      }}
      onCreateTask={() => {
        setShowPropertyDetails(false);
        setShowTaskModal(true);
      }}
      onEdit={() => {
        setShowPropertyDetails(false);
        setShowPropertyModal(true);
      }}
      onCheckIn={handleCheckIn}
      onCheckOut={handleCheckOut}
      onCancelRental={handleCancelRental}
      // Убираем onExtendRental - функция теперь внутри PropertyDetailsModal
    />
  )}
    </div>
  );
};

export default FloorPlan;