import { useState, useEffect } from 'react';
import { FiX, FiTool, FiUser, FiCalendar, FiAlertCircle } from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';
import { organizationAPI } from '../../../services/api';
import './TaskModal.css';

const TaskModal = ({ property, onClose, onSubmit }) => {
  const { utils } = useData();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'cleaning',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
    estimated_duration: 60, // в минутах
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Загрузка сотрудников при открытии модального окна
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      
      // Получаем сотрудников подходящих для выполнения задач
      const employeesData = await organizationAPI.getUsers({
        role: ['cleaner', 'technical_staff', 'manager'],
        status: 'active'
      });
      
      setEmployees(employeesData);
    } catch (error) {
      console.error('Failed to load employees:', error);
      utils.showError('Не удалось загрузить список сотрудников');
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const taskTypes = [
    { value: 'cleaning', label: 'Уборка', icon: '🧹' },
    { value: 'maintenance', label: 'Техническое обслуживание', icon: '🔧' },
    { value: 'repair', label: 'Ремонт', icon: '🛠️' },
    { value: 'inspection', label: 'Инспекция', icon: '🔍' },
    { value: 'decoration', label: 'Декор', icon: '🎨' },
    { value: 'other', label: 'Другое', icon: '📋' }
  ];

  const priorities = [
    { value: 'low', label: 'Низкий', color: '#27ae60' },
    { value: 'medium', label: 'Средний', color: '#f39c12' },
    { value: 'high', label: 'Высокий', color: '#e74c3c' },
    { value: 'urgent', label: 'Срочно', color: '#8e44ad' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Название задачи обязательно';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Описание обязательно';
    }
    if (!formData.due_date) {
      newErrors.due_date = 'Выберите срок выполнения';
    } else {
      const dueDate = new Date(formData.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        newErrors.due_date = 'Дата не может быть в прошлом';
      }
    }
    if (formData.estimated_duration < 15) {
      newErrors.estimated_duration = 'Минимальная продолжительность 15 минут';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const taskData = {
        ...formData,
        property_id: property.id,
        estimated_duration: parseInt(formData.estimated_duration),
        assigned_to: formData.assigned_to || null
      };
      onSubmit(taskData);
    }
  };

  const getTaskTypeIcon = (type) => {
    const taskType = taskTypes.find(t => t.value === type);
    return taskType ? taskType.icon : '📋';
  };

  const getPriorityColor = (priority) => {
    const priorityObj = priorities.find(p => p.value === priority);
    return priorityObj ? priorityObj.color : '#666';
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      cleaner: 'Уборщик',
      technical_staff: 'Технический специалист',
      manager: 'Менеджер',
      admin: 'Администратор'
    };
    return roleNames[role] || role;
  };

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal-content" onClick={e => e.stopPropagation()}>
        <div className="task-modal-header">
          <h2>
            <FiTool /> Создать задачу для {property?.number}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          {/* Основная информация */}
          <div className="form-section">
            <h3>Основная информация</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Название задачи *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Название задачи"
                  className={errors.title ? 'error' : ''}
                />
                {errors.title && <span className="error-text">{errors.title}</span>}
              </div>

              <div className="form-field">
                <label>Тип задачи *</label>
                <select
                  value={formData.task_type}
                  onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                  className={errors.task_type ? 'error' : ''}
                >
                  {taskTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
                {errors.task_type && <span className="error-text">{errors.task_type}</span>}
              </div>

              <div className="form-field">
                <label>Приоритет</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  style={{ borderLeftColor: getPriorityColor(formData.priority) }}
                >
                  {priorities.map(priority => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Ответственный</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  disabled={loadingEmployees}
                >
                  <option value="">Не назначен</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({getRoleDisplayName(emp.role)})
                    </option>
                  ))}
                </select>
                {loadingEmployees && <small>Загрузка сотрудников...</small>}
                {!loadingEmployees && employees.length === 0 && (
                  <small className="warning-text">Нет доступных сотрудников</small>
                )}
              </div>
            </div>

            <div className="form-field">
              <label>Описание *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Подробное описание задачи..."
                rows="3"
                className={errors.description ? 'error' : ''}
              />
              {errors.description && <span className="error-text">{errors.description}</span>}
            </div>
          </div>

          {/* Временные параметры */}
          <div className="form-section">
            <h3>
              <FiCalendar /> Временные параметры
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Срок выполнения *</label>
                <input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className={errors.due_date ? 'error' : ''}
                />
                {errors.due_date && <span className="error-text">{errors.due_date}</span>}
              </div>

              <div className="form-field">
                <label>Предполагаемая продолжительность (мин)</label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={formData.estimated_duration}
                  onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                  className={errors.estimated_duration ? 'error' : ''}
                />
                {errors.estimated_duration && <span className="error-text">{errors.estimated_duration}</span>}
                <small>Минимум 15 минут</small>
              </div>
            </div>
          </div>

          {/* Дополнительные примечания */}
          <div className="form-section">
            <div className="form-field">
              <label>Дополнительные примечания</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Дополнительная информация, инструкции..."
                rows="2"
              />
            </div>
          </div>

          {/* Предупреждение для занятых помещений */}
          {property?.status === 'occupied' && (
            <div className="warning-banner">
              <FiAlertCircle />
              <span>
                Помещение сейчас занято. Задача будет назначена, но выполнение 
                может потребовать координации с арендатором.
              </span>
            </div>
          )}

          {/* Кнопки */}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-submit">
              <FiTool />
              Создать задачу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;