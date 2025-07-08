import { useState, useEffect } from 'react';
import { FiX, FiHome, FiDollarSign, FiInfo } from 'react-icons/fi';
import './PropertyModal.css';

const PropertyModal = ({ property, onClose, onSubmit, organizationLimits }) => {
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    floor: 1,
    building: '',
    address: '',
    property_type: 'room',
    area: '',
    rooms_count: 1,
    max_occupancy: 1,
    description: '',
    amenities: [],
    hourly_rate: '',
    daily_rate: '',
    weekly_rate: '',
    monthly_rate: '',
    yearly_rate: ''
  });

  const [errors, setErrors] = useState({});
  const [availableAmenities] = useState([
    'WiFi', 'Кондиционер', 'Телевизор', 'Холодильник', 
    'Микроволновка', 'Стиральная машина', 'Балкон', 
    'Парковка', 'Лифт', 'Джакузи'
  ]);

  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name || '',
        number: property.number || '',
        floor: property.floor || 1,
        building: property.building || '',
        address: property.address || '',
        property_type: property.property_type || 'room',
        area: property.area || '',
        rooms_count: property.rooms_count || 1,
        max_occupancy: property.max_occupancy || 1,
        description: property.description || '',
        amenities: property.amenities || [],
        hourly_rate: property.hourly_rate || '',
        daily_rate: property.daily_rate || '',
        weekly_rate: property.weekly_rate || '',
        monthly_rate: property.monthly_rate || '',
        yearly_rate: property.yearly_rate || ''
      });
    }
  }, [property]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название обязательно';
    }
    if (!formData.number.trim()) {
      newErrors.number = 'Номер помещения обязателен';
    }
    if (!formData.property_type) {
      newErrors.property_type = 'Выберите тип помещения';
    }
    if (formData.floor && formData.floor < 1) {
      newErrors.floor = 'Этаж должен быть больше 0';
    }
    if (formData.area && parseFloat(formData.area) <= 0) {
      newErrors.area = 'Площадь должна быть больше 0';
    }
    if (formData.rooms_count < 1) {
      newErrors.rooms_count = 'Количество комнат должно быть больше 0';
    }
    if (formData.max_occupancy < 1) {
      newErrors.max_occupancy = 'Максимальная вместимость должна быть больше 0';
    }

    // Валидация тарифов
    const rates = ['hourly_rate', 'daily_rate', 'weekly_rate', 'monthly_rate', 'yearly_rate'];
    rates.forEach(rate => {
      if (formData[rate] && (isNaN(formData[rate]) || parseFloat(formData[rate]) < 0)) {
        newErrors[rate] = 'Тариф должен быть положительным числом';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      // Преобразуем числовые поля
      const submitData = {
        ...formData,
        floor: formData.floor ? parseInt(formData.floor) : null,
        area: formData.area ? parseFloat(formData.area) : null,
        rooms_count: parseInt(formData.rooms_count),
        max_occupancy: parseInt(formData.max_occupancy),
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        daily_rate: formData.daily_rate ? parseFloat(formData.daily_rate) : null,
        weekly_rate: formData.weekly_rate ? parseFloat(formData.weekly_rate) : null,
        monthly_rate: formData.monthly_rate ? parseFloat(formData.monthly_rate) : null,
        yearly_rate: formData.yearly_rate ? parseFloat(formData.yearly_rate) : null
      };
      
      onSubmit(submitData);
    }
  };

  const handleAmenityToggle = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const propertyTypes = [
    { value: 'apartment', label: 'Квартира' },
    { value: 'room', label: 'Комната' },
    { value: 'studio', label: 'Студия' },
    { value: 'villa', label: 'Вилла' },
    { value: 'office', label: 'Офис' }
  ];

  return (
    <div className="property-modal-overlay" onClick={onClose}>
      <div className="property-modal-content" onClick={e => e.stopPropagation()}>
        <div className="property-modal-header">
          <h2>
            <FiHome /> {property ? 'Редактировать помещение' : 'Создать помещение'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        {organizationLimits && (
          <div className="limits-info">
            <FiInfo />
            <span>
              Создано помещений: {organizationLimits.current} из {organizationLimits.max}
            </span>
          </div>
        )}

        <form className="property-form" onSubmit={handleSubmit}>
          {/* Основная информация */}
          <div className="form-section">
            <h3>Основная информация</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Название *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Название помещения"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="form-field">
                <label>Номер *</label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="1-01"
                  className={errors.number ? 'error' : ''}
                />
                {errors.number && <span className="error-text">{errors.number}</span>}
              </div>

              <div className="form-field">
                <label>Тип помещения *</label>
                <select
                  value={formData.property_type}
                  onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                  className={errors.property_type ? 'error' : ''}
                >
                  {propertyTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.property_type && <span className="error-text">{errors.property_type}</span>}
              </div>

              <div className="form-field">
                <label>Этаж</label>
                <input
                  type="number"
                  min="1"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  className={errors.floor ? 'error' : ''}
                />
                {errors.floor && <span className="error-text">{errors.floor}</span>}
              </div>

              <div className="form-field">
                <label>Здание</label>
                <input
                  type="text"
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  placeholder="Корпус А"
                />
              </div>

              <div className="form-field">
                <label>Адрес</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Адрес помещения"
                />
              </div>
            </div>
          </div>

          {/* Характеристики */}
          <div className="form-section">
            <h3>Характеристики</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Площадь (м²)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className={errors.area ? 'error' : ''}
                />
                {errors.area && <span className="error-text">{errors.area}</span>}
              </div>

              <div className="form-field">
                <label>Количество комнат *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.rooms_count}
                  onChange={(e) => setFormData({ ...formData, rooms_count: e.target.value })}
                  className={errors.rooms_count ? 'error' : ''}
                />
                {errors.rooms_count && <span className="error-text">{errors.rooms_count}</span>}
              </div>

              <div className="form-field">
                <label>Максимальная вместимость *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_occupancy}
                  onChange={(e) => setFormData({ ...formData, max_occupancy: e.target.value })}
                  className={errors.max_occupancy ? 'error' : ''}
                />
                {errors.max_occupancy && <span className="error-text">{errors.max_occupancy}</span>}
              </div>
            </div>

            <div className="form-field">
              <label>Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Описание помещения..."
                rows="3"
              />
            </div>
          </div>

          {/* Удобства */}
          <div className="form-section">
            <h3>Удобства</h3>
            <div className="amenities-grid">
              {availableAmenities.map(amenity => (
                <label key={amenity} className="amenity-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.amenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
                  />
                  <span>{amenity}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Тарифы */}
          <div className="form-section">
            <h3>
              <FiDollarSign /> Тарифы
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Почасовая ставка (₸/час)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  className={errors.hourly_rate ? 'error' : ''}
                />
                {errors.hourly_rate && <span className="error-text">{errors.hourly_rate}</span>}
              </div>

              <div className="form-field">
                <label>Посуточная ставка (₸/день)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.daily_rate}
                  onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })}
                  className={errors.daily_rate ? 'error' : ''}
                />
                {errors.daily_rate && <span className="error-text">{errors.daily_rate}</span>}
              </div>

              <div className="form-field">
                <label>Недельная ставка (₸/неделя)</label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={formData.weekly_rate}
                  onChange={(e) => setFormData({ ...formData, weekly_rate: e.target.value })}
                  className={errors.weekly_rate ? 'error' : ''}
                />
                {errors.weekly_rate && <span className="error-text">{errors.weekly_rate}</span>}
              </div>

              <div className="form-field">
                <label>Месячная ставка (₸/месяц)</label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={formData.monthly_rate}
                  onChange={(e) => setFormData({ ...formData, monthly_rate: e.target.value })}
                  className={errors.monthly_rate ? 'error' : ''}
                />
                {errors.monthly_rate && <span className="error-text">{errors.monthly_rate}</span>}
              </div>

              <div className="form-field">
                <label>Годовая ставка (₸/год)</label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={formData.yearly_rate}
                  onChange={(e) => setFormData({ ...formData, yearly_rate: e.target.value })}
                  className={errors.yearly_rate ? 'error' : ''}
                />
                {errors.yearly_rate && <span className="error-text">{errors.yearly_rate}</span>}
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button 
              type="submit" 
              className="btn-submit"
              disabled={organizationLimits && !property && organizationLimits.current >= organizationLimits.max}
            >
              {property ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PropertyModal;