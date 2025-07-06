// frontend/src/components/Layout/Layout.jsx
import { useState } from 'react';
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
  FiLogOut,
  FiCalendar,
  FiBarChart2,
  FiPackage,
  FiTool,
  FiDollarSign
} from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { t, language, setLanguage, languages } = useTranslation();
  const { user, logout, sessionTimer, isAuthenticated } = useAuth();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Get navigation items based on user role
  const getNavigationItems = () => {
    if (!user) return [];

    switch (user.role) {
      case 'admin':
      case 'manager':
        return [
          { path: '/manager', icon: FiHome, label: 'Главная' },
          { path: '/manager/floor-plan', icon: FiGrid, label: 'План этажа' },
          { path: '/manager/rentals', icon: FiCalendar, label: 'Аренда' },
          { path: '/manager/clients', icon: FiUsers, label: 'Клиенты' },
          { path: '/manager/reports', icon: FiBarChart2, label: 'Отчеты' },
          { path: '/manager/settings', icon: FiSettings, label: 'Настройки' },
        ];
      
      case 'cleaner':
        return [
          { path: '/cleaner', icon: FiHome, label: 'Мои задачи' },
          { path: '/tasks', icon: FiCheckSquare, label: 'Все задачи' },
        ];
      
      case 'technical_staff':
        return [
          { path: '/technical', icon: FiHome, label: 'Заявки' },
          { path: '/tasks', icon: FiTool, label: 'Задачи' },
        ];
      
      case 'accountant':
        return [
          { path: '/accountant', icon: FiHome, label: 'Финансы' },
          { path: '/guests', icon: FiUsers, label: 'Клиенты' },
        ];
      
      case 'storekeeper':
        return [
          { path: '/storekeeper', icon: FiHome, label: 'Склад' },
          { path: '/tasks', icon: FiPackage, label: 'Поставки' },
        ];
      
      default:
        return [
          { path: '/dashboard', icon: FiHome, label: t('dashboard.title') },
          { path: '/conversations', icon: FiMessageCircle, label: t('conversations.title') },
          { path: '/guests', icon: FiUsers, label: t('guests.title') },
          { path: '/tasks', icon: FiCheckSquare, label: t('tasks.title') },
          { path: '/rooms', icon: FiGrid, label: t('rooms.title') },
          { path: '/employees', icon: FiUsers, label: t('employees.title') }
        ];
    }
  };

  const navItems = getNavigationItems();

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

  if (!isAuthenticated) {
    return null;
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
              className={({ isActive }) => {
                // Check if current location matches or is child of nav item
                const isCurrentActive = isActive || location.pathname.startsWith(item.path);
                return isCurrentActive ? 'nav-item active' : 'nav-item';
              }}
              onClick={handleNavClick}
              title={item.label}
            >
              <item.icon size={20} />
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
          </button>
          <button className="nav-item" title="Помощь">
            <FiHelpCircle size={20} />
          </button>
          <button className="nav-item logout-btn" onClick={handleLogout} title="Выйти">
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
    </div>
  );
};

export default Layout;