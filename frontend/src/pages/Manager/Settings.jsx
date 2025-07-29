import { useState, useEffect } from 'react';
import { FiSave, FiDollarSign, FiBell, FiLink, FiUsers, FiSettings, FiShield, FiRefreshCw } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import './Pages.css';

const Settings = () => {
  const { organization, utils } = useData();
  const { user } = useAuth();
  
  const [organizationData, setOrganizationData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settingsForm, setSettingsForm] = useState({
    // Настройки уведомлений
    notifications: {
      email: true,
      sms: false,
      push: true,
      booking_reminders: true,
      payment_reminders: true,
      task_notifications: true
    },
    
    // Общие настройки
    general: {
      timezone: 'Asia/Almaty',
      language: 'ru',
      currency: 'KZT',
      date_format: 'dd/mm/yyyy',
      auto_checkout: true,
      auto_assign_tasks: false
    },
    
    // Настройки безопасности
    security: {
      two_factor_required: false,
      password_expiry_days: 90,
      session_timeout: 24,
      audit_logging: true
    }
  });

  useEffect(() => {
    loadOrganizationData();
  }, []);

  const loadOrganizationData = async () => {
    try {
      setLoading(true);
      
      const [orgData, statsData] = await Promise.allSettled([
        organization.getCurrent(),
        organization.getDashboardStatistics()
      ]);

      if (orgData.status === 'fulfilled') {
        setOrganizationData(orgData.value);
        
        // Обновляем форму настроек из данных организации
        if (orgData.value.settings) {
          setSettingsForm(prev => ({
            ...prev,
            ...orgData.value.settings
          }));
        }
      } else {
        console.error('Failed to load organization data:', orgData.reason);
        utils.showError('Не удалось загрузить данные организации');
      }
      
      if (statsData.status === 'fulfilled') {
        setDashboardStats(statsData.value);
      } else {
        console.error('Failed to load dashboard stats:', statsData.reason);
        utils.showError('Не удалось загрузить статистику');
      }
      
    } catch (error) {
      console.error('Failed to load organization data:', error);
      utils.showError('Не удалось загрузить данные организации');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      await organization.updateSettings(settingsForm);
      
      // Обновляем данные организации
      await loadOrganizationData();
      
      utils.showSuccess('Настройки сохранены успешно');
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      utils.showError('Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = (key, value) => {
    setSettingsForm(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  const handleGeneralChange = (key, value) => {
    setSettingsForm(prev => ({
      ...prev,
      general: {
        ...prev.general,
        [key]: value
      }
    }));
  };

  const handleSecurityChange = (key, value) => {
    setSettingsForm(prev => ({
      ...prev,
      security: {
        ...prev.security,
        [key]: value
      }
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getUsagePercentage = (current, max) => {
    return max > 0 ? Math.round((current / max) * 100) : 0;
  };

  // Функция для парсинга лимитов из строки "2/10"
  const parseLimitUsage = (limitString) => {
    if (!limitString || typeof limitString !== 'string') return { current: 0, max: 0 };
    const [current, max] = limitString.split('/').map(num => parseInt(num) || 0);
    return { current, max };
  };

  if (loading) {
    return (
      <div className="settings-page loading">
        <div className="loading-spinner"></div>
        <p>Загрузка настроек...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Настройки системы</h1>
        <div className="header-controls">
          <button 
            className="btn-outline"
            onClick={loadOrganizationData}
            disabled={loading}
          >
            <FiRefreshCw /> Обновить
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? <FiRefreshCw className="spinning" /> : <FiSave />}
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>

      {/* Информация об организации */}
      {organizationData && (
        <div className="organization-info">
          <h2>Информация об организации</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Название:</label>
              <span>{organizationData.name}</span>
            </div>
            <div className="info-item">
              <label>Email:</label>
              <span>{organizationData.email || 'Не указан'}</span>
            </div>
            <div className="info-item">
              <label>Телефон:</label>
              <span>{organizationData.phone || 'Не указан'}</span>
            </div>
            <div className="info-item">
              <label>Адрес:</label>
              <span>{organizationData.address || 'Не указан'}</span>
            </div>
            <div className="info-item">
              <label>Статус:</label>
              <span className={`status-badge ${organizationData.status || 'active'}`}>
                {organizationData.status || 'Активный'}
              </span>
            </div>
            <div className="info-item">
              <label>Дата создания:</label>
              <span>{formatDate(organizationData.created_at)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Лимиты и использование */}
      {dashboardStats && (
        <div className="usage-section">
          <h2>Использование ресурсов</h2>
          <div className="actions-grid">
            {dashboardStats.admin_specific?.organization_health && (
              <>
                <div className="usage-card">
                  <h3>Пользователи</h3>
                  {(() => {
                    const userLimits = parseLimitUsage(dashboardStats.admin_specific.organization_health.user_limit_usage);
                    return (
                      <>
                        <div className="usage-bar">
                          <div 
                            className="usage-fill"
                            style={{
                              width: `${getUsagePercentage(userLimits.current, userLimits.max)}%`
                            }}
                          />
                        </div>
                        <span className="usage-text">
                          {userLimits.current} из {userLimits.max}
                        </span>
                      </>
                    );
                  })()}
                </div>
                
                <div className="usage-card">
                  <h3>Помещения</h3>
                  {(() => {
                    const propertyLimits = parseLimitUsage(dashboardStats.admin_specific.organization_health.property_limit_usage);
                    return (
                      <>
                        <div className="usage-bar">
                          <div 
                            className="usage-fill"
                            style={{
                              width: `${getUsagePercentage(propertyLimits.current, propertyLimits.max)}%`
                            }}
                          />
                        </div>
                        <span className="usage-text">
                          {propertyLimits.current} из {propertyLimits.max}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
            
            {dashboardStats.organization_stats && (
              <>
                <div className="usage-card">
                  <h3>Активные аренды</h3>
                  <div className="usage-number">
                    {dashboardStats.organization_stats.active_rentals || 0}
                  </div>
                </div>
                
                <div className="usage-card">
                  <h3>Всего клиентов</h3>
                  <div className="usage-number">
                    {dashboardStats.organization_stats.total_clients || 0}
                  </div>
                </div>

                <div className="usage-card">
                  <h3>Всего сотрудников</h3>
                  <div className="usage-number">
                    {dashboardStats.organization_stats.total_staff || 0}
                  </div>
                </div>
              </>
            )}

            {dashboardStats.month_stats && (
              <>
                <div className="usage-card">
                  <h3>Выручка за месяц</h3>
                  <div className="usage-number">
                    {dashboardStats.month_stats.revenue || 0} ₸
                  </div>
                </div>

                <div className="usage-card">
                  <h3>Заполняемость</h3>
                  <div className="usage-number">
                    {dashboardStats.month_stats.occupancy_rate || 0}%
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="settings-sections">
        {/* Настройки уведомлений */}
        <div className="settings-section">
          <div className="section-header">
            <FiBell />
            <h3>Уведомления</h3>
          </div>
          <p>Настройка оповещений и уведомлений</p>
          
          <div className="settings-form">
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.notifications.email}
                onChange={(e) => handleNotificationChange('email', e.target.checked)}
              />
              <span>Email уведомления</span>
            </label>
            
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.notifications.sms}
                onChange={(e) => handleNotificationChange('sms', e.target.checked)}
              />
              <span>SMS уведомления</span>
            </label>
            
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.notifications.push}
                onChange={(e) => handleNotificationChange('push', e.target.checked)}
              />
              <span>Push уведомления</span>
            </label>
            
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.notifications.booking_reminders}
                onChange={(e) => handleNotificationChange('booking_reminders', e.target.checked)}
              />
              <span>Напоминания о бронированиях</span>
            </label>
            
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.notifications.payment_reminders}
                onChange={(e) => handleNotificationChange('payment_reminders', e.target.checked)}
              />
              <span>Напоминания об оплате</span>
            </label>
            
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.notifications.task_notifications}
                onChange={(e) => handleNotificationChange('task_notifications', e.target.checked)}
              />
              <span>Уведомления о задачах</span>
            </label>
          </div>
        </div>
        
        {/* Общие настройки */}
        <div className="settings-section">
          <div className="section-header">
            <FiSettings />
            <h3>Общие настройки</h3>
          </div>
          <p>Основные параметры системы</p>
          
          <div className="settings-form">
            <div className="form-field">
              <label>Часовой пояс</label>
              <select 
                value={settingsForm.general.timezone}
                onChange={(e) => handleGeneralChange('timezone', e.target.value)}
              >
                <option value="Asia/Almaty">Алматы (UTC+6)</option>
                <option value="Asia/Nur-Sultan">Нур-Султан (UTC+6)</option>
                <option value="Europe/Moscow">Москва (UTC+3)</option>
              </select>
            </div>
            
            <div className="form-field">
              <label>Язык</label>
              <select 
                value={settingsForm.general.language}
                onChange={(e) => handleGeneralChange('language', e.target.value)}
              >
                <option value="ru">Русский</option>
                <option value="kk">Қазақша</option>
                <option value="en">English</option>
              </select>
            </div>
            
            <div className="form-field">
              <label>Валюта</label>
              <select 
                value={settingsForm.general.currency}
                onChange={(e) => handleGeneralChange('currency', e.target.value)}
              >
                <option value="KZT">Тенге (₸)</option>
                <option value="USD">Доллар ($)</option>
                <option value="EUR">Евро (€)</option>
              </select>
            </div>
            
            <div className="form-field">
              <label>Формат даты</label>
              <select 
                value={settingsForm.general.date_format}
                onChange={(e) => handleGeneralChange('date_format', e.target.value)}
              >
                <option value="dd/mm/yyyy">ДД/ММ/ГГГГ</option>
                <option value="mm/dd/yyyy">ММ/ДД/ГГГГ</option>
                <option value="yyyy-mm-dd">ГГГГ-ММ-ДД</option>
              </select>
            </div>
            
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.general.auto_checkout}
                onChange={(e) => handleGeneralChange('auto_checkout', e.target.checked)}
              />
              <span>Автоматическое выселение</span>
            </label>
            
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.general.auto_assign_tasks}
                onChange={(e) => handleGeneralChange('auto_assign_tasks', e.target.checked)}
              />
              <span>Автоматическое назначение задач</span>
            </label>
          </div>
        </div>
        
        {/* Настройки безопасности */}
        <div className="settings-section">
          <div className="section-header">
            <FiShield />
            <h3>Безопасность</h3>
          </div>
          <p>Параметры безопасности и доступа</p>
          
          <div className="settings-form">
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.security.two_factor_required}
                onChange={(e) => handleSecurityChange('two_factor_required', e.target.checked)}
              />
              <span>Обязательная двухфакторная аутентификация</span>
            </label>
            
            <div className="form-field">
              <label>Срок действия пароля (дни)</label>
              <input 
                type="number"
                min="30"
                max="365"
                value={settingsForm.security.password_expiry_days}
                onChange={(e) => handleSecurityChange('password_expiry_days', parseInt(e.target.value))}
              />
            </div>
            
            <div className="form-field">
              <label>Время сессии (часы)</label>
              <input 
                type="number"
                min="1"
                max="168"
                value={settingsForm.security.session_timeout}
                onChange={(e) => handleSecurityChange('session_timeout', parseInt(e.target.value))}
              />
            </div>
            
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={settingsForm.security.audit_logging}
                onChange={(e) => handleSecurityChange('audit_logging', e.target.checked)}
              />
              <span>Журналирование действий</span>
            </label>
          </div>
        </div>
        
        {/* Интеграции */}
        <div className="settings-section">
          <div className="section-header">
            <FiLink />
            <h3>Интеграции</h3>
          </div>
          <p>Внешние сервисы и API</p>
          
          <div className="integration-list">
            <div className="integration-item">
              <div className="integration-info">
                <h4>ИС ЭСФ</h4>
                <p>Интеграция с системой электронных счетов-фактур</p>
              </div>
              <button className="btn-outline">Настроить</button>
            </div>
            
            <div className="integration-item">
              <div className="integration-info">
                <h4>Платежные системы</h4>
                <p>Kaspi, Halyk Bank, Sberbank</p>
              </div>
              <button className="btn-outline">Настроить</button>
            </div>
            
            <div className="integration-item">
              <div className="integration-info">
                <h4>SMS-шлюз</h4>
                <p>Отправка SMS уведомлений</p>
              </div>
              <button className="btn-outline">Настроить</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;