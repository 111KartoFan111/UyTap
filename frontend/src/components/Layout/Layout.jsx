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
  FiGlobe
} from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { t, language, setLanguage, languages } = useTranslation();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const navItems = [
    { path: '/', icon: FiHome, label: t('dashboard.title') },
    { path: '/conversations', icon: FiMessageCircle, label: t('conversations.title') },
    { path: '/guests', icon: FiUsers, label: t('guests.title') },
    { path: '/tasks', icon: FiCheckSquare, label: t('tasks.title') },
    { path: '/rooms', icon: FiGrid, label: t('rooms.title') }
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">💎</div>
        </div>
        
        <nav className="nav-menu">
          {navItems.map(item => (
            <NavLink 
              key={item.path}
              to={item.path} 
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
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
          <div className="user-avatar">
            <img src="https://i.pravatar.cc/150?img=3" alt={t('common.user')} />
          </div>
        </div>
      </aside>

      <div className="main-container">
        <header className="header">
          <div className="header-left">
            <span className="update-status">{t('common.updates')}</span>
          </div>
          <div className="header-right">
            <span className="session-time">{t('common.session')}: 34 {t('common.minutes')}</span>
            <span className="user-name">{t('common.user')}: {t('common.userName')}</span>
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