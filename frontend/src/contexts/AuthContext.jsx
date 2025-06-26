import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimer, setSessionTimer] = useState(0);

  // Загрузка данных пользователя при запуске
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        startSessionTimer();
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    }
    setLoading(false);
  }, []);

  // Таймер сессии
  useEffect(() => {
    let interval;
    if (user) {
      interval = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 60000); // Обновляем каждую минуту
    }
    return () => clearInterval(interval);
  }, [user]);

  const startSessionTimer = () => {
    const loginTime = localStorage.getItem('login_time');
    if (loginTime) {
      const elapsed = Math.floor((Date.now() - parseInt(loginTime)) / 60000);
      setSessionTimer(elapsed);
    }
  };

  const login = async (email, password, organizationSlug) => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          organization_slug: organizationSlug,
          device_info: {
            platform: navigator.platform,
            mobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      
      // Сохраняем токены и данные пользователя
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      localStorage.setItem('login_time', Date.now().toString());
      
      setUser(data.user);
      setSessionTimer(0);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        // Уведомляем сервер о выходе
        await fetch('http://localhost:8000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({
            refresh_token: refreshToken
          }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем локальные данные
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('login_time');
      
      setUser(null);
      setSessionTimer(0);
    }
  };

  const refreshToken = async () => {
    try {
      const refresh_token = localStorage.getItem('refresh_token');
      if (!refresh_token) {
        throw new Error('No refresh token');
      }

      const response = await fetch('http://localhost:8000/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      return data.access_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      logout();
      return null;
    }
  };

  const formatSessionTime = () => {
    const hours = Math.floor(sessionTimer / 60);
    const minutes = sessionTimer % 60;
    
    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes} мин`;
  };

  const value = {
    user,
    loading,
    sessionTimer: formatSessionTime(),
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};