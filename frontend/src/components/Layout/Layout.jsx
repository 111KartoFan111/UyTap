// frontend/src/components/Layout/Layout.jsx
import { useState, useEffect } from 'react';
import { 
  FiHome, 
  FiUsers, 
  FiCalendar, 
  FiClipboard, 
  FiPackage, 
  FiFileText,
  FiDollarSign,
  FiBarChart2,
  FiSettings,
  FiLogOut,
  FiUser,
  FiBell,
  FiGlobe,
  FiMenu,
  FiX
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout, sessionTimer } = useAuth();
  const { t, language, setLanguage, languages } = useTranslation();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Load notifications
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      // Здесь будет загрузка уведомлений через API
      // const notifications = await notificationsAPI.getNotifications();
      // setNotifications(notifications);
      
      // Временно - пустой массив
      setNotifications([]);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  // Navigation items based on role
  const getNavigationItems = () => {
    const baseItems = [
      { 
        id: 'dashboard', 
        label: t('navigation.dashboard'), 
        icon: FiHome, 
        path: '/' 
      }
    ];

    const roleBasedItems = {
      'system_owner': [
        { id: 'admin', label: 'Администрирование', icon: FiSettings, path: '/admin' }
      ],
      'admin': [
        { id: 'properties', label: t('navigation.properties'), icon: FiHome, path: '/properties' },
        { id: 'clients', label: t('navigation.clients'), icon: FiUsers, path: '/clients' },
        { id: 'rentals', label: t('navigation.rentals'), icon: FiCalendar, path: '/rentals' },
        { id: 'tasks', label: t('navigation.tasks'), icon: FiClipboard, path: '/tasks' },
        { id: 'inventory', label: t('navigation.inventory'), icon: FiPackage, path: '/inventory' },
        { id: 'documents', label: t('navigation.documents'), icon: FiFileText, path: '/documents' },
        { id: 'payroll', label: t('navigation.payroll'), icon: FiDollarSign, path: '/payroll' },
        { id: 'reports', label: t('navigation.reports'), icon: FiBarChart2, path: '/reports' },
        { id: 'settings', label: t('navigation.settings'), icon: FiSettings, path: '/settings' }
      ],
      'manager': [
        { id: 'properties', label: t('navigation.properties'), icon: FiHome, path: '/properties' },
        { id: 'clients', label: t('navigation.clients'), icon: FiUsers, path: '/clients' },
        { id: 'rentals', label: t('navigation.rentals'), icon: FiCalendar, path: '/rentals' },
        { id: 'tasks', label: t('navigation.tasks'), icon: FiClipboard, path: '/tasks' },
        { id: 'reports', label: t('navigation.reports'), icon: FiBarChart2, path: '/reports' }
      ],
      'accountant': [
        { id: 'financial', label: 'Финансы', icon: FiDollarSign, path: '/financial' },
        { id: 'documents', label: t('navigation.documents'), icon: FiFileText, path: '/documents' },
        { id: 'payroll', label: t('navigation.payroll'), icon: FiDollarSign, path: '/payroll' },
        { id: 'reports', label: t('navigation.reports'), icon: FiBarChart2, path: '/reports' }
      ],
      'cleaner': [
        { id: 'my-tasks', label: 'Мои задачи', icon: FiClipboard, path: '/my-tasks' },
        { id: 'schedule', label: 'Расписание', icon: FiCalendar, path: '/schedule' }
      ],
      'technical_staff': [
        { id: 'my-tasks', label: 'Мои задачи', icon: FiClipboard, path: '/my-tasks' },
        { id: 'maintenance', label: 'Обслуживание', icon: FiSettings, path: '/maintenance' },
        { id: 'inventory', label: t('navigation.inventory'), icon: FiPackage, path: '/inventory' }
      ],
      'storekeeper': [
        { id: 'inventory', label: t('navigation.inventory'), icon: FiPackage, path: '/inventory' },
        { id: 'supplies', label: 'Поставки', icon: FiPackage, path: '/supplies' }
      ]
    };

    return [...baseItems, ...(roleBasedItems[user?.role] || [])];
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigationItems = getNavigationItems();

  if (!user) {
    return children;
  }

  return (
    <div className="app-layout">
      {/* Mobile header */}
      <div className="mobile-header">
        <button 
          className="menu-toggle"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          {showSidebar ? <FiX /> : <FiMenu />}
        </button>
        <div className="mobile-logo">
          <h2>PropertyMS</h2>
        </div>
        <div className="mobile-user">
          <button 
            className="user-avatar"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <FiUser />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${showSidebar ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <h2>PropertyMS</h2>
          </div>
          <button 
            className="sidebar-close"
            onClick={() => setShowSidebar(false)}
          >
            <FiX />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map(item => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                className="nav-item"
                onClick={() => {
                  // Здесь будет навигация через React Router
                  console.log('Navigate to:', item.path);
                  setShowSidebar(false);
                }}
              >
                <IconComponent />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <FiUser />
            </div>
            <div className="user-details">
              <div className="user-name">{user.first_name} {user.last_name}</div>
              <div className="user-role">{user.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <button 
              className="sidebar-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <FiMenu />
            </button>
          </div>

          <div className="header-right">
            {/* Language switcher */}
            <div className="language-switcher">
              <button className="lang-btn">
                <FiGlobe />
                <span>{language.toUpperCase()}</span>
              </button>
              <div className="lang-dropdown">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={language === lang.code ? 'active' : ''}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="notifications">
              <button 
                className="notifications-btn"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <FiBell />
                {notifications.length > 0 && (
                  <span className="notifications-badge">{notifications.length}</span>
                )}
              </button>
              {showNotifications && (
                <div className="notifications-dropdown">
                  <div className="notifications-header">
                    <h4>Уведомления</h4>
                  </div>
                  <div className="notifications-list">
                    {notifications.length === 0 ? (
                      <div className="no-notifications">
                        Нет новых уведомлений
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div key={notification.id} className="notification-item">
                          {notification.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="user-menu">
              <button 
                className="user-menu-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar">
                  <FiUser />
                </div>
                <div className="user-info">
                  <div className="user-name">{user.first_name}</div>
                  <div className="session-time">{sessionTimer}</div>
                </div>
              </button>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-name">{user.first_name} {user.last_name}</div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-role">{user.role}</div>
                  </div>
                  <div className="user-dropdown-menu">
                    <button className="dropdown-item">
                      <FiUser />
                      <span>Профиль</span>
                    </button>
                    <button className="dropdown-item">
                      <FiSettings />
                      <span>Настройки</span>
                    </button>
                    <hr />
                    <button 
                      className="dropdown-item logout"
                      onClick={handleLogout}
                    >
                      <FiLogOut />
                      <span>Выйти</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {showSidebar && (
        <div 
          className="sidebar-overlay"
          onClick={() => setShowSidebar(false)}
        />
      )}
    </div>
  );
};

export default Layout;