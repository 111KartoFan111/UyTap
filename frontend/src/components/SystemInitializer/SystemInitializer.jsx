import { useState } from 'react';
import { FiSettings, FiUser, FiHome, FiCheck } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import './SystemInitializer.css';

const SystemInitializer = () => {
  const { initializeSystem } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [organizationData, setOrganizationData] = useState({
    name: '',
    slug: '',
    description: '',
    email: '',
    phone: '',
    website: '',
    country: 'Казахстан',
    city: '',
    address: '',
    postal_code: '',
    subscription_plan: 'basic',
    max_users: 10,
    max_properties: 50
  });

  const [adminData, setAdminData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '',
    role: 'admin'
  });

  const handleOrganizationChange = (e) => {
    const { name, value } = e.target;
    setOrganizationData(prev => ({ ...prev, [name]: value }));
    
    // Auto-generate slug from name
    if (name === 'name') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      setOrganizationData(prev => ({ ...prev, slug }));
    }
  };

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setAdminData(prev => ({ ...prev, [name]: value }));
  };

  const validateStep1 = () => {
    if (!organizationData.name.trim()) return 'Введите название организации';
    if (!organizationData.slug.trim()) return 'Slug организации обязателен';
    if (!/^[a-z0-9-]+$/.test(organizationData.slug)) return 'Slug может содержать только буквы, цифры и дефисы';
    if (!organizationData.email.trim()) return 'Email обязателен';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organizationData.email)) return 'Некорректный формат email';
    return null;
  };

  const validateStep2 = () => {
    if (!adminData.first_name.trim()) return 'Введите имя администратора';
    if (!adminData.last_name.trim()) return 'Введите фамилию администратора';
    if (!adminData.email.trim()) return 'Email администратора обязателен';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) return 'Некорректный формат email';
    if (!adminData.password.trim()) return 'Пароль обязателен';
    if (adminData.password.length < 8) return 'Пароль должен содержать минимум 8 символов';
    return null;
  };

  const handleNext = () => {
    setError('');
    
    if (step === 1) {
      const error = validateStep1();
      if (error) {
        setError(error);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const error = validateStep2();
      if (error) {
        setError(error);
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const initData = {
        organization: organizationData,
        admin_user: adminData
      };

      const result = await initializeSystem(initData);
      
      if (result.success) {
        setStep(4); // Success step
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="init-step">
      <div className="step-header">
        <FiHome size={32} />
        <h2>Настройка организации</h2>
        <p>Введите основную информацию о вашей организации</p>
      </div>

      <div className="init-form">
        <div className="form-row">
          <div className="form-field">
            <label>Название организации *</label>
            <input
              type="text"
              name="name"
              value={organizationData.name}
              onChange={handleOrganizationChange}
              placeholder="Отель Paradise"
            />
          </div>
          <div className="form-field">
            <label>Slug (для URL) *</label>
            <input
              type="text"
              name="slug"
              value={organizationData.slug}
              onChange={handleOrganizationChange}
              placeholder="hotel-paradise"
            />
            <small>Используется в адресе для входа в систему</small>
          </div>
        </div>

        <div className="form-field">
          <label>Описание</label>
          <textarea
            name="description"
            value={organizationData.description}
            onChange={handleOrganizationChange}
            placeholder="Краткое описание вашей организации..."
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
            <label>Город</label>
            <input
              type="text"
              name="city"
              value={organizationData.city}
              onChange={handleOrganizationChange}
              placeholder="Алматы"
            />
          </div>
          <div className="form-field">
            <label>Веб-сайт</label>
            <input
              type="url"
              name="website"
              value={organizationData.website}
              onChange={handleOrganizationChange}
              placeholder="https://hotel-paradise.com"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="init-step">
      <div className="step-header">
        <FiUser size={32} />
        <h2>Создание администратора</h2>
        <p>Создайте учетную запись главного администратора</p>
      </div>

      <div className="init-form">
        <div className="form-row">
          <div className="form-field">
            <label>Имя *</label>
            <input
              type="text"
              name="first_name"
              value={adminData.first_name}
              onChange={handleAdminChange}
              placeholder="Анна"
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
            placeholder="Сергеевна"
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
              placeholder="anna@hotel-paradise.com"
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

        <div className="form-field">
          <label>Пароль *</label>
          <input
            type="password"
            name="password"
            value={adminData.password}
            onChange={handleAdminChange}
            placeholder="Минимум 8 символов"
          />
          <small>Пароль должен содержать минимум 8 символов</small>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="init-step">
      <div className="step-header">
        <FiSettings size={32} />
        <h2>Подтверждение настроек</h2>
        <p>Проверьте введенные данные перед созданием системы</p>
      </div>

      <div className="confirmation-data">
        <div className="confirmation-section">
          <h3>Организация</h3>
          <div className="data-row">
            <span>Название:</span>
            <span>{organizationData.name}</span>
          </div>
          <div className="data-row">
            <span>Slug:</span>
            <span>{organizationData.slug}</span>
          </div>
          <div className="data-row">
            <span>Email:</span>
            <span>{organizationData.email}</span>
          </div>
          <div className="data-row">
            <span>Город:</span>
            <span>{organizationData.city || 'Не указан'}</span>
          </div>
        </div>

        <div className="confirmation-section">
          <h3>Администратор</h3>
          <div className="data-row">
            <span>ФИО:</span>
            <span>{adminData.first_name} {adminData.last_name} {adminData.middle_name}</span>
          </div>
          <div className="data-row">
            <span>Email:</span>
            <span>{adminData.email}</span>
          </div>
          <div className="data-row">
            <span>Телефон:</span>
            <span>{adminData.phone || 'Не указан'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="init-step success">
      <div className="step-header">
        <FiCheck size={48} className="success-icon" />
        <h2>Система успешно инициализирована!</h2>
        <p>Теперь вы можете войти в систему используя созданную учетную запись</p>
      </div>

      <div className="success-info">
        <div className="login-info">
          <h3>Данные для входа:</h3>
          <p><strong>URL:</strong> {window.location.origin}/?org={organizationData.slug}</p>
          <p><strong>Email:</strong> {adminData.email}</p>
          <p><strong>Пароль:</strong> [указанный при создании]</p>
        </div>
        
        <button 
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Перейти к входу
        </button>
      </div>
    </div>
  );

  return (
    <div className="system-initializer">
      <div className="init-container">
        <div className="init-header">
          <h1>Инициализация системы</h1>
          <div className="step-indicator">
            <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>1</div>
            <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>2</div>
            <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>3</div>
            <div className={`step ${step >= 4 ? 'active completed' : ''}`}>4</div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        {step < 4 && (
          <div className="init-actions">
            {step > 1 && (
              <button 
                className="btn-outline" 
                onClick={handleBack}
                disabled={loading}
              >
                Назад
              </button>
            )}
            
            {step < 3 && (
              <button 
                className="btn-primary" 
                onClick={handleNext}
                disabled={loading}
              >
                Далее
              </button>
            )}
            
            {step === 3 && (
              <button 
                className="btn-primary" 
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Создание системы...' : 'Создать систему'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemInitializer;