// frontend/src/components/Auth/Login.jsx
import { useState, useEffect } from 'react';
import { FiEye, FiEyeOff, FiUser, FiLock } from 'react-icons/fi';
import { FaBuilding } from "react-icons/fa6";
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import './LoginModal.css';

const Login = () => {
  const { login, loading } = useAuth();
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    organizationSlug: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Get organization slug from URL or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orgFromUrl = urlParams.get('org');
    const savedOrg = localStorage.getItem('last_organization');
    
    if (orgFromUrl) {
      setFormData(prev => ({ ...prev, organizationSlug: orgFromUrl }));
      localStorage.setItem('last_organization', orgFromUrl);
    } else if (savedOrg) {
      setFormData(prev => ({ ...prev, organizationSlug: savedOrg }));
    }

    // Auto-fill saved credentials if remember me was checked
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!formData.email.trim()) {
      setError('Введите email');
      return;
    }
    if (!formData.password.trim()) {
      setError('Введите пароль');
      return;
    }
    if (!formData.organizationSlug.trim()) {
      setError('Введите код организации');
      return;
    }

    try {
      const result = await login(
        formData.email.trim(),
        formData.password,
        formData.organizationSlug.trim()
      );

      if (result.success) {
        // Save organization slug and email if remember me is checked
        localStorage.setItem('last_organization', formData.organizationSlug);
        
        if (rememberMe) {
          localStorage.setItem('saved_email', formData.email);
        } else {
          localStorage.removeItem('saved_email');
        }
      } else {
        setError(result.error || 'Ошибка входа');
      }
    } catch (error) {
      setError('Произошла ошибка при входе в систему');
      console.error('Login error:', error);
    }
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      'system_owner': 'Владелец системы',
      'admin': 'Администратор',
      'manager': 'Менеджер',
      'accountant': 'Бухгалтер',
      'cleaner': 'Уборщик',
      'technical_staff': 'Технический персонал',
      'storekeeper': 'Кладовщик'
    };
    return roleNames[role] || role;
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <FaBuilding size={40} />
          </div>
          <h1>PropertyMS</h1>
          <p>Система управления недвижимостью</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="organizationSlug">
              <FaBuilding />
              Организация
            </label>
            <input
              type="text"
              id="organizationSlug"
              name="organizationSlug"
              value={formData.organizationSlug}
              onChange={handleChange}
              placeholder="Код организации"
              disabled={loading}
              autoComplete="organization"
            />
            <small>Введите код вашей организации (например: hotel-paradise)</small>
          </div>

          <div className="form-field">
            <label htmlFor="email">
              <FiUser />
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">
              <FiLock />
              Пароль
            </label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Введите пароль"
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>Запомнить меня</span>
            </label>
          </div>

          <button
            type="submit"
            className={`login-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="login-footer">
          <div className="help-links">
            <button type="button" className="link-btn">
              Забыли пароль?
            </button>
            <span>•</span>
            <button type="button" className="link-btn">
              Нужна помощь?
            </button>
          </div>
          
          <div className="demo-credentials">
            <h4>Демо доступы:</h4>
            <div className="demo-roles">
              <div className="demo-role">
                <strong>Администратор:</strong>
                <span>admin@demo.com / password123</span>
              </div>
              <div className="demo-role">
                <strong>Менеджер:</strong>
                <span>manager@demo.com / password123</span>
              </div>
              <div className="demo-role">
                <strong>Уборщик:</strong>
                <span>cleaner@demo.com / password123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;