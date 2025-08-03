import { useState } from 'react';
import { FiX, FiSettings, FiEdit2, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';

const TemplateModal = ({ templates, employees, onClose, onUpdate }) => {
  const { payroll, utils } = useData();
  const [activeTab, setActiveTab] = useState('list');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    user_id: '',
    payroll_type: 'monthly_salary', // Исправлено: используем правильное значение из API
    base_rate: '',
    overtime_rate: '',
    overtime_multiplier: 1.5,
    tax_rate: 0.1,
    pension_rate: 0.1,
    effective_from: new Date().toISOString().split('T')[0],
    role: '',
    is_active: true
  });

  // Фильтруем сотрудников по выбранной роли
  const filteredEmployees = formData.role 
    ? employees.filter(emp => emp.role === formData.role)
    : employees;

  const handleRoleChange = (role) => {
    setFormData(prev => ({ 
      ...prev, 
      role,
      user_id: '' // Сбрасываем выбранного пользователя при смене роли
    }));
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    
    // Валидация
    if (!formData.name.trim()) {
      utils.showError('Введите название шаблона');
      return;
    }
    if (!formData.user_id) {
      utils.showError('Выберите сотрудника');
      return;
    }
    if (!formData.base_rate || parseFloat(formData.base_rate) <= 0) {
      utils.showError('Введите базовую ставку');
      return;
    }

    try {
      const templateData = {
        user_id: formData.user_id,
        name: formData.name.trim(),
        payroll_type: formData.payroll_type,
        base_rate: parseFloat(formData.base_rate),
        overtime_rate_multiplier: parseFloat(formData.overtime_multiplier),
        tax_rate: parseFloat(formData.tax_rate),
        social_rate: parseFloat(formData.pension_rate),
        // ИСПРАВЛЕНО: правильный формат даты ISO с временем
        effective_from: new Date(formData.effective_from + 'T00:00:00.000Z').toISOString(),
        description: `Шаблон для ${employees.find(emp => emp.id === formData.user_id)?.first_name || 'сотрудника'}`
      };

      await payroll.createTemplate(templateData);
      utils.showSuccess('Шаблон создан');
      onUpdate();
      setActiveTab('list');
      resetForm();
    } catch (error) {
      console.error('Failed to create template:', error);
      const errorMessage = error.message || 'Не удалось создать шаблон';
      utils.showError('Ошибка создания шаблона: ' + errorMessage);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) return;
    
    try {
      await payroll.deactivateTemplate(templateId);
      utils.showSuccess('Шаблон деактивирован');
      onUpdate();
    } catch (error) {
      console.error('Failed to delete template:', error);
      utils.showError('Не удалось удалить шаблон: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      user_id: '',
      payroll_type: 'monthly_salary', // Исправлено
      base_rate: '',
      overtime_rate: '',
      overtime_multiplier: 1.5,
      tax_rate: 0.1,
      pension_rate: 0.1,
      effective_from: new Date().toISOString().split('T')[0],
      role: '',
      is_active: true
    });
  };

  // ИСПРАВЛЕНО: используем правильные значения из API схемы
  const payrollTypes = [
    { value: 'monthly_salary', label: 'Ежемесячная зарплата' },
    { value: 'hourly', label: 'Почасовая' },
    { value: 'piece_work', label: 'Сдельная' }
  ];

  const roles = [
    { value: 'admin', label: 'Администратор' },
    { value: 'manager', label: 'Менеджер' },
    { value: 'technical_staff', label: 'Технический персонал' },
    { value: 'accountant', label: 'Бухгалтер' },
    { value: 'cleaner', label: 'Уборщик' },
    { value: 'storekeeper', label: 'Кладовщик' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content template-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiSettings /> Управление шаблонами зарплат
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="template-tabs">
          <button 
            className={`tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Список шаблонов
          </button>
          <button 
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Создать шаблон
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="templates-list">
            {templates.length > 0 ? (
              <table className="templates-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Базовая ставка</th>
                    <th>Сотрудник</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(template => (
                    <tr key={template.id}>
                      <td>
                        <div>
                          <div className="template-name">{template.name}</div>
                          {template.description && (
                            <div className="template-role">{template.description}</div>
                          )}
                        </div>
                      </td>
                      <td>{template.payroll_type}</td>
                      <td>₸ {template.base_rate?.toLocaleString()}</td>
                      <td>
                        {template.user_id ? (
                          <div className="template-user">
                            {employees.find(emp => emp.id === template.user_id)?.first_name || 'Не найден'} {' '}
                            {employees.find(emp => emp.id === template.user_id)?.last_name || ''}
                          </div>
                        ) : (
                          <span className="text-muted">Общий</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${template.is_active ? 'active' : 'inactive'}`}>
                          {template.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>
                      <td>
                        <div className="template-actions">
                          <button 
                            className="btn-icon edit"
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <FiEdit2 />
                          </button>
                          <button 
                            className="btn-icon delete"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-templates">
                <p>Нет созданных шаблонов</p>
                <button 
                  className="btn-primary"
                  onClick={() => setActiveTab('create')}
                >
                  Создать первый шаблон
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <form className="template-form" onSubmit={handleCreateTemplate}>
            <div className="form-grid">
              <div className="form-field">
                <label>Название шаблона *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Администратор - базовый"
                  required
                />
              </div>

              <div className="form-field">
                <label>Тип зарплаты *</label>
                <select
                  value={formData.payroll_type}
                  onChange={(e) => setFormData({ ...formData, payroll_type: e.target.value })}
                  required
                >
                  {payrollTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Роль (для фильтрации сотрудников)</label>
                <select
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                >
                  <option value="">Все роли</option>
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Сотрудник *</label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  required
                >
                  <option value="">
                    {filteredEmployees.length === 0 
                      ? 'Нет доступных сотрудников' 
                      : 'Выберите сотрудника'}
                  </option>
                  {filteredEmployees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} - {employee.role}
                    </option>
                  ))}
                </select>
                {filteredEmployees.length === 0 && employees.length > 0 && (
                  <small className="text-warning">
                    Нет сотрудников с выбранной ролью. Выберите "Все роли" чтобы увидеть всех сотрудников.
                  </small>
                )}
              </div>

              <div className="form-field">
                <label>Базовая ставка *</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.base_rate}
                  onChange={(e) => setFormData({ ...formData, base_rate: e.target.value })}
                  placeholder="150000"
                  required
                />
              </div>

              <div className="form-field">
                <label>Коэффициент сверхурочных</label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  step="0.1"
                  value={formData.overtime_multiplier}
                  onChange={(e) => setFormData({ ...formData, overtime_multiplier: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Ставка ИПН (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={formData.tax_rate * 100}
                  onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value / 100 })}
                />
              </div>

              <div className="form-field">
                <label>Ставка пенсионных взносов (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={formData.pension_rate * 100}
                  onChange={(e) => setFormData({ ...formData, pension_rate: e.target.value / 100 })}
                />
              </div>

              <div className="form-field">
                <label>Дата вступления в силу *</label>
                <input
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  required
                />
              </div>
            </div>

            {employees.length === 0 && (
              <div className="warning-message">
                <FiAlertCircle />
                <span>
                  Нет активных сотрудников для создания шаблона. 
                  Сначала добавьте сотрудников в систему.
                </span>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => setActiveTab('list')}>
                Отмена
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={employees.length === 0}
              >
                Создать шаблон
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TemplateModal;