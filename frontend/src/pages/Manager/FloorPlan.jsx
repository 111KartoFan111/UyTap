import { useState, useEffect } from 'react';
import { FiEdit2, FiTool, FiCheck, FiPlus, FiAlertCircle, FiCalendar, FiClock, FiPlay, FiPause, FiX } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import PropertyModal from './PropertyModal';
import RentalModal from './RentalModal';
import TaskModal from './TaskModal';
import PropertyDetailsModal from './PropertyDetailsModal';
import './FloorPlan.css';

const FloorPlan = ({ onRoomClick }) => {
  const { properties, rentals, tasks, utils } = useData();
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
      const [propertiesData, rentalsData] = await Promise.allSettled([
        properties.getAll(),
        rentals.getAll({ is_active: true })
      ]);

      const propsList = propertiesData.status === 'fulfilled' ? propertiesData.value : [];
      const rentalsList = rentalsData.status === 'fulfilled' ? rentalsData.value : [];

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
          checkOut: activeRental?.end_date ? new Date(activeRental.end_date).toLocaleDateString() : null
        };
      });

      setRooms(enrichedProperties);
      setActiveRentals(rentalsList);
      
      // Моковые лимиты (в реальном приложении получать из API)
      setOrganizationLimits({
        current: enrichedProperties.length,
        max: 50
      });

    } catch (error) {
      console.error('Failed to load data:', error);
      utils.showError('Не удалось загрузить данные');
      generateMockRooms();
    } finally {
      setLoading(false);
    }
  };

  // Генерация моковых данных в случае ошибки API
  const generateMockRooms = () => {
    const mockRooms = [];
    for (let floor = 1; floor <= 3; floor++) {
      for (let room = 1; room <= 20; room++) {
        const roomNumber = `${floor}-${room.toString().padStart(2, '0')}`;
        const statuses = ['available', 'occupied', 'maintenance', 'cleaning'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        mockRooms.push({
          id: `${floor}-${room}`,
          number: roomNumber,
          name: `Комната ${roomNumber}`,
          floor: floor,
          status: randomStatus,
          property_type: room <= 10 ? 'room' : room <= 15 ? 'studio' : 'apartment',
          hourly_rate: Math.floor(Math.random() * 2000) + 2500,
          daily_rate: Math.floor(Math.random() * 10000) + 15000,
          monthly_rate: Math.floor(Math.random() * 150000) + 180000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
          currentGuests: randomStatus === 'occupied' ? ['Тестовый Клиент'] : [],
          checkIn: randomStatus === 'occupied' ? new Date().toLocaleDateString() : null,
          checkOut: randomStatus === 'occupied' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString() : null
        });
      }
    }
    setRooms(mockRooms);
    setOrganizationLimits({ current: mockRooms.length, max: 50 });
  };

  // Фильтрация помещений по этажу и статусу
  const currentFloorRooms = rooms.filter(room => room.floor === selectedFloor);
  const filteredRooms = filterStatus === 'all' 
    ? currentFloorRooms 
    : currentFloorRooms.filter(room => room.status === filterStatus);

  // Статистика по этажу
  const statusCounts = currentFloorRooms.reduce((acc, room) => {
    acc[room.status] = (acc[room.status] || 0) + 1;
    return acc;
  }, {});

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
      const newRental = await rentals.create({
        ...rentalData,
        property_id: selectedProperty.id
      });
      
      // Обновляем статус помещения
      setRooms(prev => prev.map(room => 
        room.id === selectedProperty.id 
          ? { 
              ...room, 
              status: 'occupied', 
              activeRental: newRental,
              currentGuests: [rentalData.clientName],
              checkIn: new Date(rentalData.startDate).toLocaleDateString(),
              checkOut: new Date(rentalData.endDate).toLocaleDateString()
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

  const handleTerminateRental = async (property) => {
    try {
      if (!property.activeRental) return;
      
      if (!confirm('Вы уверены, что хотите завершить аренду?')) return;
      
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
              checkOut: null
            }
          : room
      ));
      
      utils.showSuccess('Аренда завершена');
    } catch (error) {
      console.error('Failed to terminate rental:', error);
      utils.showError('Не удалось завершить аренду');
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
        </div>

        <div className="floor-stats">
          <div className="stat-item">
            <span className="stat-dot available"></span>
            <span>Свободно: {statusCounts.available || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot occupied"></span>
            <span>Занято: {statusCounts.occupied || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot maintenance"></span>
            <span>Ремонт: {statusCounts.maintenance || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot cleaning"></span>
            <span>Уборка: {statusCounts.cleaning || 0}</span>
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
                
                {/* Быстрые действия для аренды */}
                <div className="rental-quick-actions">
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
                    className="quick-action-btn extend"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtendRental(room, 30);
                    }}
                    title="Продлить на месяц"
                  >
                    +1м
                  </button>
                  <button
                    className="quick-action-btn terminate"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTerminateRental(room);
                    }}
                    title="Завершить аренду"
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
          onExtendRental={handleExtendRental}
          onTerminateRental={handleTerminateRental}
        />
      )}
    </div>
  );
};

export default FloorPlan;