import { useState } from 'react';
import { FiX, FiUser, FiMail, FiLock, FiHome, FiGlobe, FiPhone, FiMapPin } from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import './SystemInitModal.css';

const SystemInitModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1 - organization, 2 - admin user
  
  const [organizationData, setOrganizationData] = useState({
    name: '',
    slug: '',
    description: '',
    email: '',
    phone: '',
    website: '',
    country: 'Kazakhstan',
    city: '',
    address: '',
    postal_code: '',
    subscription_plan: 'premium',
    max_users: 50,
    max_properties: 100
  });

  const [adminData, setAdminData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '',
    role: 'admin'
  });

  const handleOrganizationChange = (e) => {
    const { name, value } = e.target;
    setOrganizationData(prev => ({
      ...prev,
      [name]: value,
      // Автоматически создаем slug из названия
      ...(name === 'name' && { slug: value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') })
    }));
  };

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setAdminData(prev => ({ ...prev, [name]: value }));
  };

  const handleNextStep = () => {
    if (step === 1) {
      // Валидация данных организации
      if (!organizationData.name || !organizationData.slug || !organizationData.email) {
        setError('Заполните обязательные поля организации');
        return;
      }
      setStep(2);
      setError('');
    }
  };

  const handlePrevStep = () => {
    if (step === 2) {
      setStep(1);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Валидация
    if (adminData.password !== adminData.confirmPassword) {
      setError('Пароли не совпадают');
      setLoading(false);
      return;
    }

    if (adminData.password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      setLoading(false);
      return;
    }

    try {
      const requestData = {
        organization: organizationData,
        admin_user: {
          ...adminData,
          // Убираем confirmPassword из отправляемых данных
          confirmPassword: undefined
        }
      };
      
      console.log('Sending data:', requestData); // Добавить для отладки
      
      const response = await fetch('http://localhost:8000/api/auth/system/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка инициализации системы');
      }

      const data = await response.json();
      console.log('System initialized:', data);
      
      onSuccess?.(data);
      onClose();
      
      // Показываем уведомление об успехе
      alert(`Система успешно инициализирована!\n\nСистемный администратор:\nEmail: ${data.system_admin.email}\nПароль: SystemAdmin123!\n\nАдминистратор организации:\nEmail: ${data.org_admin.email}\nИмя: ${data.org_admin.name}`);
      
    } catch (error) {
      console.error('System init error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="system-init-modal-overlay" onClick={onClose}>
      <div className="system-init-modal-content" onClick={e => e.stopPropagation()}>
        <div className="system-init-header">
          <h2>Инициализация системы</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="init-steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>
            <span>1</span>
            <span>Организация</span>
          </div>
          <div className="step-line"></div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <span>2</span>
            <span>Администратор</span>
          </div>
        </div>

        <form className="system-init-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">{error}</div>
          )}

          {step === 1 && (
            <div className="form-step">
              <h3>
                <FiHome /> Данные организации
              </h3>
              
              <div className="form-row">
                <div className="form-field">
                  <label>Название организации *</label>
                  <input
                    type="text"
                    name="name"
                    value={organizationData.name}
                    onChange={handleOrganizationChange}
                    placeholder="Hotel Paradise"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Slug (URL) *</label>
                  <input
                    type="text"
                    name="slug"
                    value={organizationData.slug}
                    onChange={handleOrganizationChange}
                    placeholder="hotel-paradise"
                    pattern="[a-z0-9\\-]+"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Описание</label>
                <textarea
                  name="description"
                  value={organizationData.description}
                  onChange={handleOrganizationChange}
                  placeholder="Роскошный отель в центре города"
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={organizationData.email}
                    onChange={handleOrganizationChange}
                    placeholder="admin@hotel-paradise.com"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Телефон</label>
                  <input
                    type="tel"
                    name="phone"
                    value={organizationData.phone}
                    onChange={handleOrganizationChange}
                    placeholder="+7 (777) 123-45-67"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Страна</label>
                  <select
                    name="country"
                    value={organizationData.country}
                    onChange={handleOrganizationChange}
                  >
                    <option value="Kazakhstan">Kazakhstan</option>
                    <option value="Russia">Russia</option>
                    <option value="USA">USA</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Город</label>
                  <input
                    type="text"
                    name="city"
                    value={organizationData.city}
                    onChange={handleOrganizationChange}
                    placeholder="Алматы"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-next" onClick={handleNextStep}>
                  Далее
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-step">
              <h3>
                <FiUser /> Администратор организации
              </h3>
              
              <div className="form-row">
                <div className="form-field">
                  <label>Имя *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={adminData.first_name}
                    onChange={handleAdminChange}
                    placeholder="Анна"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Фамилия *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={adminData.last_name}
                    onChange={handleAdminChange}
                    placeholder="Цибуйская"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Отчество</label>
                <input
                  type="text"
                  name="middle_name"
                  value={adminData.middle_name}
                  onChange={handleAdminChange}
                  placeholder="Александровна"
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={adminData.email}
                    onChange={handleAdminChange}
                    placeholder="admin@hotel-paradise.com"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Телефон</label>
                  <input
                    type="tel"
                    name="phone"
                    value={adminData.phone}
                    onChange={handleAdminChange}
                    placeholder="+7 (777) 123-45-67"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Пароль *</label>
                  <input
                    type="password"
                    name="password"
                    value={adminData.password}
                    onChange={handleAdminChange}
                    placeholder="Пример: Admin123!"
                    required
                    minLength="8"
                    autoComplete="new-password"
                  />
                  <small className="password-hint">
                    Пароль должен содержать: заглавную букву, строчную букву, цифру и спецсимвол (!@#$%^&*)
                  </small>
                </div>
                <div className="form-field">
                  <label>Подтверждение пароля *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={adminData.confirmPassword}
                    onChange={handleAdminChange}
                    placeholder="Повторите пароль"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-back" onClick={handlePrevStep}>
                  Назад
                </button>
                <button
                  type="submit"
                  className={`btn-submit ${loading ? 'loading' : ''}`}
                  disabled={loading}
                >
                  {loading ? 'Инициализация...' : 'Создать систему'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default SystemInitModal;