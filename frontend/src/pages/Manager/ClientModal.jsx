// frontend/src/pages/Manager/ClientModal.jsx
import { useState } from 'react';
import { FiX, FiUser, FiPhone } from 'react-icons/fi';

const ClientModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'walk-in'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiUser /> Добавить клиента</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form className="client-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>ФИО *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div className="form-field">
            <label>Телефон *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              required
            />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="form-field">
            <label>Источник</label>
            <select 
              value={formData.source}
              onChange={(e) => setFormData({...formData, source: e.target.value})}
            >
              <option value="walk-in">Прямое обращение</option>
              <option value="phone">Звонок</option>
              <option value="instagram">Instagram</option>
              <option value="booking">Booking.com</option>
              <option value="referral">Рекомендация</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>Отмена</button>
            <button type="submit">Добавить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;