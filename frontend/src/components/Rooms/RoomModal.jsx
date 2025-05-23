import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import BookingModal from './BookingModal';
import './RoomModal.css';

const RoomModal = ({ room, onClose }) => {
  const { t } = useTranslation();
  const [showBookingForm, setShowBookingForm] = useState(false);
  
  const getStatusText = (status) => {
    switch(status) {
      case 'occupied': return t('rooms.statuses.occupied');
      case 'available': return t('rooms.statuses.available');
      case 'maintenance': return t('rooms.statuses.maintenance');
      default: return status;
    }
  };

  const handleBookingSubmit = (bookingData) => {
    console.log('Booking submitted:', bookingData);
    // Здесь можно добавить логику отправки данных на сервер
    // Например: await api.createBooking(room.id, bookingData);
    
    // Показать уведомление об успешном бронировании
    alert(t('booking.success', { room: room.type === 'Villa' ? room.number : `${t('rooms.room')} ${room.number}` }));
    
    // Закрыть модальные окна
    setShowBookingForm(false);
    onClose();
  };
  
  return (
    <>
      <div className="room-modal-overlay" onClick={onClose}>
        <div className="room-modal-content" onClick={e => e.stopPropagation()}>
          <div className="room-modal-header">
            <h2>{room.type === 'Villa' ? room.number : `${t('rooms.room')} ${room.number}`}</h2>
            <button className="close-btn" onClick={onClose}>
              <FiX size={20} />
            </button>
          </div>
          
          <div className="room-modal-body">
            <div className="room-status">
              <span className={`status-badge ${room.status}`}>
                {getStatusText(room.status)}
              </span>
            </div>
            
            <div className="room-details">
              <div className="detail-row">
                <span className="detail-label">{t('rooms.type')}:</span>
                <span className="detail-value">{t(`rooms.roomTypes.${room.type.toLowerCase()}`)}</span>
              </div>
              
              {room.currentGuests && room.currentGuests.length > 0 && (
                <div className="detail-row">
                  <span className="detail-label">{t('rooms.currentGuests')}:</span>
                  <div className="guest-list">
                    {room.currentGuests.map((guest, index) => (
                      <div key={index} className="guest-item">
                        <img 
                          src={`https://i.pravatar.cc/40?img=${room.id + index + 90}`} 
                          alt={guest} 
                        />
                        <span>{guest}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {room.checkInDate && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">{t('rooms.checkIn')}:</span>
                    <span className="detail-value">{room.checkInDate}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('rooms.checkOut')}:</span>
                    <span className="detail-value">{room.checkOutDate}</span>
                  </div>
                </>
              )}
              
              {room.status === 'maintenance' && (
                <div className="maintenance-info">
                  <h3>{t('rooms.maintenanceInfo')}</h3>
                  <ul>
                    <li>{t('rooms.maintenance.extraBed')}</li>
                    <li>{t('rooms.maintenance.tvNotWorking')}</li>
                  </ul>
                </div>
              )}
            </div>
            
            <div className="room-actions">
              {room.status === 'available' && (
                <button 
                  className="action-btn book-btn"
                  onClick={() => setShowBookingForm(true)}
                >
                  {t('rooms.actions.book')}
                </button>
              )}
              {room.status === 'occupied' && (
                <button className="action-btn message-btn">
                  {t('rooms.actions.messageGuest')}
                </button>
              )}
              <button className="action-btn">
                {t('rooms.actions.viewHistory')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Форма бронирования */}
      {showBookingForm && (
        <BookingModal
          room={room}
          onClose={() => setShowBookingForm(false)}
          onSubmit={handleBookingSubmit}
        />
      )}
    </>
  );
};

export default RoomModal;