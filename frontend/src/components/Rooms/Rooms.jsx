import { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiList, FiGrid } from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import RoomCard from './RoomCard';
import RoomModal from './RoomModal';
import './Rooms.css';

const Rooms = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const roomsData = await import('../../mockData/rooms.json');
      setRooms(roomsData.rooms);
    };

    loadData();
  }, []);

  const standardRooms = rooms.filter(r => r.type === 'Standard');
  const superiorRooms = rooms.filter(r => r.type === 'Superior');
  const villas = rooms.filter(r => r.type === 'Villa');

  const handleRoomClick = (room) => {
    setSelectedRoom(room);
  };

  const closeModal = () => {
    setSelectedRoom(null);
  };

  const renderGridView = () => (
    <>
      <div className="room-section">
        <h3>{t('rooms.roomTypes.standard')}</h3>
        <div className="rooms-grid">
          {standardRooms.map(room => (
            <RoomCard 
              key={room.id} 
              room={room} 
              onClick={() => handleRoomClick(room)} 
            />
          ))}
        </div>
      </div>

      <div className="room-section">
        <h3>{t('rooms.roomTypes.superior')}</h3>
        <div className="rooms-grid">
          {superiorRooms.map(room => (
            <RoomCard 
              key={room.id} 
              room={room} 
              onClick={() => handleRoomClick(room)} 
            />
          ))}
        </div>
      </div>

      <div className="room-section">
        <h3>{t('rooms.roomTypes.villas')}</h3>
        <div className="rooms-grid villas-grid">
          {villas.map(room => (
            <RoomCard 
              key={room.id} 
              room={room} 
              onClick={() => handleRoomClick(room)} 
            />
          ))}
        </div>
      </div>
    </>
  );

  const renderTimelineView = () => {
    const days = ['Thu 17', 'Fri 18', 'Sat 19', 'Sun 20', 'Mon 21', 'Tue 22', 'Wed 23', 'Thu 24', 'Fri 25', 'Sat 26', 'Sun 27', 'Mon 28', 'Tue 29', 'Wed 30', 'Thu 01', 'Fri 02', 'Sat 03', 'Sun 04'];
    const percentages = ['10%', '20%', '20%', '20%', '20%', '40%', '40%', '40%', '30%', '20%', '20%', '20%', '20%', '20%', '10%', '10%', '10%', '10%'];

    return (
      <div className="timeline-view">
        <div className="timeline-header">
          <span className="timeline-date">Jun 2018</span>
          <span className="timeline-date today">Today</span>
          <span className="timeline-date">Jul 2018</span>
        </div>
        
        <div className="timeline-grid">
          <div className="timeline-labels">
            <div className="label-section">{t('rooms.roomTypes.standard')}</div>
            {standardRooms.map(room => (
              <div 
                key={room.id} 
                className="room-label" 
                onClick={() => handleRoomClick(room)}
                style={{ cursor: 'pointer' }}
              >
                {t('rooms.room')} {room.number}
              </div>
            ))}
            
            <div className="label-section">{t('rooms.roomTypes.superior')}</div>
            {superiorRooms.map(room => (
              <div 
                key={room.id} 
                className="room-label"
                onClick={() => handleRoomClick(room)}
                style={{ cursor: 'pointer' }}
              >
                {t('rooms.room')} {room.number}
              </div>
            ))}
            
            <div className="label-section">{t('rooms.roomTypes.villas')}</div>
            {villas.map(room => (
              <div 
                key={room.id} 
                className="room-label"
                onClick={() => handleRoomClick(room)}
                style={{ cursor: 'pointer' }}
              >
                {room.number}
              </div>
            ))}
          </div>

          <div className="timeline-content">
            <div className="timeline-header-days">
              {days.map((day, i) => (
                <div key={i} className="day-header">
                  <div className="day-label">{day}</div>
                  <div className="occupancy-rate">{percentages[i]}</div>
                </div>
              ))}
            </div>

            <div className="timeline-rows">
              <div className="timeline-section-row"></div>
              {standardRooms.map(room => (
                <div key={room.id} className="timeline-row">
                  {room.number === '103' && (
                    <div 
                      className="booking-bar" 
                      style={{ gridColumn: '1 / 14', backgroundColor: '#90c695' }}
                      onClick={() => handleRoomClick(room)}
                    >
                      Keniesha Wood
                    </div>
                  )}
                  {room.number === '105' && (
                    <div 
                      className="booking-bar" 
                      style={{ gridColumn: '2 / 8', backgroundColor: '#90c695' }}
                      onClick={() => handleRoomClick(room)}
                    >
                      Alex Walker
                    </div>
                  )}
                  {room.number === '107' && (
                    <div 
                      className="booking-bar" 
                      style={{ gridColumn: '6 / 8', backgroundColor: '#5bc0de' }}
                      onClick={() => handleRoomClick(room)}
                    >
                      {t('rooms.newGuest')} →
                    </div>
                  )}
                </div>
              ))}

              <div className="timeline-section-row"></div>
              {superiorRooms.map(room => (
                <div key={room.id} className="timeline-row">
                  {room.number === '202' && (
                    <div 
                      className="booking-bar" 
                      style={{ gridColumn: '1 / 19', backgroundColor: '#90c695' }}
                      onClick={() => handleRoomClick(room)}
                    >
                      Usha Oliver
                    </div>
                  )}
                </div>
              ))}

              <div className="timeline-section-row"></div>
              {villas.map(room => (
                <div key={room.id} className="timeline-row">
                  {room.number === 'Villa 2' && (
                    <div 
                      className="booking-bar" 
                      style={{ gridColumn: '6 / 8', backgroundColor: '#90c695' }}
                      onClick={() => handleRoomClick(room)}
                    >
                      Sung Jin-Shil
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rooms">
      <div className="rooms-header">
        <h1>{t('rooms.title')}</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input type="text" placeholder={t('common.search')} />
          </div>
          <button className="filter-btn">
            <FiFilter /> {t('common.filter')}
          </button>
          <div className="view-toggle">
            <span>{t('common.view')}:</span>
            <button 
              className={viewMode === 'timeline' ? 'active' : ''}
              onClick={() => setViewMode('timeline')}
            >
              <FiList /> {t('rooms.views.timeline')}
            </button>
            <button 
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              <FiGrid /> {t('rooms.views.scheme')}
            </button>
          </div>
        </div>
      </div>

      <div className="rooms-content">
        {viewMode === 'grid' ? renderGridView() : renderTimelineView()}
      </div>
      
      {selectedRoom && (
        <RoomModal room={selectedRoom} onClose={closeModal} />
      )}
    </div>
  );
};

export default Rooms;