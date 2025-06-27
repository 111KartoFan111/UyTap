import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AdminLogin.css';

const AdminLogin = () => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password, null); // null для system_owner
    
    if (!result.success) {
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

  return (
    <div className="admin-login-screen">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <div className="admin-logo">⚙️</div>
          <h2>Админская панель</h2>
          <p>Доступ только для владельцев системы</p>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="admin-error-message">
              {error}
            </div>
          )}

          <div className="admin-form-field">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@system.local"
              required
            />
          </div>

          <div className="admin-form-field">
            <label>Пароль</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Введите пароль"
              required
            />
          </div>

          <button
            type="submit"
            className={`admin-login-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти в админку'}
          </button>
        </form>

        <div className="admin-login-footer">
          <p>Для доступа к админке нужны права system_owner</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;