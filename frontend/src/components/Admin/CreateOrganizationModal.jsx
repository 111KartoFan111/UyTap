import { useState } from 'react';
import { FiX, FiHome, FiMail, FiPhone, FiGlobe, FiMapPin } from 'react-icons/fi';
import './CreateOrganizationModal.css';

const CreateOrganizationModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    email: '',
    phone: '',
    website: '',
    country: '',
    city: '',
    address: '',
    postal_code: '',
    subscription_plan: 'basic',
    max_users: 10,
    max_properties: 50,
    status: 'trial'
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-generate slug from name
    if (name === 'name') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      setFormData(prev => ({
        ...prev,
        slug: slug
      }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Название организации обязательно';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug организации обязателен';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug может содержать только буквы, цифры и дефисы';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }

    if (formData.max_users < 1) {
      newErrors.max_users = 'Минимум 1 пользователь';
    }

    if (formData.max_properties < 1) {
      newErrors.max_properties = 'Минимум 1 объект';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error creating organization:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiHome /> Создать организацию
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form className="org-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>
              <FiHome /> Основная информация
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Название организации *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Hotel Paradise"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="form-field">
                <label>Slug *</label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  placeholder="hotel-paradise"
                  className={errors.slug ? 'error' : ''}
                />
                {errors.slug && <span className="error-text">{errors.slug}</span>}
                <small className="field-hint">
                  Используется в URL для входа в систему
                </small>
              </div>

              <div className="form-field full-width">
                <label>Описание</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Описание организации..."
                  rows="3"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>
              <FiMail /> Контактная информация
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@hotel-paradise.com"
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-field">
                <label>Телефон</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+7 (777) 123-45-67"
                />
              </div>

              <div className="form-field full-width">
                <label>Веб-сайт</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://hotel-paradise.com"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>
              <FiMapPin /> Адрес
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Страна</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Казахстан"
                />
              </div>

              <div className="form-field">
                <label>Город</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Алматы"
                />
              </div>

              <div className="form-field">
                <label>Адрес</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="ул. Абая, 123"
                />
              </div>

              <div className="form-field">
                <label>Почтовый индекс</label>
                <input
                  type="text"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder="050000"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>
              <FiGlobe /> Настройки подписки
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>План подписки</label>
                <select
                  name="subscription_plan"
                  value={formData.subscription_plan}
                  onChange={handleChange}
                >
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="form-field">
                <label>Статус</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="trial">Пробный период</option>
                  <option value="active">Активный</option>
                  <option value="suspended">Приостановлен</option>
                </select>
              </div>

              <div className="form-field">
                <label>Макс. пользователей</label>
                <input
                  type="number"
                  name="max_users"
                  value={formData.max_users}
                  onChange={handleChange}
                  min="1"
                  max="1000"
                  className={errors.max_users ? 'error' : ''}
                />
                {errors.max_users && <span className="error-text">{errors.max_users}</span>}
              </div>

              <div className="form-field">
                <label>Макс. объектов</label>
                <input
                  type="number"
                  name="max_properties"
                  value={formData.max_properties}
                  onChange={handleChange}
                  min="1"
                  max="10000"
                  className={errors.max_properties ? 'error' : ''}
                />
                {errors.max_properties && <span className="error-text">{errors.max_properties}</span>}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Создание...' : 'Создать организацию'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrganizationModal;