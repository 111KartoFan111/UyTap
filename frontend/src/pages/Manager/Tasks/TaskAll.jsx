import { useState, useEffect } from 'react';
import { 
  FiArrowLeft, 
  FiFilter, 
  FiSearch, 
  FiCalendar, 
  FiUser, 
  FiClock, 
  FiCheckCircle, 
  FiXCircle, 
  FiAlertCircle,
  FiEdit,
  FiTrash2,
  FiPlay,
  FiPause,
  FiUserCheck,
  FiDollarSign,
  FiMapPin,
  FiRefreshCw,
  FiEye,
  FiMoreVertical
} from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import './TaskHistory.css';

const TaskHistory = () => {
  const { tasks: tasksAPI, utils, organization } = useData();
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    taskType: 'all',
    assignedTo: 'all',
    dateRange: 'all'
  });
  const [users, setUsers] = useState([]);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tasks, searchTerm, filters, sortBy, sortOrder]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.getAll();
      setTasks(response);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
      utils.showError('Ошибка загрузки задач: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await organization.getUsers();
      setUsers(response);
    } catch (err) {
      console.warn('Could not fetch users:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];

    // Поиск
    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.property?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assignee?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assignee?.last_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтры
    if (filters.status !== 'all') {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }

    if (filters.taskType !== 'all') {
      filtered = filtered.filter(task => task.task_type === filters.taskType);
    }

    if (filters.assignedTo !== 'all') {
      filtered = filtered.filter(task => task.assigned_to === filters.assignedTo);
    }

    if (filters.dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(task => new Date(task.created_at) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(task => new Date(task.created_at) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(task => new Date(task.created_at) >= filterDate);
          break;
      }
    }

    // Сортировка
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'assignee') {
        aValue = a.assignee ? `${a.assignee.first_name} ${a.assignee.last_name}` : '';
        bValue = b.assignee ? `${b.assignee.first_name} ${b.assignee.last_name}` : '';
      }

      if (sortBy === 'property') {
        aValue = a.property?.name || '';
        bValue = b.property?.name || '';
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredTasks(filtered);
  };

  const handleTaskAction = async (taskId, action, data = {}) => {
    try {
      setActionLoading(prev => ({ ...prev, [taskId]: action }));
      
      let result;
      switch (action) {
        case 'start':
          result = await tasksAPI.start(taskId);
          utils.showSuccess('Задача начата');
          break;
        case 'complete':
          result = await tasksAPI.complete(taskId, data);
          utils.showSuccess('Задача завершена');
          break;
        case 'assign':
          result = await tasksAPI.assign(taskId, data.assignedTo);
          utils.showSuccess('Задача назначена');
          break;
        case 'cancel':
          result = await tasksAPI.cancel(taskId, data.reason || 'Отменено администратором');
          utils.showSuccess('Задача отменена');
          break;
        case 'update':
          result = await tasksAPI.update(taskId, data);
          utils.showSuccess('Задача обновлена');
          break;
        default:
          throw new Error('Unknown action');
      }

      // Обновляем задачу в списке
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...result } : task
      ));

    } catch (error) {
      console.error(`Task action ${action} failed:`, error);
      utils.showError(`Ошибка ${action}: ${error.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [taskId]: null }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <FiCheckCircle className="status-icon completed" />;
      case 'cancelled': return <FiXCircle className="status-icon cancelled" />;
      case 'in_progress': return <FiPlay className="status-icon in-progress" />;
      case 'pending': return <FiClock className="status-icon pending" />;
      default: return <FiAlertCircle className="status-icon" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#dc2626';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'Не указано';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTaskTypeLabel = (type) => {
    const types = {
      'cleaning': 'Уборка',
      'maintenance': 'Обслуживание',
      'repair': 'Ремонт',
      'inspection': 'Проверка',
      'other': 'Другое'
    };
    return types[type] || type;
  };

  const getStatusLabel = (status) => {
    const statuses = {
      'pending': 'Ожидает',
      'in_progress': 'В работе',
      'completed': 'Завершена',
      'cancelled': 'Отменена'
    };
    return statuses[status] || status;
  };

  const getPriorityLabel = (priority) => {
    const priorities = {
      'low': 'Низкий',
      'medium': 'Средний',
      'high': 'Высокий'
    };
    return priorities[priority] || priority;
  };

  const canManageTask = (task) => {
    return user?.role === 'admin' || 
           user?.role === 'manager' || 
           task.assigned_to === user?.id ||
           task.created_by === user?.id;
  };

  const getTaskStats = () => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const pending = filteredTasks.filter(t => t.status === 'pending').length;
    const cancelled = filteredTasks.filter(t => t.status === 'cancelled').length;

    return { total, completed, inProgress, pending, cancelled };
  };

  const stats = getTaskStats();

  if (loading) {
    return (
      <div className="task-history loading-state">
        <div className="loading-spinner"></div>
        <p>Загрузка задач...</p>
      </div>
    );
  }

  return (
    <div className="task-history">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <a href={user.role === 'admin' ? '/admin/tasks' : '/manager/tasks'} className="back-btn">
            <FiArrowLeft />
            Назад
          </a>
          <div>
            <h1>История задач</h1>
            <p className="subtitle">Управление всеми задачами организации</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-outline"
            onClick={fetchTasks}
            disabled={loading}
          >
            <FiRefreshCw className={loading ? 'spinning' : ''} />
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Stats */}
      <div className="task-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <FiUser />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Всего задач</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon completed">
            <FiCheckCircle />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.completed}</div>
            <div className="stat-label">Завершено</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon in-progress">
            <FiPlay />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.inProgress}</div>
            <div className="stat-label">В работе</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon pending">
            <FiClock />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.pending}</div>
            <div className="stat-label">Ожидают</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Поиск по названию, описанию, исполнителю..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-row">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="in_progress">В работе</option>
            <option value="completed">Завершена</option>
            <option value="cancelled">Отменена</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
          >
            <option value="all">Все приоритеты</option>
            <option value="high">Высокий</option>
            <option value="medium">Средний</option>
            <option value="low">Низкий</option>
          </select>

          <select
            value={filters.taskType}
            onChange={(e) => setFilters(prev => ({ ...prev, taskType: e.target.value }))}
          >
            <option value="all">Все типы</option>
            <option value="cleaning">Уборка</option>
            <option value="maintenance">Обслуживание</option>
            <option value="repair">Ремонт</option>
            <option value="inspection">Проверка</option>
            <option value="other">Другое</option>
          </select>

          <select
            value={filters.assignedTo}
            onChange={(e) => setFilters(prev => ({ ...prev, assignedTo: e.target.value }))}
          >
            <option value="all">Все исполнители</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>

          <select
            value={filters.dateRange}
            onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
          >
            <option value="all">Весь период</option>
            <option value="today">Сегодня</option>
            <option value="week">Последняя неделя</option>
            <option value="month">Последний месяц</option>
          </select>
        </div>

        <div className="sort-controls">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_at">По дате создания</option>
            <option value="due_date">По дедлайну</option>
            <option value="priority">По приоритету</option>
            <option value="status">По статусу</option>
            <option value="title">По названию</option>
            <option value="assignee">По исполнителю</option>
          </select>
          <button
            className="sort-order-btn"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="tasks-container">
        {filteredTasks.length === 0 ? (
          <div className="no-tasks">
            <FiUser size={48} />
            <h3>Задачи не найдены</h3>
            <p>Попробуйте изменить фильтры или параметры поиска</p>
          </div>
        ) : (
          <div className="tasks-grid">
            {filteredTasks.map((task) => (
              <div key={task.id} className={`task-card ${task.status}`}>
                <div className="task-header">
                  <div className="task-title-section">
                    {getStatusIcon(task.status)}
                    <div>
                      <h3 className="task-title">{task.title}</h3>
                      <span className="task-type">{getTaskTypeLabel(task.task_type)}</span>
                    </div>
                  </div>
                  <div className="task-prioritys" style={{ color: getPriorityColor(task.priority) }}>
                    {getPriorityLabel(task.priority)}
                  </div>
                </div>

                <div className="task-description">
                  {task.description}
                </div>

                <div className="task-details">
                  <div className="detail-row">
                    <FiMapPin />
                    <span>{task.property?.name} ({task.property?.address})</span>
                  </div>

                  {task.assignee && (
                    <div className="detail-row">
                      <FiUser />
                      <span>{task.assignee.first_name} {task.assignee.last_name}</span>
                      <span className="role-badge">{task.assignee.role}</span>
                    </div>
                  )}

                  <div className="detail-row">
                    <FiCalendar />
                    <span>Создано: {formatDate(task.created_at)}</span>
                  </div>

                  {task.due_date && (
                    <div className="detail-row">
                      <FiClock />
                      <span>Дедлайн: {formatDate(task.due_date)}</span>
                    </div>
                  )}

                  {task.estimated_duration && (
                    <div className="detail-row">
                      <FiClock />
                      <span>Планируемое время: {formatDuration(task.estimated_duration)}</span>
                    </div>
                  )}

                  {task.actual_duration && (
                    <div className="detail-row">
                      <FiClock />
                      <span>Фактическое время: {formatDuration(task.actual_duration)}</span>
                    </div>
                  )}

                  {task.payment_amount > 0 && (
                    <div className="detail-row">
                      <FiDollarSign />
                      <span>Оплата: ₸{task.payment_amount}</span>
                      {task.is_paid && <span className="paid-badge">Оплачено</span>}
                    </div>
                  )}

                  {task.completed_at && (
                    <div className="detail-row">
                      <FiCheckCircle />
                      <span>Завершено: {formatDate(task.completed_at)}</span>
                    </div>
                  )}

                  {task.completion_notes && (
                    <div className="completion-notes">
                      <strong>Примечания:</strong> {task.completion_notes}
                    </div>
                  )}

                  {task.quality_rating && (
                    <div className="detail-row">
                      <span>Оценка качества: {task.quality_rating}/5</span>
                    </div>
                  )}
                </div>

                {canManageTask(task) && (
                  <div className="task-actions">
                    {task.status === 'pending' && (
                      <>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleTaskAction(task.id, 'start')}
                          disabled={actionLoading[task.id]}
                        >
                          <FiPlay />
                          {actionLoading[task.id] === 'start' ? 'Запуск...' : 'Начать'}
                        </button>
                        {!task.assigned_to && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              const userId = prompt('ID пользователя для назначения:');
                              if (userId) {
                                handleTaskAction(task.id, 'assign', { assignedTo: userId });
                              }
                            }}
                            disabled={actionLoading[task.id]}
                          >
                            <FiUserCheck />
                            Назначить
                          </button>
                        )}
                      </>
                    )}

                    {task.status === 'in_progress' && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => {
                          const notes = prompt('Примечания к завершению (необязательно):');
                          const rating = prompt('Оценка качества (1-5, необязательно):');
                          handleTaskAction(task.id, 'complete', { 
                            completion_notes: notes,
                            quality_rating: rating ? parseInt(rating) : null
                          });
                        }}
                        disabled={actionLoading[task.id]}
                      >
                        <FiCheckCircle />
                        {actionLoading[task.id] === 'complete' ? 'Завершение...' : 'Завершить'}
                      </button>
                    )}

                    {(task.status === 'pending' || task.status === 'in_progress') && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          const reason = prompt('Причина отмены:');
                          if (reason) {
                            handleTaskAction(task.id, 'cancel', { reason });
                          }
                        }}
                        disabled={actionLoading[task.id]}
                      >
                        <FiXCircle />
                        {actionLoading[task.id] === 'cancel' ? 'Отмена...' : 'Отменить'}
                      </button>
                    )}

                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setSelectedTask(task);
                        setShowDetails(true);
                      }}
                    >
                      <FiEye />
                      Детали
                    </button>
                  </div>
                )}

                <div className="task-meta">
                  <span className={`status-badge ${task.status}`}>
                    {getStatusLabel(task.status)}
                  </span>
                  <span className="created-by">
                    Создал: {task.creator ? `${task.creator.first_name} ${task.creator.last_name}` : 'Система'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      {showDetails && selectedTask && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Детали задачи</h2>
              <button className="close-btn" onClick={() => setShowDetails(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="task-detail-grid">
                <div className="detail-group">
                  <label>Название:</label>
                  <span>{selectedTask.title}</span>
                </div>
                <div className="detail-group">
                  <label>Описание:</label>
                  <span>{selectedTask.description}</span>
                </div>
                <div className="detail-group">
                  <label>Тип:</label>
                  <span>{getTaskTypeLabel(selectedTask.task_type)}</span>
                </div>
                <div className="detail-group">
                  <label>Приоритет:</label>
                  <span style={{ color: getPriorityColor(selectedTask.priority) }}>
                    {getPriorityLabel(selectedTask.priority)}
                  </span>
                </div>
                <div className="detail-group">
                  <label>Статус:</label>
                  <span className={`status-badge ${selectedTask.status}`}>
                    {getStatusLabel(selectedTask.status)}
                  </span>
                </div>
                <div className="detail-group">
                  <label>Помещение:</label>
                  <span>{selectedTask.property?.name} ({selectedTask.property?.address})</span>
                </div>
                {selectedTask.assignee && (
                  <div className="detail-group">
                    <label>Исполнитель:</label>
                    <span>{selectedTask.assignee.first_name} {selectedTask.assignee.last_name}</span>
                  </div>
                )}
                <div className="detail-group">
                  <label>Создано:</label>
                  <span>{formatDate(selectedTask.created_at)}</span>
                </div>
                {selectedTask.due_date && (
                  <div className="detail-group">
                    <label>Дедлайн:</label>
                    <span>{formatDate(selectedTask.due_date)}</span>
                  </div>
                )}
                {selectedTask.estimated_duration && (
                  <div className="detail-group">
                    <label>Планируемое время:</label>
                    <span>{formatDuration(selectedTask.estimated_duration)}</span>
                  </div>
                )}
                {selectedTask.actual_duration && (
                  <div className="detail-group">
                    <label>Фактическое время:</label>
                    <span>{formatDuration(selectedTask.actual_duration)}</span>
                  </div>
                )}
                {selectedTask.payment_amount > 0 && (
                  <div className="detail-group">
                    <label>Сумма оплаты:</label>
                    <span>₸{selectedTask.payment_amount} {selectedTask.is_paid ? '(Оплачено)' : '(Не оплачено)'}</span>
                  </div>
                )}
                {selectedTask.completion_notes && (
                  <div className="detail-group full-width">
                    <label>Примечания к завершению:</label>
                    <span>{selectedTask.completion_notes}</span>
                  </div>
                )}
                {selectedTask.quality_rating && (
                  <div className="detail-group">
                    <label>Оценка качества:</label>
                    <span>{selectedTask.quality_rating}/5</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskHistory;