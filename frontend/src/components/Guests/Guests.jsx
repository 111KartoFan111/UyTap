import { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiX, FiEdit2, FiDollarSign } from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import './Guests.css';

const Guests = () => {
  const { t } = useTranslation();
  const [guests, setGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [showAllGuests, setShowAllGuests] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const guestsData = await import('../../mockData/guests.json');
      setGuests(guestsData.guests);
    };

    loadData();
  }, []);

  const recentGuests = guests.slice(0, 8);
  const displayedGuests = showAllGuests ? guests : recentGuests;

  const getGroupColor = (group) => {
    switch(group) {
      case 'Trusted': return '#27ae60';
      case 'Previous': return '#3498db';
      case 'New': return '#f39c12';
      default: return '#666';
    }
  };

  return (
    <div className="guests">
      <div className="guests-header">
        <h1>{t('guests.title')}</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input type="text" placeholder={t('common.search')} />
          </div>
          <button className="filter-btn">
            <FiFilter /> {t('common.filter')}
          </button>
        </div>
      </div>

      <div className="guests-content">
        <div className="guests-table-container">
          <h2>{showAllGuests ? t('guests.allGuests') : t('guests.mostRecent')}</h2>
          <table className="guests-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('guests.name')}</th>
                <th>{t('guests.reservations')}</th>
                <th>{t('guests.nightsStayed')}</th>
                <th>{t('guests.lastVisit')}</th>
                <th>{t('guests.group')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedGuests.map((guest) => (
                <tr key={guest.id} onClick={() => setSelectedGuest(guest)}>
                  <td>
                    <img src={`https://i.pravatar.cc/40?img=${guest.id + 50}`} alt={guest.firstName} />
                  </td>
                  <td>{guest.firstName} {guest.lastName}</td>
                  <td>{guest.reservations}</td>
                  <td>{guest.nightsStayed}</td>
                  <td>{new Date(guest.lastVisit).toLocaleDateString()}</td>
                  <td>
                    <span 
                      className="group-badge" 
                      style={{ backgroundColor: getGroupColor(guest.group) }}
                    >
                      {guest.group}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {!showAllGuests && (
            <div className="show-all-section">
              <h2>{t('guests.allGuests')}</h2>
              <table className="guests-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('guests.name')}</th>
                    <th>{t('guests.reservations')}</th>
                    <th>{t('guests.nightsStayed')}</th>
                    <th>{t('guests.lastVisit')}</th>
                    <th>{t('guests.group')}</th>
                  </tr>
                </thead>
              </table>
              <button 
                className="show-all-btn"
                onClick={() => setShowAllGuests(true)}
              >
                {t('guests.showAllGuests')}
              </button>
            </div>
          )}
        </div>

        {selectedGuest && (
          <div className="guest-modal">
            <div className="modal-content">
              <div className="modal-header">
                <button className="close-modal" onClick={() => setSelectedGuest(null)}>
                  <FiX />
                </button>
                <div className="modal-actions">
                  <button className="btn-outline">
                    <FiEdit2 /> {t('guests.newReservation')}
                  </button>
                  <button className="btn-outline">
                    <FiDollarSign /> {t('guests.payment')}
                  </button>
                </div>
              </div>

              <div className="guest-profile">
                <img 
                  src={`https://i.pravatar.cc/120?img=${selectedGuest.id + 50}`} 
                  alt={selectedGuest.firstName} 
                />
                <h2>{selectedGuest.firstName} {selectedGuest.lastName}</h2>
                <span 
                  className="group-badge large" 
                  style={{ backgroundColor: getGroupColor(selectedGuest.group) }}
                >
                  {selectedGuest.group}
                </span>
              </div>

              <div className="guest-tabs">
                <button className="tab active">{t('guests.guestDetails')}</button>
                <button className="tab">{t('guests.stayDetails')}</button>
                <button className="tab">{t('guests.history')}</button>
                <button className="tab">{t('guests.notes')}</button>
                <button className="tab">{t('guests.documents')}</button>
              </div>

              <div className="guest-info">
                <section>
                  <h3>{t('guests.contactInformation')}</h3>
                  <div className="info-row">
                    <label>{t('guests.firstName')}</label>
                    <span>{selectedGuest.firstName}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('guests.lastName')}</label>
                    <span>{selectedGuest.lastName}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('guests.email')}</label>
                    <span>{selectedGuest.email}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('guests.phone')}</label>
                    <span>{selectedGuest.phone}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('guests.sex')}</label>
                    <span>{selectedGuest.sex}</span>
                  </div>
                </section>

                <section>
                  <h3>{t('guests.address')}</h3>
                  <div className="info-row">
                    <label>{t('guests.country')}</label>
                    <span>{selectedGuest.country}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('guests.city')}</label>
                    <span>{selectedGuest.city}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('guests.address')}</label>
                    <span>{selectedGuest.address}</span>
                  </div>
                </section>

                {selectedGuest.spouse && (
                  <section>
                    <h3>{t('guests.familyMembers')}</h3>
                    <div className="info-row">
                      <label>{t('guests.spouse')}</label>
                      <div className="family-member">
                        <img src="https://i.pravatar.cc/24?img=70" alt={t('guests.spouse')} />
                        <span>{selectedGuest.spouse}</span>
                      </div>
                    </div>
                    {selectedGuest.children?.map((child, i) => (
                      <div key={i} className="info-row">
                        <label>{t('guests.child')} {i + 1}</label>
                        <div className="family-member">
                          <img src={`https://i.pravatar.cc/24?img=${71+i}`} alt={child} />
                          <span>{child}</span>
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Guests;