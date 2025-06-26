import { useState } from 'react';
import { FiX, FiEye, FiEyeOff, FiUser, FiLock, FiHome } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import './LoginModal.css';

const LoginModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    organizationSlug: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password, formData.organizationSlug);
    
    if (result.success) {
      onClose();
      setFormData({ email: '', password: '', organizationSlug: '' });
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!isOpen) return null;

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-content" onClick={e => e.stopPropagation()}>
        <div className="login-modal-header">
          <h2>{t('auth.login')}</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-field">
            <label>{t('auth.organization')}</label>
            <div className="input-with-icon">
              <input
                type="text"
                name="organizationSlug"
                value={formData.organizationSlug}
                onChange={handleChange}
                placeholder="hotel-paradise"
                required
              />
            </div>
            <div className="field-hint">
              {t('auth.organizationHint')}
            </div>
          </div>

          <div className="form-field">
            <label>{t('auth.email')}</label>
            <div className="input-with-icon">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label>{t('auth.password')}</label>
            <div className="input-with-icon">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`login-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>

          <div className="login-help">
            <p>{t('auth.noAccount')}</p>
            <p>{t('auth.contactAdmin')}</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;