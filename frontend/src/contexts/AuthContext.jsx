import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

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
  const [systemInitialized, setSystemInitialized] = useState(null);

  // Check system status on mount
  useEffect(() => {
    checkSystemStatus();
  }, []);

  // Load user data on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        startSessionTimer();
        
        // Verify token is still valid
        authAPI.getCurrentUser()
          .then(currentUser => {
            setUser(currentUser);
            localStorage.setItem('user_data', JSON.stringify(currentUser));
          })
          .catch(() => {
            // Token invalid, logout
            logout();
          });
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    }
    setLoading(false);
  }, []);

  // Session timer
  useEffect(() => {
    let interval;
    if (user) {
      interval = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 60000); // Update every minute
    }
    return () => clearInterval(interval);
  }, [user]);

  const checkSystemStatus = async () => {
    try {
      const status = await authAPI.checkSystemStatus();
      setSystemInitialized(status.initialized);
    } catch (error) {
      console.error('Failed to check system status:', error);
      setSystemInitialized(false);
    }
  };

  const initializeSystem = async (initData) => {
    try {
      setLoading(true);
      await authAPI.initializeSystem(initData);
      setSystemInitialized(true);
      return { success: true };
    } catch (error) {
      console.error('System initialization failed:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const startSessionTimer = () => {
    const loginTime = localStorage.getItem('login_time');
    if (loginTime) {
      const elapsed = Math.floor((Date.now() - parseInt(loginTime)) / 60000);
      setSessionTimer(elapsed);
    }
  };

  const login = async (email, password, organizationSlug) => {
    try {
      setLoading(true);
      
      const data = await authAPI.login(email, password, organizationSlug);
      
      // Save tokens and user data
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
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        // Notify server about logout
        await authAPI.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local data regardless of server response
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('login_time');
      
      setUser(null);
      setSessionTimer(0);
    }
  };

  const refreshUserData = async () => {
    try {
      const currentUser = await authAPI.getCurrentUser();
      setUser(currentUser);
      localStorage.setItem('user_data', JSON.stringify(currentUser));
      return currentUser;
    } catch (error) {
      console.error('Failed to refresh user data:', error);
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
    systemInitialized,
    login,
    logout,
    refreshUserData,
    initializeSystem,
    checkSystemStatus,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};