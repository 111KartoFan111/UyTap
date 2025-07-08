// frontend/src/pages/Manager/FloorPlan.jsx
import { useState, useEffect } from 'react';
import { FiEdit2, FiTool, FiCheck, FiRefreshCw, FiPlus } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import './FloorPlan.css';

const FloorPlan = ({ onRoomClick, compact = false }) => {
  const { properties, rentals } = useData();
  const { user } = useAuth();
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [rooms, setRooms] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeRentals, setActiveRentals] = useState([]);

  // Load data on mount
  useEffect(() => {
    loadFloorData();
  }, []);

  const loadFloorData = async () => {
    try {
      setLoading(true);
      
      // Load properties and active rentals
      const [propertiesData, rentalsData] = await Promise.allSettled([
        properties.getAll(),
        rentals.getAll({ is_active: true })
      ]);

      const propsList = propertiesData.status === 'fulfilled' ? propertiesData.value : [];
      const rentalsList = rentalsData.status === 'fulfilled' ? rentalsData.value : [];

      console.log('Floor plan data loaded:', { propsList, rentalsList });

      // Process properties data
      const processedRooms = propsList.map(property => {
        // Find active rental for this property
        const activeRental = rentalsList.find(rental => 
          rental.property_id === property.id || 
          rental.property?.id === property.id
        );

        return {
          id: property.id,
          number: property.number,
          floor: property.floor || 1,
          status: property.status,
          type: property.property_type,
          name: property.name,
          area: property.area,
          max_occupancy: property.max_occupancy,
          daily_rate: property.daily_rate,
          hourly_rate: property.hourly_rate,
          monthly_rate: property.monthly_rate,
          client: activeRental ? {
            name: `${activeRental.client?.first_name || ''} ${activeRental.client?.last_name || ''}`.trim(),
            checkIn: activeRental.start_date,
            checkOut: activeRental.end_date,
            phone: activeRental.client?.phone
          } : null,
          rental: activeRental
        };
      });

      setRooms(processedRooms);
      setActiveRentals(rentalsList);

    } catch (error) {
      console.error('Failed to load floor data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get available floors
  const availableFloors = [...new Set(rooms.map(room => room.floor))].sort();
  
  // Filter rooms by floor and status
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
      case 'suspended': return '#95a5a6';
      case 'out_of_order': return '#8b0000';
      default: return '#95a5a6';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return 'Свободно';
      case 'occupied': return 'Занято';
      case 'maintenance': return 'Ремонт';
      case 'cleaning': return 'Уборка';
      case 'suspended': return 'Приостановлено';
      case 'out_of_order': return 'Не работает';
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
      default: return type || 'Помещение';
    }
  };

  const getRateDisplay = (room) => {
    if (room.hourly_rate) {
      return `₸ ${room.hourly_rate.toLocaleString()}/час`;
    } else if (room.daily_rate) {
      return `₸ ${room.daily_rate.toLocaleString()}/сутки`;
    } else if (room.monthly_rate) {
      return `₸ ${room.monthly_rate.toLocaleString()}/мес`;
    }
    return '';
  };

  // Calculate status counts for current floor
  const statusCounts = currentFloorRooms.reduce((acc, room) => {
    acc[room.status] = (acc[room.status] || 0) + 1;
    return acc;
  }, {});

  const handleRoomClick = (room) => {
    if (onRoomClick) {
      onRoomClick(room);
    }
  };

  const handleStatusChange = async (roomId, newStatus) => {
    try {
      await properties.updateStatus(roomId, newStatus);
      await loadFloorData(); // Refresh data
    } catch (error) {
      console.error('Failed to update room status:', error);
    }
  };

  if (loading) {
    return (
      <div className="floor-plan loading">
        <div className="loading-spinner"></div>
        <p>Загрузка плана этажа...</p>
      </div>
    );
  }

  return (
    <div className={`floor-plan ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="floor-plan-header">
          <div className="floor-selector">
            <label>Этаж:</label>
            {availableFloors.length > 0 ? (
              availableFloors.map(floor => (
                <button
                  key={floor}
                  className={`floor-btn ${selectedFloor === floor ? 'active' : ''}`}
                  onClick={() => setSelectedFloor(floor)}
                >
                  {floor}
                </button>
              ))
            ) : (
              <span className="no-floors">Нет этажей</span>
            )}
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
              <option value="suspended">Приостановлено</option>
              <option value="out_of_order">Не работает</option>
            </select>
          </div>

          <div className="floor-controls">
            <button 
              className="refresh-btn"
              onClick={loadFloorData}
              disabled={loading}
              title="Обновить данные"
            >
              <FiRefreshCw />
            </button>
          </div>
        </div>
      )}

      {!compact && (
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
      )}

      <div className={`floor-plan-grid ${compact ? 'compact-grid' : ''}`}>
        {filteredRooms.length > 0 ? (
          filteredRooms.map(room => (
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
                <div className="room-status-indicator">
                  {room.status === 'available' && <FiCheck />}
                  {room.status === 'occupied' && <span className="occupied-dot"></span>}
                  {room.status === 'maintenance' && <FiTool />}
                  {room.status === 'cleaning' && <FiEdit2 />}
                </div>
              </div>

              <div className="room-type">{getTypeText(room.type)}</div>
              
              <div className="room-status">{getStatusText(room.status)}</div>

              {room.client && (
                <div className="room-client">
                  <div className="client-name">{room.client.name || 'Клиент'}</div>
                  <div className="client-dates">
                    {room.client.checkIn && new Date(room.client.checkIn).toLocaleDateString('ru-RU')} — 
                    {room.client.checkOut && new Date(room.client.checkOut).toLocaleDateString('ru-RU')}
                  </div>
                  {room.client.phone && (
                    <div className="client-phone">{room.client.phone}</div>
                  )}
                </div>
              )}

              {!compact && getRateDisplay(room) && (
                <div className="room-rate">
                  {getRateDisplay(room)}
                </div>
              )}

              {!compact && room.area && (
                <div className="room-details">
                  <span>{room.area} м²</span>
                  {room.max_occupancy && <span>до {room.max_occupancy} чел.</span>}
                </div>
              )}

              {!compact && user.role === 'admin' && (
                <div className="room-actions">
                  <select
                    value={room.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleStatusChange(room.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="available">Свободно</option>
                    <option value="occupied">Занято</option>
                    <option value="maintenance">Ремонт</option>
                    <option value="cleaning">Уборка</option>
                    <option value="suspended">Приостановлено</option>
                    <option value="out_of_order">Не работает</option>
                  </select>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="no-rooms">
            {rooms.length === 0 ? (
              <div className="empty-state">
                <FiPlus size={48} />
                <h3>Нет помещений</h3>
                <p>Добавьте первое помещение для начала работы</p>
                <button className="btn-primary">
                  Добавить помещение
                </button>
              </div>
            ) : (
              <p>Нет помещений с выбранным статусом на этаже {selectedFloor}</p>
            )}
          </div>
        )}
      </div>

      {compact && filteredRooms.length > 6 && (
        <div className="compact-more">
          <span>И еще {filteredRooms.length - 6} помещений...</span>
        </div>
      )}
    </div>
  );
};

export default FloorPlan;