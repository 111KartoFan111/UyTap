import { useState, useEffect } from 'react';
import { FiEdit2, FiTool, FiCheck } from 'react-icons/fi';
import './FloorPlan.css';

const FloorPlan = ({ onRoomClick }) => {
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [rooms, setRooms] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  // Генерируем комнаты для примера
  useEffect(() => {
    const generateRooms = () => {
      const roomsData = [];
      
      // 3 этажа по 20 комнат
      for (let floor = 1; floor <= 3; floor++) {
        for (let room = 1; room <= 20; room++) {
          const roomNumber = `${floor}-${room.toString().padStart(2, '0')}`;
          const statuses = ['available', 'occupied', 'maintenance', 'cleaning'];
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
          
          roomsData.push({
            id: `${floor}-${room}`,
            number: roomNumber,
            floor: floor,
            status: randomStatus,
            type: room <= 10 ? 'hourly' : room <= 15 ? 'daily' : 'monthly',
            client: randomStatus === 'occupied' ? getRandomClient() : null,
            rate: getRandomRate(randomStatus === 'occupied' ? 'hourly' : 'daily'),
            checkIn: randomStatus === 'occupied' ? getRandomDate() : null,
            checkOut: randomStatus === 'occupied' ? getRandomDate(true) : null
          });
        }
      }
      
      setRooms(roomsData);
    };

    generateRooms();
  }, []);

  const getRandomClient = () => {
    const clients = [
      'Анна Петрова', 'Марат Саметов', 'Дмитрий Ким', 'Света Жанова',
      'Алексей Иванов', 'Мария Казакова', 'Даулет Мурат', 'Нина Сергеева'
    ];
    return clients[Math.floor(Math.random() * clients.length)];
  };

  const getRandomRate = (type) => {
    switch (type) {
      case 'hourly': return Math.floor(Math.random() * 2000) + 2500;
      case 'daily': return Math.floor(Math.random() * 10000) + 15000;
      case 'monthly': return Math.floor(Math.random() * 150000) + 180000;
      default: return 0;
    }
  };

  const getRandomDate = (future = false) => {
    const now = new Date();
    const days = future ? Math.floor(Math.random() * 30) + 1 : -Math.floor(Math.random() * 5);
    const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  };

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
      case 'hourly': return 'Почасово';
      case 'daily': return 'Посуточно';
      case 'monthly': return 'Помесячно';
      default: return '';
    }
  };

  const statusCounts = currentFloorRooms.reduce((acc, room) => {
    acc[room.status] = (acc[room.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="floor-plan">
      <div className="floor-plan-header">
        <div className="floor-selector">
          <label>Этаж:</label>
          {[1, 2, 3].map(floor => (
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

      <div className="floor-plan-grid">
        {filteredRooms.map(room => (
          <div
            key={room.id}
            className={`room-card ${room.status}`}
            onClick={() => onRoomClick && onRoomClick(room)}
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
                <div className="client-name">{room.client}</div>
                <div className="client-dates">
                  {room.checkIn} — {room.checkOut}
                </div>
              </div>
            )}

            {room.rate && (
              <div className="room-rate">
                ₸ {room.rate.toLocaleString()}
                {room.type === 'hourly' && '/час'}
                {room.type === 'daily' && '/сутки'}
                {room.type === 'monthly' && '/мес'}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="no-rooms">
          <p>Нет комнат с выбранным статусом</p>
        </div>
      )}
    </div>
  );
};

export default FloorPlan;