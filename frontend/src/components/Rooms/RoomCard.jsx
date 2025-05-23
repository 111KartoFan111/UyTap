import { useTranslation } from '../../contexts/LanguageContext';

// Компонент карточки номера
const RoomCard = ({ room, onClick }) => {
  const { t } = useTranslation();
  
  return (
    <div 
      key={room.id} 
      className={`room-card ${room.status}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <h4>{room.type === 'Villa' ? room.number : `${t('rooms.room')} ${room.number}`}</h4>
      
      {room.status === 'occupied' && room.currentGuests.length > 0 && (
        <div className="guest-avatars">
          {room.currentGuests.map((guest, i) => (
            <img 
              key={i}
              src={`https://i.pravatar.cc/32?img=${room.id + i + 90}`} 
              alt={guest} 
            />
          ))}
        </div>
      )}
      
      {room.checkInDate && (
        <p className="dates">
          {room.checkInDate.split('-')[1]} {room.checkInDate.split('-')[2]} - {room.checkOutDate.split('-')[1]} {room.checkOutDate.split('-')[2]}
        </p>
      )}
      
      {room.status === 'maintenance' && (
        <div className="maintenance-badge">🔧</div>
      )}
      
      {room.status === 'occupied' && (
        <div className="occupied-indicator">!</div>
      )}
      
      {room.status === 'available' && (
        <div className="available-indicator">🔗</div>
      )}
      
      {room.type === 'Villa' && room.status === 'maintenance' && (
        <div className="maintenance-banner">
          {t('rooms.maintenance.extraBed')}<br/>
          {t('rooms.maintenance.tvNotWorking')}
        </div>
      )}
    </div>
  );
};

export default RoomCard;