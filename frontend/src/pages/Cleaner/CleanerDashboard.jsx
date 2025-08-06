// frontend/src/pages/Cleaner/CleanerDashboard.jsx
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
  FiPhone
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import '../TechnicalStaff/TechnicalStaffDashboard.css'; // Используем те же стили

const CleanerDashboard = () => {
  const { user } = useAuth();
  const { tasks, properties, utils } = useData();
  
  const [myTasks, setMyTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [workTimer, setWorkTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [todayStats, setTodayStats] = useState({
    completedTasks: 0,
    activeRequests: 0,
    urgentIssues: 0,
    workingHours: 0,
    avgCompletionTime: 0
  });

  useEffect(() => {
    loadMyTasks();
    loadStatistics();
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
  const loadMyTasks = async () => {
    try {
      setLoading(true);
      // Получаем назначенные мне задачи (для cleaner - в основном уборка)
      const assignedTasks = await tasks.getMy();
      
      // Фильтруем задачи для уборщика (cleaning, laundry, check_in, check_out)
      const cleaningTasks = assignedTasks.filter(task => 
        ['cleaning', 'laundry', 'delivery','check_in', 'check_out'].includes(task.task_type)
      );
      
      // Обогащаем задачи информацией о свойствах
      const enrichedTasks = await Promise.all(
        cleaningTasks.map(async (task) => {
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
      
      // Найдем текущую активную задачу, если есть
      const activeTask = enrichedTasks.find(t => t.status === 'in_progress');
      if (activeTask) {
        setCurrentTask(activeTask);
        setIsWorking(true);
        // Рассчитаем время работы, если задача была начата
        if (activeTask.started_at) {
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
      // Получаем статистику за последние 30 дней для текущего пользователя
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
      // Не показываем ошибку пользователю для статистики
    }
  };

  const getTaskTypeData = (taskType) => {
    const types = {
      cleaning: { icon: FiTool, name: 'Уборка помещения', color: '#27ae60' },
      laundry: { icon: FiSettings, name: 'Стирка и белье', color: '#3498db' },
      check_in: { icon: FiUser, name: 'Подготовка к заселению', color: '#2ecc71' },
      check_out: { icon: FiUser, name: 'Уборка после выселения', color: '#e67e22' },
      maintenance: { icon: FiTool, name: 'Техническое обслуживание', color: '#27ae60' },
      electrical: { icon: FiZap, name: 'Электрика', color: '#f39c12' },
      plumbing: { icon: FiDroplet, name: 'Сантехника', color: '#3498db' },
      hvac: { icon: FiThermometer, name: 'Отопление/Кондиционер', color: '#e74c3c' },
      internet: { icon: FiWifi, name: 'Интернет/ТВ', color: '#9b59b6' },
      delivery: { icon: FiTool, name: 'Доставка', color: '#9b59b6' }
    };
    return types[taskType] || types.cleaning;
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
      
      // Обновляем локальный статус
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

  const completeTask = async (taskId, resolution = 'Уборка завершена') => {
    try {
      await tasks.complete(taskId, {
        completion_notes: resolution,
        actual_duration: workTimer,
        quality_rating: 5 // По умолчанию высокое качество
      });
      
      // Обновляем статистику
      setTodayStats(prev => ({
        ...prev,
        completedTasks: prev.completedTasks + 1,
        activeRequests: Math.max(0, prev.activeRequests - 1),
        workingHours: prev.workingHours + (workTimer / 3600)
      }));
      
      // Убираем задачу из списка
      setMyTasks(prev => prev.filter(t => t.id !== taskId));
      
      setCurrentTask(null);
      setIsWorking(false);
      setWorkTimer(0);
      
      utils.showSuccess('Задача успешно завершена');
    } catch (error) {
      console.error('Error completing task:', error);
      utils.showError('Ошибка завершения задачи');
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

  // Фильтруем задачи по статусам
  const newTasks = myTasks.filter(t => t.status === 'pending');
  const assignedTasks = myTasks.filter(t => t.status === 'assigned');
  const inProgressTasks = myTasks.filter(t => t.status === 'in_progress');
  const urgentTasks = myTasks.filter(t => t.priority === 'urgent' && !['completed', 'cancelled'].includes(t.status));

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
        <h1>Служба уборки</h1>
        <div className="user-greeting">
          Привет, {user.first_name}! Готов к работе!
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
            <div className="stat-label">уборок за месяц</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon active">
            <FiTool />
          </div>
          <div className="stat-content">
            <h3>Активные</h3>
            <div className="stat-number">{assignedTasks.length + inProgressTasks.length}</div>
            <div className="stat-label">задачи</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon urgent">
            <FiAlertTriangle />
          </div>
          <div className="stat-content">
            <h3>Срочные</h3>
            <div className="stat-number">{urgentTasks.length}</div>
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
              </div>
              <h3>{currentTask.title}</h3>
              <div className="task-details">
                <div className="task-room">
                  <FiMapPin />
                  {currentTask.property?.name || `Объект ${currentTask.property_id}`}
                </div>
                <div className="task-client">
                  <FiUser />
                  Создал: {currentTask.created_by || 'Система'}
                </div>
              </div>
              {currentTask.description && (
                <div className="task-description">{currentTask.description}</div>
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
                onClick={() => completeTask(currentTask.id)}
              >
                <FiCheck /> Завершить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Срочные задачи */}
      {urgentTasks.length > 0 && (
        <div className="urgent-requests">
          <h2>
            <FiAlertTriangle />
            Срочные задачи ({urgentTasks.length})
          </h2>
          <div className="requests-grid">
            {urgentTasks.map(task => (
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
                    <FiMapPin />
                    {task.property?.name || `Объект ${task.property_id}`}
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
                  <button 
                    className="btn-start urgent"
                    onClick={() => startTask(task)}
                    disabled={!!currentTask}
                  >
                    <FiPlay /> Взять в работу
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
          <h2>Мои задачи ({assignedTasks.length + newTasks.length})</h2>
          <div className="requests-list">
            {[...newTasks, ...assignedTasks].map(task => (
              <div key={task.id} className="request-card">
                <div className="request-header">
                  <div className="request-type">
                    <task.typeData.icon style={{ color: task.typeData.color }} />
                    <span>{task.typeData.name}</span>
                  </div>
                  <div 
                    className="priority"
                    style={{ color: getPriorityColor(task.priority) }}
                  >
                    {getPriorityText(task.priority)}
                  </div>
                </div>
                
                <h4>{task.title}</h4>
                <div className="request-details">
                  <div className="request-room">
                    <FiMapPin />
                    {task.property?.name || `Объект ${task.property_id}`}
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
                    ~{task.estimated_duration || 45} мин
                  </div>
                  <div className="request-created">
                    {new Date(task.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                
                <div className="request-actions">
                  <button 
                    className="btn-start"
                    onClick={() => startTask(task)}
                    disabled={!!currentTask}
                  >
                    <FiPlay /> Начать уборку
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {assignedTasks.length === 0 && newTasks.length === 0 && (
            <div className="no-tasks">
              <FiCheckCircle size={48} />
              <h3>Все задачи выполнены!</h3>
              <p>Отличная работа! Новые задачи появятся здесь.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CleanerDashboard;