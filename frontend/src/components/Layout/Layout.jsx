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
import { LuUserCog } from "react-icons/lu";
import { FaUsersGear } from "react-icons/fa6";
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
          { path: '/manager/staff', icon: FaUsersGear, label: 'Сотрудники' },
          { path: '/manager/settings', icon: LuUserCog, label: 'Настройки' },
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
          <div className="logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="41" height="44" viewBox="0 0 41 44" fill="none">
              <path d="M0.742188 18.5713C0.742188 8.6411 8.79222 0.591064 18.7224 0.591064V25.4286C18.7224 35.3588 10.6724 43.4088 0.742188 43.4088V18.5713Z" fill="#2495FD"/>
              <path d="M21.3311 10.3615C21.3311 4.96551 25.7055 0.591187 31.1015 0.591187C36.4974 0.591187 40.8718 4.96551 40.8718 10.3615V10.9256C40.8718 16.3216 36.4974 20.6959 31.1015 20.6959C25.7055 20.6959 21.3311 16.3216 21.3311 10.9256V10.3615Z" fill="#94A0DF"/>
              <path d="M21.3311 33.0745C21.3311 27.6785 25.7055 23.3042 31.1015 23.3042C36.4974 23.3042 40.8718 27.6785 40.8718 33.0745V33.6386C40.8718 39.0346 36.4974 43.4089 31.1015 43.4089C25.7055 43.4089 21.3311 39.0346 21.3311 33.6386V33.0745Z" fill="#36ACB4"/>
            </svg>
          </div>
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