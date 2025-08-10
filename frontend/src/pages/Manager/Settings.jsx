import { useState, useEffect } from 'react';
import { 
  FiSave, 
  FiDollarSign, 
  FiBell, 
  FiLink, 
  FiUsers, 
  FiSettings, 
  FiShield, 
  FiRefreshCw,
  FiCreditCard,
  FiCheckCircle,
  FiAlertCircle,
  FiEye,
  FiEyeOff,
  FiEdit,
  FiTrash2,
  FiPlus
} from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { acquiringAPI } from '../../services/api'; // ДОБАВИЛИ ИМПОРТ
import Modal from '../../components/Common/Modal';
import './Pages.css';

const Settings = () => {
  const { organization, utils } = useData();
  const { user } = useAuth();
  
  const [organizationData, setOrganizationData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Эквайринг состояние
  const [acquiringSettings, setAcquiringSettings] = useState(null);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [acquiringLoading, setAcquiringLoading] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showQuickSetupModal, setShowQuickSetupModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showApiKeys, setShowApiKeys] = useState({});
  
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

  // Форма провайдера эквайринга
  const [providerForm, setProviderForm] = useState({
    provider: '',
    is_enabled: true,
    commission_rate: 2.5,
    display_name: '',
    description: '',
    currency: 'KZT',
    min_amount: 100,
    max_amount: 1000000,
    test_mode: true,
    api_url: '',
    merchant_id: '',
    api_key: '',
    secret_key: '',
    webhook_url: ''
  });

  // Форма быстрой настройки
  const [quickSetupForm, setQuickSetupForm] = useState({
    kaspi_commission: 2.5,
    halyk_commission: 2.0,
    enable_test_mode: true,
    auto_capture: true,
    payment_description: 'Оплата заказа'
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadOrganizationData(),
      loadAcquiringData()
    ]);
  };

  const loadOrganizationData = async () => {
    try {
      setLoading(true);
      
      const [orgData, statsData] = await Promise.allSettled([
        organization.getCurrent(),
        organization.getDashboardStatistics()
      ]);

      if (orgData.status === 'fulfilled') {
        setOrganizationData(orgData.value);
        
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
      }
      
    } catch (error) {
      console.error('Failed to load organization data:', error);
      utils.showError('Не удалось загрузить данные организации');
    } finally {
      setLoading(false);
    }
  };

  const loadAcquiringData = async () => {
    try {
      setAcquiringLoading(true);
      
      // Проверяем права доступа к эквайрингу
      if (!['admin', 'accountant'].includes(user.role)) {
        return;
      }

      console.log('🔄 Loading acquiring data...');

      const [settingsResponse, providersResponse] = await Promise.allSettled([
        acquiringAPI.getSettings(),
        acquiringAPI.getAvailableProviders()
      ]);

      if (settingsResponse.status === 'fulfilled') {
        console.log('✅ Acquiring settings loaded:', settingsResponse.value);
        setAcquiringSettings(settingsResponse.value);
      } else {
        console.warn('❌ Acquiring settings not available:', settingsResponse.reason);
        // Устанавливаем дефолтные настройки
        setAcquiringSettings({
          id: null,
          organization_id: null,
          is_enabled: false,
          default_provider: null,
          providers_config: {},
          auto_capture: true,
          payment_description_template: "Оплата заказа #{order_id}",
          created_at: null,
          updated_at: null
        });
      }

      if (providersResponse.status === 'fulfilled') {
        console.log('✅ Available providers loaded:', providersResponse.value);
        setAvailableProviders(providersResponse.value.available_providers || []);
      } else {
        console.warn('❌ Available providers not loaded:', providersResponse.reason);
        // Устанавливаем дефолтных провайдеров
        setAvailableProviders([
          {
            id: "kaspi",
            name: "Kaspi Bank",
            description: "Kaspi.kz эквайринг",
            default_commission: 2.5,
            supported_currencies: ["KZT"],
            features: ["online_payments", "mobile_payments", "qr_payments"],
            logo_url: "/static/logos/kaspi.png"
          },
          {
            id: "halyk",
            name: "Halyk Bank",
            description: "Народный банк Казахстана",
            default_commission: 2.0,
            supported_currencies: ["KZT", "USD"],
            features: ["online_payments", "mobile_payments", "pos_payments"],
            logo_url: "/static/logos/halyk.png"
          }
        ]);
      }

    } catch (error) {
      console.error('❌ Failed to load acquiring data:', error);
      utils.showError('Ошибка загрузки настроек эквайринга: ' + error.message);
    } finally {
      setAcquiringLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      await organization.updateSettings(settingsForm);
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

  // ИСПРАВЛЕННЫЕ обработчики эквайринга
  const handleEnableAcquiring = async () => {
    try {
      console.log('🔄 Enabling acquiring...');
      
      // Проверяем, есть ли настройки эквайринга
      if (!acquiringSettings || !acquiringSettings.id) {
        utils.showError('Сначала настройте эквайринг через "Быструю настройку"');
        return;
      }
      
      await acquiringAPI.enableAcquiring();
      await loadAcquiringData();
      utils.showSuccess('Эквайринг включен');
    } catch (error) {
      console.error('❌ Failed to enable acquiring:', error);
      utils.showError('Не удалось включить эквайринг: ' + error.message);
    }
  };

  const handleDisableAcquiring = async () => {
    try {
      console.log('🔄 Disabling acquiring...');
      await acquiringAPI.disableAcquiring();
      await loadAcquiringData();
      utils.showSuccess('Эквайринг отключен');
    } catch (error) {
      console.error('❌ Failed to disable acquiring:', error);
      utils.showError('Не удалось отключить эквайринг: ' + error.message);
    }
  };

  const handleQuickSetup = async () => {
    try {
      console.log('🔄 Starting quick setup...', quickSetupForm);
      await acquiringAPI.quickSetup(quickSetupForm);
      await loadAcquiringData();
      setShowQuickSetupModal(false);
      utils.showSuccess('Быстрая настройка завершена');
    } catch (error) {
      console.error('❌ Quick setup failed:', error);
      utils.showError('Ошибка быстрой настройки: ' + error.message);
    }
  };

  const handleTestProvider = async (providerId) => {
    try {
      console.log(`🔄 Testing provider: ${providerId}`);
      const result = await acquiringAPI.testProvider(providerId);
      if (result.connection_status === 'success') {
        utils.showSuccess(`Подключение к ${providerId} успешно`);
      } else {
        utils.showError(`Ошибка подключения к ${providerId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to test provider ${providerId}:`, error);
      utils.showError(`Не удалось протестировать ${providerId}: ` + error.message);
    }
  };

  const toggleApiKeyVisibility = (providerId) => {
    setShowApiKeys(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getUsagePercentage = (current, max) => {
    return max > 0 ? Math.round((current / max) * 100) : 0;
  };

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
            onClick={loadAllData}
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

      {/* ИСПРАВЛЕННЫЙ РАЗДЕЛ: Управление эквайрингом */}
      {['admin', 'accountant'].includes(user.role) && (
        <div className="settings-section acquiring-section">
          <div className="section-header">
            <FiCreditCard />
            <h3>Эквайринг и платежи</h3>
          </div>
          <p>Настройка систем приема платежей</p>

          {acquiringLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Загрузка настроек эквайринга...</p>
            </div>
          ) : (
            <div className="acquiring-content">
              {/* Статус эквайринга */}
              <div className="acquiring-status">
                <div className="status-info">
                  <div className="status-indicator">
                    {acquiringSettings?.is_enabled ? (
                      <FiCheckCircle style={{ color: '#27ae60' }} />
                    ) : (
                      <FiAlertCircle style={{ color: '#e74c3c' }} />
                    )}
                    <span>
                      Эквайринг {acquiringSettings?.is_enabled ? 'включен' : 'отключен'}
                    </span>
                  </div>
                  {acquiringSettings?.default_provider && (
                    <div className="default-provider">
                      Основной провайдер: {acquiringSettings.default_provider}
                    </div>
                  )}
                </div>
                
                <div className="status-controls">
                  {!acquiringSettings?.is_enabled ? (
                    <>
                      <button 
                        className="btn-outline"
                        onClick={() => setShowQuickSetupModal(true)}
                        style={{ marginRight: '12px' }}
                      >
                        <FiPlus /> Быстрая настройка
                      </button>
                      {acquiringSettings?.id && (
                        <button 
                          className="btn-primary"
                          onClick={handleEnableAcquiring}
                        >
                          <FiCheckCircle /> Включить эквайринг
                        </button>
                      )}
                    </>
                  ) : (
                    <button 
                      className="btn-outline"
                      onClick={handleDisableAcquiring}
                      style={{ color: '#e74c3c', borderColor: '#e74c3c' }}
                    >
                      <FiAlertCircle /> Отключить эквайринг
                    </button>
                  )}
                </div>
              </div>

              {/* Настроенные провайдеры */}
              {acquiringSettings?.providers_config && Object.keys(acquiringSettings.providers_config).length > 0 && (
                <div className="configured-providers">
                  <h4>Настроенные провайдеры</h4>
                  <div className="providers-grid">
                    {Object.entries(acquiringSettings.providers_config).map(([providerId, config]) => (
                      <div key={providerId} className="provider-card">
                        <div className="provider-header">
                          <div className="provider-info">
                            <h5>{config.display_name || providerId}</h5>
                            <span className={`provider-status ${config.is_enabled ? 'enabled' : 'disabled'}`}>
                              {config.is_enabled ? 'Активен' : 'Отключен'}
                            </span>
                          </div>
                          <div className="provider-actions">
                            <button 
                              className="btn-icon"
                              onClick={() => handleTestProvider(providerId)}
                              title="Тестировать подключение"
                            >
                              <FiRefreshCw />
                            </button>
                            <button 
                              className="btn-icon"
                              onClick={() => {
                                setSelectedProvider({ id: providerId, ...config });
                                setShowProviderModal(true);
                              }}
                              title="Редактировать"
                            >
                              <FiEdit />
                            </button>
                          </div>
                        </div>
                        
                        <div className="provider-details">
                          <div className="provider-detail">
                            <span>Комиссия:</span>
                            <strong>{config.commission_rate || 0}%</strong>
                          </div>
                          <div className="provider-detail">
                            <span>Валюта:</span>
                            <strong>{config.currency || 'KZT'}</strong>
                          </div>
                          <div className="provider-detail">
                            <span>Режим:</span>
                            <strong>{config.test_mode ? 'Тестовый' : 'Рабочий'}</strong>
                          </div>
                          {config.min_amount && (
                            <div className="provider-detail">
                              <span>Мин. сумма:</span>
                              <strong>{config.min_amount} ₸</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Доступные провайдеры */}
              {availableProviders.length > 0 && (
                <div className="available-providers">
                  <h4>Доступные провайдеры</h4>
                  <div className="providers-list">
                    {availableProviders.map(provider => {
                      const isConfigured = acquiringSettings?.providers_config?.[provider.id];
                      return (
                        <div key={provider.id} className="provider-item">
                          <div className="provider-logo">
                            {provider.logo_url ? (
                              <img src={provider.logo_url} alt={provider.name} />
                            ) : (
                              <FiCreditCard />
                            )}
                          </div>
                          
                          <div className="provider-info">
                            <h5>{provider.name}</h5>
                            <p>{provider.description}</p>
                            <div className="provider-features">
                              <span>Комиссия: {provider.default_commission}%</span>
                              <span>Валюты: {provider.supported_currencies.join(', ')}</span>
                            </div>
                          </div>
                          
                          <div className="provider-action">
                            {isConfigured ? (
                              <span className="configured-badge">
                                <FiCheckCircle /> Настроен
                              </span>
                            ) : (
                              <button 
                                className="btn-outline"
                                onClick={() => {
                                  setProviderForm(prev => ({
                                    ...prev,
                                    provider: provider.id,
                                    display_name: provider.name,
                                    description: provider.description,
                                    commission_rate: provider.default_commission,
                                    currency: provider.supported_currencies[0] || 'KZT'
                                  }));
                                  setSelectedProvider(null);
                                  setShowProviderModal(true);
                                }}
                              >
                                <FiPlus /> Настроить
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="settings-sections">
        {/* Остальные разделы настроек остаются без изменений */}
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

      {/* Модальное окно быстрой настройки эквайринга */}
      <Modal 
        isOpen={showQuickSetupModal} 
        onClose={() => setShowQuickSetupModal(false)}
        title="Быстрая настройка эквайринга"
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
            <p>Настройте популярные банки Казахстана за несколько кликов</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label>Комиссия Kaspi Bank (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={quickSetupForm.kaspi_commission}
                onChange={(e) => setQuickSetupForm(prev => ({ 
                  ...prev, 
                  kaspi_commission: parseFloat(e.target.value) 
                }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div>
              <label>Комиссия Halyk Bank (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={quickSetupForm.halyk_commission}
                onChange={(e) => setQuickSetupForm(prev => ({ 
                  ...prev, 
                  halyk_commission: parseFloat(e.target.value) 
                }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div>
            <label>Описание платежа</label>
            <input
              type="text"
              value={quickSetupForm.payment_description}
              onChange={(e) => setQuickSetupForm(prev => ({ 
                ...prev, 
                payment_description: e.target.value 
              }))}
              placeholder="Оплата заказа"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={quickSetupForm.enable_test_mode}
                onChange={(e) => setQuickSetupForm(prev => ({ 
                  ...prev, 
                  enable_test_mode: e.target.checked 
                }))}
              />
              <span>Включить тестовый режим</span>
            </label>

            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={quickSetupForm.auto_capture}
                onChange={(e) => setQuickSetupForm(prev => ({ 
                  ...prev, 
                  auto_capture: e.target.checked 
                }))}
              />
              <span>Автоматическое списание средств</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button 
              onClick={() => setShowQuickSetupModal(false)}
              style={{ 
                padding: '10px 20px', 
                border: '1px solid #ddd', 
                background: 'white', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Отмена
            </button>
            <button 
              onClick={handleQuickSetup}
              className="btn-primary"
            >
              <FiCheckCircle /> Настроить эквайринг
            </button>
          </div>
        </div>
      </Modal>

      {/* Модальное окно настройки провайдера */}
      <Modal 
        isOpen={showProviderModal} 
        onClose={() => {
          setShowProviderModal(false);
          setSelectedProvider(null);
          setProviderForm({
            provider: '',
            is_enabled: true,
            commission_rate: 2.5,
            display_name: '',
            description: '',
            currency: 'KZT',
            min_amount: 100,
            max_amount: 1000000,
            test_mode: true,
            api_url: '',
            merchant_id: '',
            api_key: '',
            secret_key: '',
            webhook_url: ''
          });
        }}
        title={selectedProvider ? 'Редактировать провайдера' : 'Настроить провайдера'}
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label>Отображаемое название</label>
              <input
                type="text"
                value={providerForm.display_name}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  display_name: e.target.value 
                }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div>
              <label>Комиссия (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={providerForm.commission_rate}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  commission_rate: parseFloat(e.target.value) 
                }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div>
            <label>Описание</label>
            <textarea
              value={providerForm.description}
              onChange={(e) => setProviderForm(prev => ({ 
                ...prev, 
                description: e.target.value 
              }))}
              rows={2}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label>Валюта</label>
              <select
                value={providerForm.currency}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  currency: e.target.value 
                }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="KZT">KZT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div>
              <label>Мин. сумма</label>
              <input
                type="number"
                min="1"
                value={providerForm.min_amount}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  min_amount: parseInt(e.target.value) 
                }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div>
              <label>Макс. сумма</label>
              <input
                type="number"
                min="1"
                value={providerForm.max_amount}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  max_amount: parseInt(e.target.value) 
                }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div>
            <label>API URL</label>
            <input
              type="url"
              value={providerForm.api_url}
              onChange={(e) => setProviderForm(prev => ({ 
                ...prev, 
                api_url: e.target.value 
              }))}
              placeholder="https://api.bank.kz"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label>Merchant ID</label>
              <input
                type="text"
                value={providerForm.merchant_id}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  merchant_id: e.target.value 
                }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div>
              <label>Webhook URL</label>
              <input
                type="url"
                value={providerForm.webhook_url}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  webhook_url: e.target.value 
                }))}
                placeholder="https://yoursite.com/webhook"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label>API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKeys[providerForm.provider] ? 'text' : 'password'}
                  value={providerForm.api_key}
                  onChange={(e) => setProviderForm(prev => ({ 
                    ...prev, 
                    api_key: e.target.value 
                  }))}
                  style={{ 
                    width: '100%', 
                    padding: '8px 40px 8px 8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px' 
                  }}
                />
                <button
                  type="button"
                  onClick={() => toggleApiKeyVisibility(providerForm.provider)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {showApiKeys[providerForm.provider] ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div>
              <label>Secret Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKeys[providerForm.provider + '_secret'] ? 'text' : 'password'}
                  value={providerForm.secret_key}
                  onChange={(e) => setProviderForm(prev => ({ 
                    ...prev, 
                    secret_key: e.target.value 
                  }))}
                  style={{ 
                    width: '100%', 
                    padding: '8px 40px 8px 8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px' 
                  }}
                />
                <button
                  type="button"
                  onClick={() => toggleApiKeyVisibility(providerForm.provider + '_secret')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {showApiKeys[providerForm.provider + '_secret'] ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={providerForm.is_enabled}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  is_enabled: e.target.checked 
                }))}
              />
              <span>Включить провайдера</span>
            </label>

            <label className="checkbox-field">
              <input 
                type="checkbox"
                checked={providerForm.test_mode}
                onChange={(e) => setProviderForm(prev => ({ 
                  ...prev, 
                  test_mode: e.target.checked 
                }))}
              />
              <span>Тестовый режим</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button 
              onClick={() => {
                setShowProviderModal(false);
                setSelectedProvider(null);
              }}
              style={{ 
                padding: '10px 20px', 
                border: '1px solid #ddd', 
                background: 'white', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Отмена
            </button>
            <button 
              onClick={async () => {
                try {
                  if (selectedProvider) {
                    await acquiringAPI.updateProvider(selectedProvider.id, providerForm);
                  } else {
                    await acquiringAPI.createProvider(providerForm);
                  }
                  await loadAcquiringData();
                  setShowProviderModal(false);
                  setSelectedProvider(null);
                  utils.showSuccess('Провайдер сохранен');
                } catch (error) {
                  utils.showError('Ошибка сохранения провайдера: ' + error.message);
                }
              }}
              className="btn-primary"
            >
              <FiSave /> Сохранить провайдера
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;