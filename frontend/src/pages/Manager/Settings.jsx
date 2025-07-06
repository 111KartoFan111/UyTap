import { useState } from 'react';
import { FiSave, FiDollarSign, FiBell, FiLink } from 'react-icons/fi';
import './Pages.css'; // Assuming you have a CSS file for styling

const Settings = () => {
  const [settings, setSettings] = useState({
    hourlyRate: 3000,
    dailyRate: 18000,
    monthlyRate: 220000,
    notifications: {
      email: true,
      sms: false,
      push: true
    }
  });

  const handleSave = () => {
    console.log('Saving settings:', settings);
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Настройки системы</h1>
        <button className="btn-primary" onClick={handleSave}>
          <FiSave /> Сохранить изменения
        </button>
      </div>
      
      <div className="settings-sections">
        <div className="settings-section">
          <div className="section-header">
            <FiDollarSign />
            <h3>Тарифы</h3>
          </div>
          <p>Настройка стоимости аренды</p>
          
          <div className="settings-form">
            <div className="form-field">
              <label>Почасовая ставка (₸/час)</label>
              <input 
                type="number"
                value={settings.hourlyRate}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  hourlyRate: parseInt(e.target.value) 
                }))}
              />
            </div>
            <div className="form-field">
              <label>Посуточная ставка (₸/сутки)</label>
              <input 
                type="number"
                value={settings.dailyRate}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  dailyRate: parseInt(e.target.value) 
                }))}
              />
            </div>
            <div className="form-field">
              <label>Помесячная ставка (₸/месяц)</label>
              <input 
                type="number"
                value={settings.monthlyRate}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  monthlyRate: parseInt(e.target.value) 
                }))}
              />
            </div>
          </div>
        </div>
        
        <div className="settings-section">
          <div className="section-header">
            <FiBell />
            <h3>Уведомления</h3>
          </div>
          <p>Настройка оповещений</p>
          
          <div className="settings-form">
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settings.notifications.email}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  notifications: { 
                    ...prev.notifications, 
                    email: e.target.checked 
                  }
                }))}
              />
              <span>Email уведомления</span>
            </label>
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settings.notifications.sms}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  notifications: { 
                    ...prev.notifications, 
                    sms: e.target.checked 
                  }
                }))}
              />
              <span>SMS уведомления</span>
            </label>
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settings.notifications.push}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  notifications: { 
                    ...prev.notifications, 
                    push: e.target.checked 
                  }
                }))}
              />
              <span>Push уведомления</span>
            </label>
          </div>
        </div>
        
        <div className="settings-section">
          <div className="section-header">
            <FiLink />
            <h3>Интеграции</h3>
          </div>
          <p>Внешние сервисы и API</p>
          <button className="btn-outline">Настроить</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;