import { useState, useEffect } from 'react';
import { FiEdit2, FiTool, FiCheck, FiPlus, FiAlertCircle } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import PropertyModal from './PropertyModal';
import './FloorPlan.css';

const FloorPlan = ({ onRoomClick }) => {
  const { properties, utils } = useData();
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [rooms, setRooms] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [organizationLimits, setOrganizationLimits] = useState(null);

  // Загрузка помещений и лимитов организации
  useEffect(() => {
    loadPropertiesData();
    loadOrganizationLimits();
  }, []);

  const loadPropertiesData = async () => {
    try {
      setLoading(true);
      const propertiesData = await properties.getAll();
      setRooms(propertiesData);
    } catch (error) {
      console.error('Failed to load properties:', error);
      utils.showError('Не удалось загрузить помещения');
      // Fallback к моковым данным при ошибке
      generateMockRooms();
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationLimits = async () => {
    try {
      // Получаем информацию об организации из контекста пользователя
      const user = JSON.parse(localStorage.getItem('user_data') || '{}');
      if (user?.organization_id) {
        // Пока используем моковые данные для лимитов
        setOrganizationLimits({
          current: rooms.length,
          max: 50 // Это должно прийти из API
        });
      }
    } catch (error) {
      console.error('Failed to load organization limits:', error);
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
          is_active: true
        });
      }
    }
    setRooms(mockRooms);
  };

  // Обновление лимитов при изменении количества помещений
  useEffect(() => {
    if (organizationLimits) {
      setOrganizationLimits(prev => ({
        ...prev,
        current: rooms.length
      }));
    }
  }, [rooms.length]);

  const currentFloorRooms = rooms.filter(room => room.floor === selectedFloor);
  const filteredRooms = filterStatus === 'all' 
    ? currentFloorRooms 
    : currentFloorRooms.filter(room => room.status === filterStatus);

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

  const statusCounts = currentFloorRooms.reduce((acc, room) => {
    acc[room.status] = (acc[room.status] || 0) + 1;
    return acc;
  }, {});

  // Обработка создания нового помещения
  const handleCreateProperty = async (propertyData) => {
    try {
      const newProperty = await properties.create(propertyData);
      setRooms(prev => [...prev, newProperty]);
      setShowPropertyModal(false);
      utils.showSuccess('Помещение успешно создано');
    } catch (error) {
      console.error('Failed to create property:', error);
      utils.showError(error.message || 'Не удалось создать помещение');
    }
  };

  // Обработка редактирования помещения
  const handleEditProperty = async (propertyData) => {
    try {
      const updatedProperty = await properties.update(selectedProperty.id, propertyData);
      setRooms(prev => prev.map(room => 
        room.id === selectedProperty.id ? updatedProperty : room
      ));
      setShowPropertyModal(false);
      setSelectedProperty(null);
      utils.showSuccess('Помещение успешно обновлено');
    } catch (error) {
      console.error('Failed to update property:', error);
      utils.showError('Не удалось обновить помещение');
    }
  };

  // Обработка клика по помещению
  const handleRoomClick = (room) => {
    if (onRoomClick) {
      onRoomClick(room);
    }
  };

  // Обработка редактирования помещения
  const handleRoomEdit = (e, room) => {
    e.stopPropagation();
    setSelectedProperty(room);
    setShowPropertyModal(true);
  };

  // Проверка возможности создания нового помещения
  const canCreateProperty = () => {
    if (!organizationLimits) return true;
    return organizationLimits.current < organizationLimits.max;
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
          {[1, 2, 3,4].map(floor => (
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

            {room.status === 'occupied' && room.currentGuests && (
              <div className="room-client">
                <div className="client-name">{room.currentGuests[0]}</div>
                <div className="client-dates">
                  {room.checkIn} — {room.checkOut}
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

      {/* Модальное окно создания/редактирования помещения */}
      {showPropertyModal && (
        <PropertyModal
          property={selectedProperty}
          organizationLimits={organizationLimits}
          onClose={() => {
            setShowPropertyModal(false);
            setSelectedProperty(null);
          }}
          onSubmit={selectedProperty ? handleEditProperty : handleCreateProperty}
        />
      )}
    </div>
  );
};

export default FloorPlan;