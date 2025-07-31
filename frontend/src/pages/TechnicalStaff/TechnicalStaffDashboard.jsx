// frontend/src/pages/TechnicalStaff/TechnicalStaffDashboard.jsx
import { useState, useEffect } from 'react';
import { 
  FiTool, 
  FiAlertTriangle, 
  FiCheckCircle, 
  FiClock,
  FiSettings,
  FiZap,
  FiDroplet,
  FiWifi,
  FiThermometer,
  FiPlay,
  FiPause,
  FiCheck,
  FiUser,
  FiMapPin,
  FiPhone,
  FiPlus,
  FiList,
  FiFilter,
  FiBarChart2,
  FiCalendar,
  FiHome
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import Modal from '../../components/Common/Modal.jsx';
import './TechnicalStaffDashboard.css';

const TechnicalStaffDashboard = () => {
  const { user } = useAuth();
  const { tasks, properties, utils } = useData();
  
  const [myTasks, setMyTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [workTimer, setWorkTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completionData, setCompletionData] = useState({
    notes: '',
    rating: 5,
    used_materials: [],
    follow_up_needed: false
  });
  
  const [todayStats, setTodayStats] = useState({
    completedTasks: 0,
    activeRequests: 0,
    urgentIssues: 0,
    workingHours: 0,
    avgCompletionTime: 0
  });

  const [filters, setFilters] = useState({
    taskType: '',
    priority: '',
    property: ''
  });

  const [availableProperties, setAvailableProperties] = useState([]);

  useEffect(() => {
    loadMyTasks();
    loadStatistics();
    loadProperties();
  }, []);

  useEffect(() => {
    // Таймер для текущей работы
    let interval;
    if (isWorking && currentTask) {
      interval = setInterval(() => {
        setWorkTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWorking, currentTask]);

  useEffect(() => {
    // Автосохранение времени работы в localStorage
    if (currentTask && workTimer > 0) {
      localStorage.setItem(`task_${currentTask.id}_timer`, workTimer.toString());
      localStorage.setItem(`task_${currentTask.id}_start`, Date.now().toString());
    }
  }, [currentTask, workTimer]);

  const loadMyTasks = async () => {
    try {
      setLoading(true);
      const assignedTasks = await tasks.getMy();
      
      // Обогащаем задачи информацией о свойствах
      const enrichedTasks = await Promise.all(
        assignedTasks.map(async (task) => {
          let property = null;
          if (task.property_id) {
            try {
              property = await properties.getById(task.property_id);
            } catch (error) {
              console.error('Error loading property:', error);
            }
          }
          
          return {
            ...task,
            property,
            typeData: getTaskTypeData(task.task_type)
          };
        })
      );
      
      setMyTasks(enrichedTasks);
      
      // Найдем текущую активную задачу
      const activeTask = enrichedTasks.find(t => t.status === 'in_progress');
      if (activeTask) {
        setCurrentTask(activeTask);
        setIsWorking(true);
        
        // Восстанавливаем таймер из localStorage
        const savedTimer = localStorage.getItem(`task_${activeTask.id}_timer`);
        const savedStart = localStorage.getItem(`task_${activeTask.id}_start`);
        
        if (savedTimer && savedStart) {
          const elapsed = Math.floor((Date.now() - parseInt(savedStart)) / 1000);
          setWorkTimer(parseInt(savedTimer) + elapsed);
        } else if (activeTask.started_at) {
          const startTime = new Date(activeTask.started_at);
          const now = new Date();
          const diffInSeconds = Math.floor((now - startTime) / 1000);
          setWorkTimer(diffInSeconds);
        }
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      utils.showError('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await tasks.getStatistics(30, user.id);
      
      setTodayStats({
        completedTasks: stats.completed_tasks || 0,
        activeRequests: stats.active_tasks || 0,
        urgentIssues: stats.urgent_tasks || 0,
        workingHours: stats.total_hours || 0,
        avgCompletionTime: stats.avg_completion_time || 0
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadProperties = async () => {
    try {
      const propertiesList = await properties.getAll({ limit: 100 });
      setAvailableProperties(propertiesList || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const getTaskTypeData = (taskType) => {
    const types = {
      maintenance: { icon: FiTool, name: 'Общий ремонт', color: '#27ae60' },
      electrical: { icon: FiZap, name: 'Электрика', color: '#f39c12' },
      plumbing: { icon: FiDroplet, name: 'Сантехника', color: '#3498db' },
      hvac: { icon: FiThermometer, name: 'Отопление/Кондиционер', color: '#e74c3c' },
      internet: { icon: FiWifi, name: 'Интернет/ТВ', color: '#9b59b6' },
      cleaning: { icon: FiTool, name: 'Уборка', color: '#27ae60' },
      check_in: { icon: FiUser, name: 'Заселение', color: '#3498db' },
      check_out: { icon: FiUser, name: 'Выселение', color: '#e67e22' },
      delivery: { icon: FiTool, name: 'Доставка', color: '#9b59b6' },
      laundry: { icon: FiTool, name: 'Стирка', color: '#f39c12' }
    };
    return types[taskType] || types.maintenance;
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTask = async (task) => {
    try {
      if (currentTask) {
        utils.showWarning('Завершите текущую задачу перед началом новой');
        return;
      }

      await tasks.start(task.id);
      setCurrentTask(task);
      setIsWorking(true);
      setWorkTimer(0);
      
      // Сохраняем время старта
      localStorage.setItem(`task_${task.id}_start`, Date.now().toString());
      localStorage.setItem(`task_${task.id}_timer`, '0');
      
      setMyTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'in_progress' } : t
      ));
      
      utils.showSuccess('Задача начата');
    } catch (error) {
      console.error('Error starting task:', error);
      utils.showError('Ошибка начала задачи');
    }
  };

  const pauseTask = () => {
    setIsWorking(false);
    utils.showInfo('Задача приостановлена');
  };

  const resumeTask = () => {
    setIsWorking(true);
    utils.showInfo('Работа возобновлена');
  };

  const openCompleteModal = (task) => {
    setSelectedTask(task);
    setCompletionData({
      notes: '',
      rating: 5,
      used_materials: [],
      follow_up_needed: false
    });
    setShowTaskModal(true);
  };

  const completeTask = async () => {
    try {
      if (!selectedTask) return;

      await tasks.complete(selectedTask.id, {
        completion_notes: completionData.notes || 'Задача выполнена',
        actual_duration: selectedTask.id === currentTask?.id ? workTimer : undefined,
        quality_rating: completionData.rating
      });
      
      // Очищаем localStorage для задачи
      localStorage.removeItem(`task_${selectedTask.id}_timer`);
      localStorage.removeItem(`task_${selectedTask.id}_start`);
      
      // Обновляем статистику
      setTodayStats(prev => ({
        ...prev,
        completedTasks: prev.completedTasks + 1,
        activeRequests: Math.max(0, prev.activeRequests - 1),
        workingHours: prev.workingHours + (workTimer / 3600)
      }));
      
      // Убираем задачу из списка
      setMyTasks(prev => prev.filter(t => t.id !== selectedTask.id));
      
      if (selectedTask.id === currentTask?.id) {
        setCurrentTask(null);
        setIsWorking(false);
        setWorkTimer(0);
      }
      
      setShowTaskModal(false);
      setSelectedTask(null);
      
      utils.showSuccess('Задача успешно завершена');
    } catch (error) {
      console.error('Error completing task:', error);
      utils.showError('Ошибка завершения задачи');
    }
  };

  const cancelTask = async (taskId, reason = 'Отменено пользователем') => {
    try {
      await tasks.cancel(taskId, reason);
      
      // Очищаем localStorage
      localStorage.removeItem(`task_${taskId}_timer`);
      localStorage.removeItem(`task_${taskId}_start`);
      
      setMyTasks(prev => prev.filter(t => t.id !== taskId));
      
      if (taskId === currentTask?.id) {
        setCurrentTask(null);
        setIsWorking(false);
        setWorkTimer(0);
      }
      
      utils.showSuccess('Задача отменена');
    } catch (error) {
      console.error('Error canceling task:', error);
      utils.showError('Ошибка отмены задачи');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#e74c3c';
      case 'high': return '#f39c12';
      case 'medium': return '#3498db';
      case 'low': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'urgent': return 'Срочно';
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      default: return priority;
    }
  };

  const getTaskStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Ожидает';
      case 'assigned': return 'Назначено';
      case 'in_progress': return 'В работе';
      case 'completed': return 'Завершено';
      case 'cancelled': return 'Отменено';
      case 'failed': return 'Провалено';
      default: return status;
    }
  };

  // Фильтрация задач
  const filteredTasks = myTasks.filter(task => {
    if (filters.taskType && task.task_type !== filters.taskType) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.property && task.property_id !== filters.property) return false;
    return true;
  });

  // Группировка задач по статусам
  const tasksByStatus = {
    urgent: filteredTasks.filter(t => t.priority === 'urgent' && !['completed', 'cancelled'].includes(t.status)),
    assigned: filteredTasks.filter(t => t.status === 'assigned'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    pending: filteredTasks.filter(t => t.status === 'pending')
  };

  if (loading) {
    return (
      <div className="technical-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка задач...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="technical-dashboard">
      <div className="technical-header">
        <h1>Техническое обслуживание</h1>
        <div className="user-greeting">
          Привет, {user.first_name}! Готов решать проблемы!
        </div>
        
        {/* Фильтры */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={filters.taskType}
            onChange={(e) => setFilters(prev => ({ ...prev, taskType: e.target.value }))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">Все типы задач</option>
            <option value="maintenance">Общий ремонт</option>
            <option value="electrical">Электрика</option>
            <option value="plumbing">Сантехника</option>
            <option value="hvac">Отопление/Кондиционер</option>
            <option value="internet">Интернет/ТВ</option>
            <option value="cleaning">Уборка</option>
            <option value="check_in">Заселение</option>
            <option value="check_out">Выселение</option>
            <option value="delivery">Доставка</option>
            <option value="laundry">Стирка</option>
          </select>
          
          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">Все приоритеты</option>
            <option value="urgent">Срочно</option>
            <option value="high">Высокий</option>
            <option value="medium">Средний</option>
            <option value="low">Низкий</option>
          </select>
          
          <select
            value={filters.property}
            onChange={(e) => setFilters(prev => ({ ...prev, property: e.target.value }))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">Все объекты</option>
            {availableProperties.map(prop => (
              <option key={prop.id} value={prop.id}>
                {prop.name} ({prop.number})
              </option>
            ))}
          </select>
          
          <button
            onClick={() => setFilters({ taskType: '', priority: '', property: '' })}
            style={{ 
              padding: '8px 16px', 
              background: '#f8f9fa', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <FiFilter /> Сбросить
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="daily-stats">
        <div className="stat-card">
          <div className="stat-icon completed">
            <FiCheckCircle />
          </div>
          <div className="stat-content">
            <h3>Выполнено</h3>
            <div className="stat-number">{todayStats.completedTasks}</div>
            <div className="stat-label">заявок за месяц</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon active">
            <FiTool />
          </div>
          <div className="stat-content">
            <h3>Активные</h3>
            <div className="stat-number">{tasksByStatus.assigned.length + tasksByStatus.in_progress.length}</div>
            <div className="stat-label">заявки</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon urgent">
            <FiAlertTriangle />
          </div>
          <div className="stat-content">
            <h3>Срочные</h3>
            <div className="stat-number">{tasksByStatus.urgent.length}</div>
            <div className="stat-label">требуют внимания</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon hours">
            <FiClock />
          </div>
          <div className="stat-content">
            <h3>Время работы</h3>
            <div className="stat-number">{todayStats.workingHours.toFixed(1)}</div>
            <div className="stat-label">часов за месяц</div>
          </div>
        </div>
      </div>

      {/* Текущая задача */}
      {currentTask && (
        <div className="current-task">
          <div className="task-header">
            <h2>Текущая задача</h2>
            <div className="task-timer">
              <FiClock />
              {formatTime(workTimer)}
            </div>
          </div>
          
          <div className="task-content">
            <div className="task-info">
              <div className="task-type">
                <currentTask.typeData.icon style={{ color: currentTask.typeData.color }} />
                <span>{currentTask.typeData.name}</span>
                <div 
                  style={{ 
                    marginLeft: '12px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: getPriorityColor(currentTask.priority),
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  {getPriorityText(currentTask.priority)}
                </div>
              </div>
              <h3>{currentTask.title}</h3>
              <div className="task-details">
                <div className="task-room">
                  <FiHome />
                  {currentTask.property?.name || `Объект ${currentTask.property_id}`}
                  {currentTask.property?.number && ` (${currentTask.property.number})`}
                </div>
                <div className="task-client">
                  <FiUser />
                  Создал: {currentTask.created_by || 'Система'}
                </div>
                {currentTask.due_date && (
                  <div className="task-client">
                    <FiCalendar />
                    Срок: {new Date(currentTask.due_date).toLocaleDateString('ru-RU')}
                  </div>
                )}
              </div>
              {currentTask.description && (
                <div className="task-description">{currentTask.description}</div>
              )}
              {currentTask.estimated_duration && (
                <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
                  <FiClock /> Планируемое время: {currentTask.estimated_duration} мин
                </div>
              )}
            </div>
            
            <div className="task-controls">
              {isWorking ? (
                <button className="btn-pause" onClick={pauseTask}>
                  <FiPause /> Пауза
                </button>
              ) : (
                <button className="btn-resume" onClick={resumeTask}>
                  <FiPlay /> Продолжить
                </button>
              )}
              
              <button 
                className="btn-complete" 
                onClick={() => openCompleteModal(currentTask)}
              >
                <FiCheck /> Завершить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Срочные заявки */}
      {tasksByStatus.urgent.length > 0 && (
        <div className="urgent-requests">
          <h2>
            <FiAlertTriangle />
            Срочные заявки ({tasksByStatus.urgent.length})
          </h2>
          <div className="requests-grid">
            {tasksByStatus.urgent.map(task => (
              <div key={task.id} className="request-card urgent">
                <div className="request-header">
                  <div className="request-type">
                    <task.typeData.icon style={{ color: task.typeData.color }} />
                    <span>{task.typeData.name}</span>
                  </div>
                  <div className="priority urgent">СРОЧНО</div>
                </div>
                
                <h4>{task.title}</h4>
                <div className="request-details">
                  <div className="request-room">
                    <FiHome />
                    {task.property?.name || `Объект ${task.property_id}`}
                    {task.property?.number && ` (${task.property.number})`}
                  </div>
                  <div className="request-client">
                    <FiUser />
                    {task.created_by || 'Система'}
                  </div>
                </div>
                
                {task.description && (
                  <div className="request-description">{task.description}</div>
                )}
                
                <div className="request-meta">
                  <div className="request-time">
                    <FiClock />
                    ~{task.estimated_duration || 60} мин
                  </div>
                  <div className="request-created">
                    {new Date(task.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                
                <div className="request-actions">
                  {task.status === 'assigned' && (
                    <button 
                      className="btn-start urgent"
                      onClick={() => startTask(task)}
                      disabled={!!currentTask}
                      style={{ marginRight: '8px' }}
                    >
                      <FiPlay /> Взять в работу
                    </button>
                  )}
                  {task.status === 'in_progress' && (
                    <button 
                      className="btn-start urgent"
                      onClick={() => openCompleteModal(task)}
                      style={{ marginRight: '8px' }}
                    >
                      <FiCheck /> Завершить
                    </button>
                  )}
                  <button 
                    className="btn-start"
                    onClick={() => cancelTask(task.id)}
                    style={{ background: '#95a5a6' }}
                  >
                    Отменить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Все задачи */}
      <div className="requests-sections">
        <div className="requests-section">
          <h2>Мои задачи ({filteredTasks.length})</h2>
          
          {/* Новые задачи */}
          {tasksByStatus.pending.length > 0 && (
            <>
              <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#f39c12' }}>
                <FiList /> Новые задачи ({tasksByStatus.pending.length})
              </h3>
              <div className="requests-list">
                {tasksByStatus.pending.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    currentTask={currentTask}
                    onStart={startTask}
                    onComplete={openCompleteModal}
                    onCancel={cancelTask}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Назначенные задачи */}
          {tasksByStatus.assigned.length > 0 && (
            <>
              <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#3498db' }}>
                <FiUser /> Назначенные задачи ({tasksByStatus.assigned.length})
              </h3>
              <div className="requests-list">
                {tasksByStatus.assigned.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    currentTask={currentTask}
                    onStart={startTask}
                    onComplete={openCompleteModal}
                    onCancel={cancelTask}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Задачи в работе */}
          {tasksByStatus.in_progress.length > 0 && (
            <>
              <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#27ae60' }}>
                <FiTool /> В работе ({tasksByStatus.in_progress.length})
              </h3>
              <div className="requests-list">
                {tasksByStatus.in_progress.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    currentTask={currentTask}
                    onStart={startTask}
                    onComplete={openCompleteModal}
                    onCancel={cancelTask}
                  />
                ))}
              </div>
            </>
          )}
          
          {filteredTasks.length === 0 && (
            <div className="no-tasks">
              <FiCheckCircle size={48} />
              <h3>Все задачи выполнены!</h3>
              <p>Отличная работа! Новые задачи появятся здесь.</p>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно завершения задачи */}
      <Modal 
        isOpen={showTaskModal} 
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        title={`Завершение задачи: ${selectedTask?.title || ''}`}
      >
        {selectedTask && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div><strong>Задача:</strong> {selectedTask.title}</div>
              <div><strong>Тип:</strong> {selectedTask.typeData.name}</div>
              <div><strong>Объект:</strong> {selectedTask.property?.name || `Объект ${selectedTask.property_id}`}</div>
              {selectedTask.id === currentTask?.id && (
                <div><strong>Время выполнения:</strong> {formatTime(workTimer)}</div>
              )}
            </div>
            
            <div>
              <label>Отчет о выполнении *</label>
              <textarea
                value={completionData.notes}
                onChange={(e) => setCompletionData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Опишите что было сделано, какие проблемы решены..."
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
            
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={completionData.follow_up_needed}
                  onChange={(e) => setCompletionData(prev => ({ ...prev, follow_up_needed: e.target.checked }))}
                />
                Требуется дополнительное обслуживание
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                onClick={() => {
                  setShowTaskModal(false);
                  setSelectedTask(null);
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
                onClick={completeTask}
                className="btn-start"
                style={{ background: '#27ae60' }}
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

// Компонент карточки задачи
const TaskCard = ({ task, currentTask, onStart, onComplete, onCancel }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#e74c3c';
      case 'high': return '#f39c12';
      case 'medium': return '#3498db';
      case 'low': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'urgent': return 'Срочно';
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      default: return priority;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f39c12';
      case 'assigned': return '#3498db';
      case 'in_progress': return '#27ae60';
      case 'completed': return '#95a5a6';
      case 'cancelled': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Ожидает';
      case 'assigned': return 'Назначено';
      case 'in_progress': return 'В работе';
      case 'completed': return 'Завершено';
      case 'cancelled': return 'Отменено';
      default: return status;
    }
  };

  return (
    <div className="request-card">
      <div className="request-header">
        <div className="request-type">
          <task.typeData.icon style={{ color: task.typeData.color }} />
          <span>{task.typeData.name}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div 
            className="priority"
            style={{ 
              color: getPriorityColor(task.priority),
              background: getPriorityColor(task.priority) + '20',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            {getPriorityText(task.priority)}
          </div>
          <div 
            style={{ 
              color: getStatusColor(task.status),
              background: getStatusColor(task.status) + '20',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            {getStatusText(task.status)}
          </div>
        </div>
      </div>
      
      <h4>{task.title}</h4>
      <div className="request-details">
        <div className="request-room">
          <FiHome />
          {task.property?.name || `Объект ${task.property_id}`}
          {task.property?.number && ` (${task.property.number})`}
        </div>
        <div className="request-client">
          <FiUser />
          Создал: {task.created_by || 'Система'}
        </div>
      </div>
      
      {task.description && (
        <div className="request-description">{task.description}</div>
      )}
      
      <div className="request-meta">
        <div className="request-time">
          <FiClock />
          ~{task.estimated_duration || 60} мин
        </div>
        <div className="request-created">
          {new Date(task.created_at).toLocaleDateString('ru-RU')}
        </div>
      </div>
      
      {task.due_date && (
        <div style={{ 
          marginTop: '8px', 
          padding: '4px 8px', 
          background: '#fff3cd', 
          borderRadius: '4px',
          fontSize: '12px',
          color: '#856404'
        }}>
          <FiCalendar /> Срок: {new Date(task.due_date).toLocaleDateString('ru-RU')}
        </div>
      )}
      
      <div className="request-actions">
        {task.status === 'assigned' && (
          <button 
            className="btn-start"
            onClick={() => onStart(task)}
            disabled={!!currentTask}
            style={{ marginRight: '8px' }}
          >
            <FiPlay /> Начать
          </button>
        )}
        {task.status === 'in_progress' && (
          <button 
            className="btn-start"
            onClick={() => onComplete(task)}
            style={{ marginRight: '8px', background: '#27ae60' }}
          >
            <FiCheck /> Завершить
          </button>
        )}
        {['pending', 'assigned', 'in_progress'].includes(task.status) && (
          <button 
            className="btn-start"
            onClick={() => onCancel(task.id)}
            style={{ background: '#95a5a6' }}
          >
            Отменить
          </button>
        )}
      </div>
    </div>
  );
};

export default TechnicalStaffDashboard;