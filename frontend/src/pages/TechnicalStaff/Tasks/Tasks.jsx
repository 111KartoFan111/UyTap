// frontend/src/pages/TechnicalStaff/Tasks/Tasks.jsx
import { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiPlus, FiGrid, FiList, FiUser } from 'react-icons/fi';
import { useTranslation } from '../../../contexts/LanguageContext';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import './Tasks.css';

const Tasks = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tasks, properties, utils } = useData();
  
  const [tasksByStatus, setTasksByStatus] = useState({
    pending: [],
    assigned: [],
    in_progress: [],
    completed: [],
    cancelled: [],
    failed: []
  });
  
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState('board');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  useEffect(() => {
    loadTasks();
  }, [showCompleted, searchTerm, filterPriority]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      
      // Параметры для загрузки задач
      const params = {};
      
      // Если не показываем завершенные, исключаем их
      if (!showCompleted) {
        // Загружаем все статусы кроме completed
        params.status = null; // Получим все и отфильтруем локально
      }
      
      // Фильтр по приоритету
      if (filterPriority) {
        params.priority = filterPriority;
      }
      
      // Поиск
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      // Получаем задачи (для technical_staff - все назначенные задачи)
      let allTasks = [];
      
      if (user.role === 'technical_staff') {
        // Для технического персонала получаем только свои задачи
        allTasks = await tasks.getMy();
      } else {
        // Для других ролей получаем все задачи
        allTasks = await tasks.getAll(params);
      }
      
      // Обогащаем задачи информацией о свойствах
      const enrichedTasks = await Promise.all(
        allTasks.map(async (task) => {
          let property = null;
          if (task.property_id) {
            try {
              property = await properties.getById(task.property_id);
            } catch (error) {
              console.error('Error loading property for task:', task.id, error);
            }
          }
          
          return {
            ...task,
            property
          };
        })
      );
      
      // Группируем по статусам
      const grouped = {
        pending: [],
        assigned: [],
        in_progress: [],
        completed: [],
        cancelled: [],
        failed: []
      };
      
      enrichedTasks.forEach(task => {
        // Исключаем завершенные задачи если флаг не установлен
        if (!showCompleted && task.status === 'completed') {
          return;
        }
        
        if (grouped[task.status]) {
          grouped[task.status].push(task);
        }
      });
      
      setTasksByStatus(grouped);
    } catch (error) {
      console.error('Error loading tasks:', error);
      utils.showError('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAction = async (taskId, action, additionalData = {}) => {
    try {
      switch (action) {
        case 'start':
          await tasks.start(taskId);
          utils.showSuccess('Задача начата');
          break;
        case 'complete':
          await tasks.complete(taskId, {
            completion_notes: additionalData.notes || 'Задача выполнена',
            quality_rating: additionalData.rating || 5,
            actual_duration: additionalData.duration
          });
          utils.showSuccess('Задача завершена');
          break;
        case 'assign':
          await tasks.assign(taskId, additionalData.assignedTo);
          utils.showSuccess('Задача назначена');
          break;
        case 'cancel':
          await tasks.cancel(taskId, additionalData.reason || 'Отменено пользователем');
          utils.showSuccess('Задача отменена');
          break;
        default:
          break;
      }
      
      // Перезагружаем задачи после изменения
      await loadTasks();
    } catch (error) {
      console.error(`Error ${action} task:`, error);
      utils.showError(`Ошибка выполнения действия: ${action}`);
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'urgent': return '#e74c3c';
      case 'high': return '#f39c12';
      case 'medium': return '#3498db';
      case 'low': return '#95a5a6';
      default: return '#95a5a6';
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Ожидает',
      assigned: 'Назначено',
      in_progress: 'В работе',
      completed: 'Завершено',
      cancelled: 'Отменено',
      failed: 'Провалено'
    };
    return labels[status] || status;
  };

  const getTaskTypeLabel = (taskType) => {
    const labels = {
      cleaning: 'Уборка',
      maintenance: 'Обслуживание',
      check_in: 'Заселение',
      check_out: 'Выселение',
      delivery: 'Доставка',
      laundry: 'Стирка'
    };
    return labels[taskType] || taskType;
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий',
      urgent: 'Срочный'
    };
    return labels[priority] || priority;
  };

  const renderTask = (task) => (
    <div key={task.id} className="task-card">
      <div className="task-header">
        <h4>{task.title}</h4>
        <div 
          className="task-priority" 
          style={{ backgroundColor: getPriorityColor(task.priority) }}
          title={getPriorityLabel(task.priority)}
        />
      </div>
      
      <p className="task-room">
        {task.property ? `${task.property.name} (${task.property.number})` : `Объект ${task.property_id}`}
      </p>
      
      <div className="task-type">
        <small>{getTaskTypeLabel(task.task_type)}</small>
      </div>
      
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      
      <div className="task-assignee">
        {task.assignee ? (
          <>
            <img 
              src={`https://i.pravatar.cc/32?img=${task.id + 80}`} 
              alt={task.assignee.first_name} 
            />
            <span>{task.assignee.first_name} {task.assignee.last_name}</span>
          </>
        ) : (
          <span>Не назначено</span>
        )}
        
        {task.due_date && (
          <span className="due-date">
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
      
      {/* Действия для задач */}
      <div className="task-actions">
        {task.status === 'assigned' && user.id === task.assigned_to && (
          <button 
            className="btn-start"
            onClick={() => handleTaskAction(task.id, 'start')}
          >
            Начать
          </button>
        )}
        
        {task.status === 'in_progress' && user.id === task.assigned_to && (
          <button 
            className="btn-complete"
            onClick={() => handleTaskAction(task.id, 'complete')}
          >
            Завершить
          </button>
        )}
        
        {['pending', 'assigned', 'in_progress'].includes(task.status) && (
          <button 
            className="btn-cancel"
            onClick={() => handleTaskAction(task.id, 'cancel', { reason: 'Отменено пользователем' })}
          >
            Отменить
          </button>
        )}
      </div>
    </div>
  );

  const renderColumn = (status, tasks) => (
    <div key={status} className="task-column">
      <div className="column-header">
        <h3>
          {getStatusLabel(status)} 
          <span className="task-count">({tasks.length})</span>
        </h3>
      </div>
      <div className="task-list">
        {tasks.map(renderTask)}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="tasks">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка задач...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks">
      <div className="tasks-header">
        <h1>{t('tasks.title')}</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder={t('common.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="filter-btn"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">Все приоритеты</option>
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="urgent">Срочный</option>
          </select>
          
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            {t('tasks.showCompleted')}
          </label>
          
          <div className="view-toggle">
            <span>{t('common.view')}:</span>
            <button 
              className={viewMode === 'board' ? 'active' : ''}
              onClick={() => setViewMode('board')}
            >
              <FiGrid /> {t('tasks.board')}
            </button>
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              <FiList /> {t('tasks.list')}
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'board' ? (
        <div className="tasks-board">
          {Object.entries(tasksByStatus).map(([status, tasks]) => {
            // Скрываем завершенные колонки если флаг не установлен
            if (!showCompleted && ['completed', 'cancelled', 'failed'].includes(status)) {
              return null;
            }
            return renderColumn(status, tasks);
          })}
        </div>
      ) : (
        <div className="tasks-list-view">
          <div className="tasks-table">
            <div className="table-header">
              <div>Задача</div>
              <div>Тип</div>
              <div>Приоритет</div>
              <div>Статус</div>
              <div>Исполнитель</div>
              <div>Срок</div>
              <div>Действия</div>
            </div>
            
            {Object.values(tasksByStatus).flat().map(task => (
              <div key={task.id} className="table-row">
                <div className="task-info">
                  <strong>{task.title}</strong>
                  <small>{task.property?.name || `Объект ${task.property_id}`}</small>
                </div>
                <div>{getTaskTypeLabel(task.task_type)}</div>
                <div>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  >
                    {getPriorityLabel(task.priority)}
                  </span>
                </div>
                <div>
                  <span className={`status-badge status-${task.status}`}>
                    {getStatusLabel(task.status)}
                  </span>
                </div>
                <div>
                  {task.assignee ? 
                    `${task.assignee.first_name} ${task.assignee.last_name}` : 
                    'Не назначено'
                  }
                </div>
                <div>
                  {task.due_date ? 
                    new Date(task.due_date).toLocaleDateString() : 
                    '—'
                  }
                </div>
                <div className="table-actions">
                  {task.status === 'assigned' && user.id === task.assigned_to && (
                    <button 
                      className="btn-start-small"
                      onClick={() => handleTaskAction(task.id, 'start')}
                    >
                      Начать
                    </button>
                  )}
                  
                  {task.status === 'in_progress' && user.id === task.assigned_to && (
                    <button 
                      className="btn-complete-small"
                      onClick={() => handleTaskAction(task.id, 'complete')}
                    >
                      Завершить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;