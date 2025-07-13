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
  FiPhone
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import './TechnicalStaffDashboard.css';

const TechnicalStaffDashboard = () => {
  const { user } = useAuth();
  const { tasks, properties, organization } = useData();
  
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
      const assignedTasks = await tasks.getMy();
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
            typeData: getTaskTypeData(task.task_type),
            clientName: generateRandomClient()
          };
        })
      );
      
      setMyTasks(enrichedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
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

  const getTaskTypeData = (taskType) => {
    const types = {
      maintenance: { icon: FiTool, name: 'Общий ремонт', color: '#27ae60' },
      electrical: { icon: FiZap, name: 'Электрика', color: '#f39c12' },
      plumbing: { icon: FiDroplet, name: 'Сантехника', color: '#3498db' },
      hvac: { icon: FiThermometer, name: 'Отопление/Кондиционер', color: '#e74c3c' },
      internet: { icon: FiWifi, name: 'Интернет/ТВ', color: '#9b59b6' }
    };
    return types[taskType] || types.maintenance;
  };

  const generateRandomClient = () => {
    const clients = [
      'Анна Петрова', 'Марат Саметов', 'Дмитрий Ким', 'Света Жанова',
      'Алексей Иванов', 'Мария Казакова', 'Даулет Мурат', 'Нина Сергеева'
    ];
    return clients[Math.floor(Math.random() * clients.length)];
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTask = async (task) => {
    try {
      await tasks.start(task.id);
      setCurrentTask(task);
      setIsWorking(true);
      setWorkTimer(0);
      
      // Обновляем локальный статус
      setMyTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'in_progress' } : t
      ));
    } catch (error) {
      console.error('Error starting task:', error);
    }
  };

  const pauseTask = () => {
    setIsWorking(false);
  };

  const resumeTask = () => {
    setIsWorking(true);
  };

  const completeTask = async (taskId, resolution = 'Проблема решена') => {
    try {
      await tasks.complete(taskId, {
        completion_notes: resolution,
        actual_duration: workTimer
      });
      
      // Обновляем статистику
      setTodayStats(prev => ({
        ...prev,
        completedTasks: prev.completedTasks + 1,
        activeRequests: prev.activeRequests - 1,
        workingHours: prev.workingHours + (workTimer / 3600)
      }));
      
      // Убираем задачу из списка
      setMyTasks(prev => prev.filter(t => t.id !== taskId));
      
      setCurrentTask(null);
      setIsWorking(false);
      setWorkTimer(0);
    } catch (error) {
      console.error('Error completing task:', error);
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

  // Фильтруем задачи
  const newTasks = myTasks.filter(t => t.status === 'pending');
  const assignedTasks = myTasks.filter(t => t.status === 'assigned');
  const inProgressTasks = myTasks.filter(t => t.status === 'in_progress');
  const urgentTasks = myTasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');

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
            <div className="stat-label">заявок сегодня</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon active">
            <FiTool />
          </div>
          <div className="stat-content">
            <h3>Активные</h3>
            <div className="stat-number">{todayStats.activeRequests}</div>
            <div className="stat-label">заявки</div>
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
            <div className="stat-label">часов</div>
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
                  {currentTask.created_by}
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

      {/* Срочные заявки */}
      {urgentTasks.length > 0 && (
        <div className="urgent-requests">
          <h2>
            <FiAlertTriangle />
            Срочные заявки ({urgentTasks.length})
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
                    {task.clientName}
                  </div>
                </div>
                
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
                    Взять в работу
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Все заявки */}
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
                    <FiMapPin /> Адрес: {task.property?.name || `Объект ${task.property_id}`} {task.property.address }
                  </div>
                  <div className="request-client">
                    <FiUser /> Назначил: {task.creator.first_name}
                  </div>
                </div>
                
                {task.description && (
                  <div className="request-description">{task.description}</div>
                )}
                
                <div className="request-meta">
                  <div className="request-time">
                    <FiClock />
                    ~{task.estimated_duration} мин
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
                    <FiPlay /> Начать работу
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

export default TechnicalStaffDashboard;