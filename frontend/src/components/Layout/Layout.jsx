import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FiHome, 
  FiMessageCircle, 
  FiUsers, 
  FiCheckSquare, 
  FiGrid,
  FiSettings,
  FiHelpCircle,
  FiGlobe,
  FiMenu,
  FiUser,
  FiLogOut,
  FiLogIn,
  FiAlertCircle,
  FiWifi,
  FiWifiOff
} from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import LoginModal from '../Auth/LoginModal';
import './Layout.css';

const Layout = ({ children }) => {
  const { t, language, setLanguage, languages } = useTranslation();
  const { user, logout, sessionTimer, isAuthenticated, systemInitialized } = useAuth();
  const { loading, error, utils } = useData();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('online');

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Navigation items based on user role
  const getNavItems = () => {
    if (!user) return [];

    const baseItems = [
      { path: '/', icon: FiHome, label: t('dashboard.title') }
    ];

    switch (user.role) {
      case 'system_owner':
      case 'admin':
      case 'manager':
        return [
          ...baseItems,
          { path: '/properties', icon: FiGrid, label: 'Помещения' },
          { path: '/clients', icon: FiUsers, label: 'Клиенты' },
          { path: '/rentals', icon: FiHome, label: 'Аренда' },
          { path: '/tasks', icon: FiCheckSquare, label: t('tasks.title') },
          { path: '/reports', icon: FiMessageCircle, label: 'Отчеты' }
        ];
      case 'accountant':
        return [
          ...baseItems,
          { path: '/clients', icon: FiUsers, label: 'Клиенты' },
          { path: '/rentals', icon: FiHome, label: 'Аренда' },
          { path: '/reports', icon: FiMessageCircle, label: 'Финансы' },
          { path: '/payroll', icon: FiCheckSquare, label: 'Зарплата' }
        ];
      case 'cleaner':
      case 'technical_staff':
      case 'storekeeper':
        return [
          ...baseItems,
          { path: '/tasks', icon: FiCheckSquare, label: 'Мои задачи' },
          { path: '/inventory', icon: FiGrid, label: 'Склад' }
        ];
      default:
        return baseItems;
    }
  };

  const navItems = getNavItems();

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    closeSidebar();
  };

  const handleLogin = () => {
    setShowLoginModal(true);
    closeSidebar();
  };

  // If system is not initialized, don't render layout
  if (systemInitialized === false) {
    return null;
  }

  // If user is not authenticated, show login screen
  if (!isAuthenticated) {
    return (
      <>
        <div className="login-screen">
          <div className="login-container">
            <div className="login-logo">
              <div className="logo-icon">💎</div>
              <h1>{t('auth.systemTitle')}</h1>
              <p>{t('auth.systemSubtitle')}</p>
            </div>
            
            <button className="main-login-btn" onClick={handleLogin}>
              <FiLogIn size={20} />
              {t('auth.login')}
            </button>

            <div className="language-selector-bottom">
              <button 
                className="language-btn"
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              >
                <FiGlobe size={16} />
                {languages.find(lang => lang.code === language)?.name}
              </button>
              {showLanguageMenu && (
                <div className="language-menu">
                  {languages.map(lang => (
                    <button 
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLanguageMenu(false);
                      }}
                      className={language === lang.code ? 'active' : ''}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <LoginModal 
          isOpen={showLoginModal} 
          onClose={() => setShowLoginModal(false)} 
        />
      </>
    );
  }

  return (
    <div className="layout">
      {/* Global loading indicator */}
      {loading && (
        <div className="global-loading">
          <div className="loading-bar"></div>
        </div>
      )}

      {/* Global error notification */}
      {error && (
        <div className="global-error">
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={utils.clearError}>×</button>
        </div>
      )}

      {/* Connection status indicator */}
      {connectionStatus === 'offline' && (
        <div className="connection-status offline">
          <FiWifiOff />
          <span>Нет подключения к интернету</span>
        </div>
      )}

      {/* Mobile Navigation Toggle */}
      {!sidebarOpen && (
        <button 
          className="mobile-nav-toggle"
          onClick={() => setSidebarOpen(true)}
        >
          <FiMenu size={20} />
        </button>
      )}

      {/* Mobile Overlay */}
      <div 
        className={`mobile-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo">
          <div className="logo-icon">💎</div>
          <span className="logo-text">RentMS</span>
        </div>
        
        <nav className="nav-menu">
          {navItems.map(item => (
            <NavLink 
              key={item.path}
              to={item.path} 
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              onClick={handleNavClick}
              title={item.label}
            >
              <item.icon size={20} />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button 
            className="nav-item language-selector"
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            title="Язык"
          >
            <FiGlobe size={20} />
            <span className="nav-label">
              {languages.find(lang => lang.code === language)?.name}
            </span>
          </button>
          {showLanguageMenu && (
            <div className="language-menu">
              {languages.map(lang => (
                <button 
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLanguageMenu(false);
                  }}
                  className={language === lang.code ? 'active' : ''}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
          
          <button className="nav-item" title="Настройки">
            <FiSettings size={20} />
            <span className="nav-label">Настройки</span>
          </button>
          
          <button className="nav-item" title="Помощь">
            <FiHelpCircle size={20} />
            <span className="nav-label">Помощь</span>
          </button>
          
          <button className="nav-item logout-btn" onClick={handleLogout} title="Выйти">
            <FiLogOut size={20} />
            <span className="nav-label">Выйти</span>
          </button>
          
          <div className="user-avatar">
            <img 
              src={`https://i.pravatar.cc/150?u=${user?.email}`} 
              alt={user?.first_name || t('common.user')} 
            />
            <div className="user-info">
              <div className="user-name">
                {user?.first_name} {user?.last_name}
              </div>
              <div className="user-role">
                {user?.role === 'system_owner' ? 'Владелец системы' :
                 user?.role === 'admin' ? 'Администратор' :
                 user?.role === 'manager' ? 'Менеджер' :
                 user?.role === 'accountant' ? 'Бухгалтер' :
                 user?.role === 'cleaner' ? 'Уборщик' :
                 user?.role === 'technical_staff' ? 'Техник' :
                 user?.role === 'storekeeper' ? 'Кладовщик' :
                 user?.role}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-container">
        <header className="header">
          <div className="header-left">
            <div className="breadcrumb">
              <span className="organization-name">
                {user?.organization?.name || 'Организация'}
              </span>
            </div>
            <div className="connection-indicator">
              {connectionStatus === 'online' ? (
                <div className="status-online">
                  <FiWifi size={14} />
                  <span>Онлайн</span>
                </div>
              ) : (
                <div className="status-offline">
                  <FiWifiOff size={14} />
                  <span>Офлайн</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="header-right">
            <div className="session-info">
              <span className="session-time">
                {t('common.session')}: {sessionTimer}
              </span>
            </div>
            
            <div className="user-menu">
              <button className="user-button">
                <img 
                  src={`https://i.pravatar.cc/32?u=${user?.email}`} 
                  alt={user?.first_name} 
                />
                <span className="user-name-header">
                  {user?.first_name} {user?.last_name}
                </span>
              </button>
            </div>
            
            <button className="logout-btn-header" onClick={handleLogout} title="Выйти">
              <FiLogOut size={16} />
            </button>
          </div>
        </header>

        <main className="content">
          {children}
        </main>
      </div>

      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </div>
  );
};

export default Layout;