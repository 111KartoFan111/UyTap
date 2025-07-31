// frontend/src/pages/TechnicalStaff/Tasks/Tasks.jsx
import { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiPlus, FiGrid, FiList, FiUser, FiCheck, FiPlay, FiPause, FiX } from 'react-icons/fi';
import { useTranslation } from '../../../contexts/LanguageContext';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import Modal from '../../../components/Common/Modal';
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
  const [filterType, setFilterType] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [availableProperties, setAvailableProperties] = useState([]);
  const [completionData, setCompletionData] = useState({
    notes: '',
    rating: 5,
    duration: null
  });

  useEffect(() => {
    loadTasks();
    loadProperties();
  }, [showCompleted, searchTerm, filterPriority, filterType]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      
      // Параметры для загрузки задач
      const params = {};
      
      // Фильтр по приоритету
      if (filterPriority) {
        params.priority = filterPriority;
      }
      
      // Фильтр по типу
      if (filterType) {
        params.task_type = filterType;
      }
      
      // Получаем задачи
      let allTasks = [];
      
      if (user.role === 'technical_staff') {
        // Для технического персонала получаем только свои задачи
        allTasks = await tasks.getMy();
      } else {
        // Для других ролей получаем все задачи
        allTasks = await tasks.getAll(params);
      }
      
      // Фильтр по поиску
      if (searchTerm) {
        allTasks = allTasks.filter(task => 
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
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
        if (!showCompleted && ['completed', 'cancelled', 'failed'].includes(task.status)) {
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

  const loadProperties = async () => {
    try {
      const propertiesList = await properties.getAll();
      setAvailableProperties(propertiesList || []);
    } catch (error) {
      console.error('Error loading properties:', error);
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

  const openCompleteModal = (task) => {
    setSelectedTask(task);
    setCompletionData({
      notes: '',
      rating: 5,
      duration: null
    });
    setShowTaskModal(true);
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || !completionData.notes.trim()) {
      utils.showError('Заполните отчет о выполнении');
      return;
    }

    await handleTaskAction(selectedTask.id, 'complete', completionData);
    setShowTaskModal(false);
    setSelectedTask(null);
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

  const canStartTask = (task) => {
    return task.status === 'assigned' && (user.role !== 'technical_staff' || user.id === task.assigned_to);
  };

  const canCompleteTask = (task) => {
    return task.status === 'in_progress' && (user.role !== 'technical_staff' || user.id === task.assigned_to);
  };

  const renderTask = (task) => (
    <div key={task.id} className="task-card" onClick={() => openCompleteModal(task)}>
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
      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        {canStartTask(task) && (
          <button 
            className="btn-start"
            onClick={() => handleTaskAction(task.id, 'start')}
          >
            <FiPlay /> Начать
          </button>
        )}
        
        {canCompleteTask(task) && (
          <button 
            className="btn-complete"
            onClick={() => openCompleteModal(task)}
          >
            <FiCheck /> Завершить
          </button>
        )}
        
        {['pending', 'assigned', 'in_progress'].includes(task.status) && (
          <button 
            className="btn-cancel"
            onClick={() => handleTaskAction(task.id, 'cancel', { reason: 'Отменено пользователем' })}
          >
            <FiX /> Отмена
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

  const renderListView = () => (
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
              {canStartTask(task) && (
                <button 
                  className="btn-start-small"
                  onClick={() => handleTaskAction(task.id, 'start')}
                >
                  <FiPlay /> Начать
                </button>
              )}
              
              {canCompleteTask(task) && (
                <button 
                  className="btn-complete-small"
                  onClick={() => openCompleteModal(task)}
                >
                  <FiCheck /> Завершить
                </button>
              )}
            </div>
          </div>
        ))}
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
        <h1>Управление задачами</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Поиск задач..."
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
          
          <select 
            className="filter-btn"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Все типы</option>
            <option value="cleaning">Уборка</option>
            <option value="maintenance">Обслуживание</option>
            <option value="check_in">Заселение</option>
            <option value="check_out">Выселение</option>
            <option value="delivery">Доставка</option>
            <option value="laundry">Стирка</option>
          </select>
          
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Показать завершенные
          </label>
          
          <div className="view-toggle">
            <span>Вид:</span>
            <button 
              className={viewMode === 'board' ? 'active' : ''}
              onClick={() => setViewMode('board')}
            >
              <FiGrid /> Доска
            </button>
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              <FiList /> Список
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
        renderListView()
      )}

      {/* Модальное окно завершения задачи */}
      <Modal 
        isOpen={showTaskModal} 
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        title={`Завершение задачи: ${selectedTask?.title || ''}`}
        size="medium"
      >
        {selectedTask && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div><strong>Задача:</strong> {selectedTask.title}</div>
              <div><strong>Тип:</strong> {getTaskTypeLabel(selectedTask.task_type)}</div>
              <div><strong>Приоритет:</strong> {getPriorityLabel(selectedTask.priority)}</div>
              <div><strong>Объект:</strong> {selectedTask.property?.name || `Объект ${selectedTask.property_id}`}</div>
              {selectedTask.estimated_duration && (
                <div><strong>Планируемое время:</strong> {selectedTask.estimated_duration} мин</div>
              )}
            </div>
            
            <div>
              <label>Отчет о выполнении *</label>
              <textarea
                value={completionData.notes}
                onChange={(e) => setCompletionData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Опишите что было сделано, какие проблемы решены, использованные материалы..."
                rows={4}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <div>
              <label>Фактическое время выполнения (минуты)</label>
              <input
                type="number"
                value={completionData.duration || ''}
                onChange={(e) => setCompletionData(prev => ({ ...prev, duration: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Введите время в минутах"
                min="1"
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <div>
              <label>Оценка качества выполнения</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => setCompletionData(prev => ({ ...prev, rating }))}
                    style={{
                      padding: '8px 12px',
                      border: completionData.rating === rating ? '2px solid #3498db' : '1px solid #ddd',
                      background: completionData.rating === rating ? '#e8f4fd' : 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: completionData.rating === rating ? '600' : 'normal'
                    }}
                  >
                    {rating} ⭐
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                1 - Плохо, 2 - Удовлетворительно, 3 - Хорошо, 4 - Отлично, 5 - Превосходно
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                onClick={() => {
                  setShowTaskModal(false);
                  setSelectedTask(null);
                }}
                className="modal-btn modal-btn-secondary"
              >
                Отмена
              </button>
              <button 
                onClick={handleCompleteTask}
                className="modal-btn modal-btn-success"
                disabled={!completionData.notes.trim()}
              >
                <FiCheck /> Завершить задачу
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Tasks;