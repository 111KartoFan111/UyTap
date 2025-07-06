import { useState } from 'react';
import { FiPlus, FiCalendar, FiUsers } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import RentalModal from './RentalModal';
import './Pages.css';

const Rentals = () => {
  const { rentals } = useData();
  const [showRentalModal, setShowRentalModal] = useState(false);

  return (
    <div className="rentals-page">
      <div className="page-header">
        <h1>Управление арендой</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowRentalModal(true)}
        >
          <FiPlus /> Новая аренда
        </button>
      </div>
      
      <div className="rentals-grid">
        <div className="rental-types">
          <div className="rental-type-card">
            <h3>Почасовая аренда</h3>
            <p>Активных: 5</p>
            <div className="price-range">₸ 2,500 - 4,000 / час</div>
          </div>
          <div className="rental-type-card">
            <h3>Посуточная аренда</h3>
            <p>Активных: 12</p>
            <div className="price-range">₸ 15,000 - 25,000 / сутки</div>
          </div>
          <div className="rental-type-card">
            <h3>Помесячная аренда</h3>
            <p>Активных: 3</p>
            <div className="price-range">₸ 180,000 - 350,000 / месяц</div>
          </div>
        </div>
      </div>

      {showRentalModal && (
        <RentalModal
          onClose={() => setShowRentalModal(false)}
          onSubmit={(data) => {
            console.log('New rental:', data);
            setShowRentalModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Rentals;