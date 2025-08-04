import React, { useState } from 'react';
import { 
  FiSettings, 
  FiPlus, 
  FiRefreshCw, 
  FiAward, 
  FiDownload,
  FiUsers,
  FiFileText,
  FiSend,
  FiAlertCircle,
  FiCalendar
} from 'react-icons/fi';

const PayrollQuickActions = ({ 
  onShowTemplateModal, 
  onShowOperationModal, 
  onAutoGenerate, 
  onBulkOperations,
  onExportAll,
  onShowAnalytics,
  loading,
  currentPeriod,
  stats
}) => {
  const [expandedSection, setExpandedSection] = useState(null);

  const quickActionGroups = [
    {
      title: 'Управление зарплатами',
      actions: [
        {
          id: 'templates',
          title: 'Шаблоны зарплат',
          description: 'Настройка автоматических расчетов',
          icon: FiSettings,
          onClick: onShowTemplateModal,
          color: 'blue'
        },
        {
          id: 'operations',
          title: 'Добавить операцию',
          description: 'Премии, штрафы, надбавки',
          icon: FiPlus,
          onClick: onShowOperationModal,
          color: 'green'
        },
        {
          id: 'auto-generate',
          title: 'Автогенерация',
          description: 'Создать зарплаты за месяц',
          icon: FiRefreshCw,
          onClick: onAutoGenerate,
          color: 'purple',
          disabled: loading
        }
      ]
    },
    {
      title: 'Массовые операции',
      actions: [
        {
          id: 'bulk-operations',
          title: 'Массовые операции',
          description: 'Премии для группы сотрудников',
          icon: FiAward,
          onClick: onBulkOperations,
          color: 'orange'
        },
        {
          id: 'bulk-payments',
          title: 'Массовые выплаты',
          description: 'Отметить группу как выплаченную',
          icon: FiUsers,
          onClick: () => {/* TODO */},
          color: 'teal'
        }
      ]
    },
    {
      title: 'Отчеты и экспорт',
      actions: [
        {
          id: 'export',
          title: 'Экспорт отчетов',
          description: 'Excel, PDF отчеты',
          icon: FiDownload,
          onClick: onExportAll,
          color: 'indigo'
        },
        {
          id: 'analytics',
          title: 'Аналитика',
          description: 'Детальная аналитика по зарплатам',
          icon: FiFileText,
          onClick: onShowAnalytics,
          color: 'pink'
        },
        {
          id: 'notifications',
          title: 'Уведомления',
          description: 'Отправить уведомления сотрудникам',
          icon: FiSend,
          onClick: () => {/* TODO */},
          color: 'yellow'
        }
      ]
    }
  ];

  const handleActionClick = (action) => {
    if (action.disabled || loading) return;
    action.onClick();
  };

  return (
    <div className="payroll-quick-actions">
      <div className="quick-actions-header">
        <h3>
          <FiSettings /> Быстрые действия
        </h3>
        <div className="period-info">
          <FiCalendar />
          <span>{currentPeriod.month}/{currentPeriod.year}</span>
        </div>
      </div>

      {/* Предупреждения и уведомления */}
      {stats.pendingPayrolls > 0 && (
        <div className="action-alert warning">
          <FiAlertCircle />
          <span>
            У вас {stats.pendingPayrolls} зарплат ожидают выплаты на сумму{' '}
            ₸ {(stats.pendingPayrolls * stats.avgSalary).toLocaleString()}
          </span>
        </div>
      )}

      {stats.totalPayrolls === 0 && (
        <div className="action-alert info">
          <FiRefreshCw />
          <span>
            Зарплаты за {currentPeriod.month}/{currentPeriod.year} еще не созданы.{' '}
            <button 
              className="btn-link" 
              onClick={onAutoGenerate}
              disabled={loading}
            >
              Создать автоматически
            </button>
          </span>
        </div>
      )}

      {/* Группы действий */}
      <div className="action-groups">
        {quickActionGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="action-group">
            <div 
              className="action-group-header"
              onClick={() => setExpandedSection(
                expandedSection === groupIndex ? null : groupIndex
              )}
            >
              <h4>{group.title}</h4>
              <span className="expand-icon">
                {expandedSection === groupIndex ? '▲' : '▼'}
              </span>
            </div>
            
            <div className={`action-group-content ${
              expandedSection === groupIndex || expandedSection === null ? 'expanded' : 'collapsed'
            }`}>
              <div className="actions-grid">
                {group.actions.map((action) => {
                  const IconComponent = action.icon;
                  
                  return (
                    <button 
                      key={action.id}
                      className={`quick-action-card ${action.color} ${
                        action.disabled || loading ? 'disabled' : ''
                      }`}
                      onClick={() => handleActionClick(action)}
                      disabled={action.disabled || loading}
                    >
                      <div className="action-icon">
                        <IconComponent />
                      </div>
                      <div className="action-content">
                        <div className="action-title">{action.title}</div>
                        <div className="action-description">{action.description}</div>
                      </div>
                      {loading && action.id === 'auto-generate' && (
                        <div className="action-loading">
                          <div className="spinner"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Статистика по действиям */}
      <div className="actions-stats">
        <div className="stat-item">
          <span className="stat-label">Последнее обновление:</span>
          <span className="stat-value">
            {new Date().toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Автогенерация:</span>
          <span className="stat-value">
            {stats.totalPayrolls > 0 ? 'Выполнена' : 'Не выполнена'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Активных шаблонов:</span>
          <span className="stat-value">
            {/* TODO: получать из пропсов */} — 
          </span>
        </div>
      </div>
    </div>
  );
};

export default PayrollQuickActions;