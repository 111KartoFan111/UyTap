import { useState, useEffect } from 'react';
import { 
  FiCheckSquare, 
  FiClock, 
  FiMapPin, 
  FiList,
  FiCheck,
  FiX,
  FiPlay,
  FiPause,
  FiDollarSign
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import './CleanerDashboard.css';

const CleanerDashboard = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [workingTask, setWorkingTask] = useState(null);
  const [workTimer, setWorkTimer] = useState(0);
  const [isWorking, setIsWorking] = useState(false);
  
  const [todayStats, setTodayStats] = useState({
    completedTasks: 12,
    workingHours: 6.5,
    earnings: 19500,
    pendingTasks: 8
  });

  useEffect(() => {
    // Генерируем задачи для уборщика
    const generateTasks = () => {
      const taskTypes = [
        'Уборка после выезда',
        'Ежедневная уборка',
        'Смена белья',
        'Генеральная уборка',
        'Мытье окон',
        'Уборка ванной комнаты'
      ];

      const priorities = ['urgent', 'high', 'medium'];
      const statuses = ['assigned', 'in_progress', 'completed'];

      const tasksData = [];
      for (let i = 1; i <= 15; i++) {
        const roomNumber = `${Math.floor(Math.random() * 3) + 1}-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;
        const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const status = i <= 5 ? 'assigned' : i <= 8 ? 'in_progress' : 'completed';
        
        tasksData.push({
          id: i,
          roomNumber,
          type: taskType,
          priority,
          status,
          estimatedTime: Math.floor(Math.random() * 120) + 30, // 30-150 минут
          assignedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          notes: Math.random() > 0.7 ? 'Особое внимание к ванной комнате' : '',
          payment: Math.floor(Math.random() * 2000) + 1000 // 1000-3000 тенге за задачу
        });
      }
      
      setTasks(tasksData);
    };

    generateTasks();

    // Таймер для рабочего времени
    let interval;
    if (isWorking) {
      interval = setInterval(() => {
        setWorkTimer(prev => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isWorking]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTask = (task) => {
    setWorkingTask(task);
    setIsWorking(true);
    setWorkTimer(0);
    
    // Обновляем статус задачи
    setTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, status: 'in_progress' } : t
    ));
  };

  const pauseTask = () => {
    setIsWorking(false);
  };

  const resumeTask = () => {
    setIsWorking(true);
  };

  const completeTask = (taskId, quality = 'good') => {
    const completedTime = new Date().toISOString();
    
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { 
            ...t, 
            status: 'completed', 
            completedAt: completedTime,
            workTime: workTimer,
            quality
          } 
        : t
    ));
    
    // Обновляем статистику
    setTodayStats(prev => ({
      ...prev,
      completedTasks: prev.completedTasks + 1,
      earnings: prev.earnings + (workingTask?.payment || 0),
      workingHours: prev.workingHours + (workTimer / 3600)
    }));
    
    setWorkingTask(null);
    setIsWorking(false);
    setWorkTimer(0);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#e74c3c';
      case 'high': return '#f39c12';
      case 'medium': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'assigned': return 'Назначена';
      case 'in_progress': return 'В работе';
      case 'completed': return 'Выполнена';
      default: return status;
    }
  };

  const assignedTasks = tasks.filter(t => t.status === 'assigned');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="cleaner-dashboard">
      <div className="cleaner-header">
        <h1>Панель уборщика</h1>
        <div className="user-greeting">
          Привет, {user.first_name}! Хорошего рабочего дня!
        </div>
      </div>

      {/* Статистика дня */}
      <div className="daily-stats">
        <div className="stat-card">
          <div className="stat-icon completed">
            <FiCheckSquare />
          </div>
          <div className="stat-content">
            <h3>Выполнено</h3>
            <div className="stat-number">{todayStats.completedTasks}</div>
            <div className="stat-label">задач сегодня</div>
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
        
        <div className="stat-card">
          <div className="stat-icon earnings">
            <FiDollarSign />
          </div>
          <div className="stat-content">
            <h3>Заработано</h3>
            <div className="stat-number">₸ {todayStats.earnings.toLocaleString()}</div>
            <div className="stat-label">сегодня</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon pending">
            <FiList />
          </div>
          <div className="stat-content">
            <h3>Осталось</h3>
            <div className="stat-number">{assignedTasks.length}</div>
            <div className="stat-label">задач</div>
          </div>
        </div>
      </div>

      {/* Текущая работа */}
      {workingTask && (
        <div className="current-work">
          <div className="work-header">
            <h2>Текущая задача</h2>
            <div className="work-timer">
              <FiClock />
              {formatTime(workTimer)}
            </div>
          </div>
          
          <div className="work-content">
            <div className="work-info">
              <h3>{workingTask.type}</h3>
              <div className="work-room">
                <FiMapPin />
                Комната {workingTask.roomNumber}
              </div>
              {workingTask.notes && (
                <div className="work-notes">
                  <strong>Примечания:</strong> {workingTask.notes}
                </div>
              )}
            </div>
            
            <div className="work-controls">
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
                onClick={() => completeTask(workingTask.id)}
              >
                <FiCheck /> Завершить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Список задач */}
      <div className="tasks-sections">
        {/* Назначенные задачи */}
        <div className="tasks-section">
          <h2>Новые задачи ({assignedTasks.length})</h2>
          <div className="tasks-list">
            {assignedTasks.map(task => (
              <div key={task.id} className="task-card assigned">
                <div className="task-header">
                  <span className="task-type">{task.type}</span>
                  <div 
                    className="priority-indicator"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  />
                </div>
                
                <div className="task-room">
                  <FiMapPin />
                  Комната {task.roomNumber}
                </div>
                
                <div className="task-meta">
                  <div className="task-time">
                    <FiClock />
                    ~{task.estimatedTime} мин
                  </div>
                  <div className="task-payment">
                    ₸ {task.payment}
                  </div>
                </div>
                
                {task.notes && (
                  <div className="task-notes">{task.notes}</div>
                )}
                
                <div className="task-actions">
                  <button 
                    className="btn-start"
                    onClick={() => startTask(task)}
                    disabled={!!workingTask}
                  >
                    <FiPlay /> Начать
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Выполненные задачи */}
        <div className="tasks-section">
          <h2>Выполнено сегодня ({completedTasks.length})</h2>
          <div className="tasks-list">
            {completedTasks.slice(0, 5).map(task => (
              <div key={task.id} className="task-card completed">
                <div className="task-header">
                  <span className="task-type">{task.type}</span>
                  <FiCheck className="completed-icon" />
                </div>
                
                <div className="task-room">
                  <FiMapPin />
                  Комната {task.roomNumber}
                </div>
                
                <div className="task-meta">
                  <div className="task-time">
                    Время: {Math.floor(task.workTime / 60)} мин
                  </div>
                  <div className="task-payment earned">
                    + ₸ {task.payment}
                  </div>
                </div>
                
                <div className="completion-time">
                  Выполнено: {new Date(task.completedAt).toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="quick-actions">
        <h3>Быстрые действия</h3>
        <div className="action-buttons">
          <button className="action-btn">
            <FiList />
            Запросить материалы
          </button>
          <button className="action-btn">
            <FiMapPin />
            Сообщить о проблеме
          </button>
          <button className="action-btn">
            <FiClock />
            История работы
          </button>
        </div>
      </div>
    </div>
  );
};

export default CleanerDashboard;