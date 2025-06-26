import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  FiTool
} from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import LoginModal from '../Auth/LoginModal';
import SystemInitModal from '../Auth/SystemInitModal';
import './Layout.css';

const Layout = ({ children }) => {
  const { t, language, setLanguage, languages } = useTranslation();
  const { user, logout, sessionTimer, isAuthenticated } = useAuth();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [systemInitialized, setSystemInitialized] = useState(null); // null = checking, true/false = result

  const navItems = [
    { path: '/', icon: FiHome, label: t('dashboard.title') },
    { path: '/conversations', icon: FiMessageCircle, label: t('conversations.title') },
    { path: '/guests', icon: FiUsers, label: t('guests.title') },
    { path: '/tasks', icon: FiCheckSquare, label: t('tasks.title') },
    { path: '/rooms', icon: FiGrid, label: t('rooms.title') },
    { path: '/employees', icon: FiUsers, label: t('employees.title') }
  ];

  // Проверяем инициализацию системы при загрузке
  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/system/status');
      if (response.ok) {
        const data = await response.json();
        setSystemInitialized(data.initialized);
      } else {
        setSystemInitialized(false);
      }
    } catch (error) {
      console.error('Error checking system status:', error);
      setSystemInitialized(false);
    }
  };

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

  const handleInitSystem = () => {
    setShowInitModal(true);
  };

  const handleInitSuccess = () => {
    setSystemInitialized(true);
    checkSystemStatus(); // Перепроверяем статус
  };

  // Если система не инициализирована, показываем экран инициализации
  if (systemInitialized === false) {
    return (
      <>
        <div className="login-screen">
          <div className="login-container">
            <div className="login-logo">
              <div className="logo-icon">💎</div>
              <h1>Система не инициализирована</h1>
              <p>Необходимо выполнить первоначальную настройку системы</p>
            </div>
            
            <button className="main-login-btn" onClick={handleInitSystem}>
              <FiTool size={20} />
              Инициализировать систему
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

        <SystemInitModal 
          isOpen={showInitModal} 
          onClose={() => setShowInitModal(false)}
          onSuccess={handleInitSuccess}
        />
      </>
    );
  }

  // Показываем загрузку пока проверяем статус
  if (systemInitialized === null) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="login-logo">
            <div className="logo-icon">💎</div>
            <h1>Загрузка...</h1>
            <p>Проверка состояния системы</p>
          </div>
        </div>
      </div>
    );
  }

  // Если пользователь не авторизован, показываем экран входа
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
        </div>
        
        <nav className="nav-menu">
          {navItems.map(item => (
            <NavLink 
              key={item.path}
              to={item.path} 
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              onClick={handleNavClick}
            >
              <item.icon size={20} />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button 
            className="nav-item language-selector"
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
          >
            <FiGlobe size={20} />
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
          <button className="nav-item">
            <FiSettings size={20} />
          </button>
          <button className="nav-item">
            <FiHelpCircle size={20} />
          </button>
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <FiLogOut size={20} />
          </button>
          <div className="user-avatar">
            <img src="https://i.pravatar.cc/150?img=3" alt={user?.first_name || t('common.user')} />
          </div>
        </div>
      </aside>

      <div className="main-container">
        <header className="header">
          <div className="header-left">
            <span className="update-status">{t('common.updates')}</span>
          </div>
          <div className="header-right">
            <span className="session-time">{t('common.session')}: {sessionTimer}</span>
            <span className="user-name">
              {user?.first_name} {user?.last_name}
            </span>
            <button className="logout-btn-header" onClick={handleLogout}>
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

      <SystemInitModal 
        isOpen={showInitModal} 
        onClose={() => setShowInitModal(false)}
        onSuccess={handleInitSuccess}
      />
    </div>
  );
};

export default Layout;