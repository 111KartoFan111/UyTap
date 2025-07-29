import { useState, useEffect } from 'react';
import { FiX, FiUser, FiPhone, FiMail, FiMapPin } from 'react-icons/fi';

const ClientModal = ({ client, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address: '',
    source: 'walk-in',
    notes: '',
    date_of_birth: '',
    document_number: '',
    document_type: 'passport'
  });

  const [errors, setErrors] = useState({});

  // Заполнение формы при редактировании
  useEffect(() => {
    if (client) {
      setFormData({
        first_name: client.first_name || '',
        last_name: client.last_name || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        source: client.source || 'walk-in',
        notes: client.notes || '',
        date_of_birth: client.date_of_birth || '',
        document_number: client.document_number || '',
        document_type: client.document_type || 'passport'
      });
    }
  }, [client]);

  const sources = [
    { value: 'walk-in', label: 'Прямое обращение' },
    { value: 'phone', label: 'Звонок' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'referral', label: 'Рекомендация' },
    { value: 'website', label: 'Веб-сайт' },
    { value: 'other', label: 'Другое' }
  ];

  const documentTypes = [
    { value: 'passport', label: 'Паспорт' },
    { value: 'id_card', label: 'Удостоверение личности' },
    { value: 'driving_license', label: 'Водительские права' },
    { value: 'other', label: 'Другой документ' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Имя обязательно';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Фамилия обязательна';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Телефон обязателен';
    } else if (!/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Неверный формат телефона';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email';
    }
    if (formData.date_of_birth) {
      const birthDate = new Date(formData.date_of_birth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18 || age > 120) {
        newErrors.date_of_birth = 'Возраст должен быть от 18 до 120 лет';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      // Очистка пустых полей
      const cleanData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== '')
      );
      onSubmit(cleanData);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Очистка ошибки при изменении поля
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content client-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiUser /> {client ? 'Редактировать клиента' : 'Добавить клиента'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <form className="client-form" onSubmit={handleSubmit}>
          {/* Основная информация */}
          <div className="form-section">
            <h3>Основная информация</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Имя *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Имя"
                  className={errors.first_name ? 'error' : ''}
                />
                {errors.first_name && <span className="error-text">{errors.first_name}</span>}
              </div>

              <div className="form-field">
                <label>Фамилия *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Фамилия"
                  className={errors.last_name ? 'error' : ''}
                />
                {errors.last_name && <span className="error-text">{errors.last_name}</span>}
              </div>

              <div className="form-field">
                <label>Дата рождения</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                  className={errors.date_of_birth ? 'error' : ''}
                />
                {errors.date_of_birth && <span className="error-text">{errors.date_of_birth}</span>}
              </div>
            </div>
          </div>

          {/* Контактная информация */}
          <div className="form-section">
            <h3>Контактная информация</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>
                  <FiPhone size={16} /> Телефон *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+7 (777) 123-45-67"
                  className={errors.phone ? 'error' : ''}
                />
                {errors.phone && <span className="error-text">{errors.phone}</span>}
              </div>

              <div className="form-field">
                <label>
                  <FiMail size={16} /> Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="client@example.com"
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-field full-width">
                <label>
                  <FiMapPin size={16} /> Адрес
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Адрес проживания"
                />
              </div>
            </div>
          </div>

          {/* Документы */}
          <div className="form-section">
            <h3>Документы</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Тип документа</label>
                <select
                  value={formData.document_type}
                  onChange={(e) => handleInputChange('document_type', e.target.value)}
                >
                  {documentTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Номер документа</label>
                <input
                  type="text"
                  value={formData.document_number}
                  onChange={(e) => handleInputChange('document_number', e.target.value)}
                  placeholder="Номер документа"
                />
              </div>
            </div>
          </div>

          {/* Источник и примечания */}
          <div className="form-section">
            <h3>Дополнительно</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Источник</label>
                <select
                  value={formData.source}
                  onChange={(e) => handleInputChange('source', e.target.value)}
                >
                  {sources.map(source => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field full-width">
                <label>Примечания</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Дополнительная информация о клиенте..."
                  rows="3"
                />
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              {client ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;