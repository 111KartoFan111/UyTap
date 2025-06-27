import { useState } from 'react';
import { FiX, FiUser, FiMail, FiPhone, FiShield, FiLock } from 'react-icons/fi';
import './CreateUserModal.css';

const CreateUserModal = ({ organizationId, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '',
    role: 'admin',
    status: 'active'
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const roles = [
    { value: 'admin', label: 'Администратор' },
    { value: 'manager', label: 'Менеджер' },
    { value: 'technical_staff', label: 'Технический персонал' },
    { value: 'accountant', label: 'Бухгалтер' },
    { value: 'cleaner', label: 'Уборщик' },
    { value: 'storekeeper', label: 'Кладовщик' }
  ];

  const statuses = [
    { value: 'active', label: 'Активный' },
    { value: 'inactive', label: 'Неактивный' },
    { value: 'suspended', label: 'Заблокирован' },
    { value: 'pending_verification', label: 'Ожидает подтверждения' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль должен содержать минимум 8 символов';
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Имя обязательно';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Фамилия обязательна';
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
      await onSubmit({
        ...formData,
        organization_id: organizationId
      });
    } catch (error) {
      console.error('Error creating user:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiUser /> Добавить сотрудника
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>
              <FiUser /> Личные данные
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Имя *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="Анна"
                  className={errors.first_name ? 'error' : ''}
                />
                {errors.first_name && <span className="error-text">{errors.first_name}</span>}
              </div>

              <div className="form-field">
                <label>Фамилия *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Цибуйская"
                  className={errors.last_name ? 'error' : ''}
                />
                {errors.last_name && <span className="error-text">{errors.last_name}</span>}
              </div>

              <div className="form-field full-width">
                <label>Отчество</label>
                <input
                  type="text"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleChange}
                  placeholder="Сергеевна"
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
                  placeholder="anna@hotel-paradise.com"
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
            </div>
          </div>

          <div className="form-section">
            <h3>
              <FiLock /> Безопасность
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Пароль *</label>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Введите пароль"
                    className={errors.password ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && <span className="error-text">{errors.password}</span>}
                <small className="field-hint">
                  Минимум 8 символов, включая буквы, цифры и спецсимволы
                </small>
              </div>

              <div className="form-field">
                <label>Генерация пароля</label>
                <button
                  type="button"
                  className="generate-password-btn"
                  onClick={generatePassword}
                >
                  Сгенерировать пароль
                </button>
                <small className="field-hint">
                  Автоматически создает безопасный пароль
                </small>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>
              <FiShield /> Роль и статус
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Роль *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                >
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Статус</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  {statuses.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Создание...' : 'Создать пользователя'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;