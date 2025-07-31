// frontend/src/pages/Cleaner/CleanerDashboard.jsx
import { useState, useEffect } from 'react';
import { 
  FiCheckCircle, 
  FiClock, 
  FiAlertTriangle,
  FiPlay,
  FiCheck,
  FiMapPin,
  FiUser,
  FiList
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import '../TechnicalStaff/TechnicalStaffDashboard.css';


const CleanerDashboard = () => {
  const { user } = useAuth();
  const { tasks, properties, utils } = useData();
  
  const [myTasks, setMyTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayCompleted: 0,
    todayRemaining: 0,
    avgTimePerRoom: 0,
    qualityRating: 0
  });

  useEffect(() => {
    loadMyTasks();
    loadStats();
  }, []);

  const loadMyTasks = async () => {
    try {
      setLoading(true);
      
      // Получаем задачи уборки для текущего пользователя
      const assignedTasks = await tasks.getMy();
      
      // Фильтруем только задачи уборки
      const cleaningTasks = assignedTasks.filter(task => task.task_type === 'cleaning');
      
      // Обогащаем информацией о свойствах
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
          
          return { ...task, property };
        })
      );
      
      setMyTasks(enrichedTasks);
      
      // Найдем текущую активную задачу
      const activeTask = enrichedTasks.find(t => t.status === 'in_progress');
      if (activeTask) {
        setCurrentTask(activeTask);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      utils.showError('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statistics = await tasks.getStatistics(1, user.id); // За сегодня
      
      setStats({
        todayCompleted: statistics.completed_tasks || 0,
        todayRemaining: statistics.active_tasks || 0,
        avgTimePerRoom: statistics.avg_completion_time || 0,
        qualityRating: statistics.avg_quality_rating || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const startTask = async (task) => {
    try {
      if (currentTask) {
        utils.showWarning('Завершите текущую уборку перед началом новой');
        return;
      }

      await tasks.start(task.id);
      setCurrentTask(task);
      
      // Обновляем локальный статус
      setMyTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'in_progress' } : t
      ));
      
      utils.showSuccess('Уборка начата');
    } catch (error) {
      console.error('Error starting task:', error);
      utils.showError('Ошибка начала уборки');
    }
  };

  const completeTask = async (taskId, quality = 5) => {
    try {
      await tasks.complete(taskId, {
        completion_notes: 'Уборка завершена',
        quality_rating: quality
      });
      
      // Обновляем статистику
      setStats(prev => ({
        ...prev,
        todayCompleted: prev.todayCompleted + 1,
        todayRemaining: Math.max(0, prev.todayRemaining - 1)
      }));
      
      // Убираем задачу из списка
      setMyTasks(prev => prev.filter(t => t.id !== taskId));
      setCurrentTask(null);
      
      utils.showSuccess('Уборка завершена');
    } catch (error) {
      console.error('Error completing task:', error);
      utils.showError('Ошибка завершения уборки');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#27ae60';
      case 'in_progress': return '#f39c12';
      case 'assigned': return '#3498db';
      default: return '#95a5a6';
    }
  };

  if (loading) {
    return (
      <div className="cleaner-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка задач уборки...</p>
        </div>
      </div>
    );
  }

  const pendingTasks = myTasks.filter(t => t.status === 'assigned');
  const urgentTasks = myTasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');

  return (
    <div className="cleaner-dashboard">
      <div className="dashboard-header">
        <h1>Уборка помещений</h1>
        <div className="user-greeting">
          Привет, {user.first_name}! Делаем мир чище!
        </div>
      </div>

      {/* Статистика */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon completed">
            <FiCheckCircle />
          </div>
          <div className="stat-content">
            <h3>Выполнено сегодня</h3>
            <div className="stat-number">{stats.todayCompleted}</div>
            <div className="stat-label">помещений</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon pending">
            <FiClock />
          </div>
          <div className="stat-content">
            <h3>Осталось</h3>
            <div className="stat-number">{pendingTasks.length}</div>
            <div className="stat-label">помещений</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon urgent">
            <FiAlertTriangle />
          </div>
          <div className="stat-content">
            <h3>Срочно</h3>
            <div className="stat-number">{urgentTasks.length}</div>
            <div className="stat-label">требуют внимания</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon time">
            <FiClock />
          </div>
          <div className="stat-content">
            <h3>Среднее время</h3>
            <div className="stat-number">{stats.avgTimePerRoom}</div>
            <div className="stat-label">мин/помещение</div>
          </div>
        </div>
      </div>

      {/* Текущая уборка */}
      {currentTask && (
        <div className="current-cleaning">
          <div className="cleaning-header">
            <h2>Текущая уборка</h2>
            <div className="room-info">
              <FiMapPin />
              {currentTask.property?.name || `Объект ${currentTask.property_id}`}
            </div>
          </div>
          
          <div className="cleaning-content">
            <div className="cleaning-details">
              <h3>{currentTask.title}</h3>
              {currentTask.description && (
                <p className="cleaning-description">{currentTask.description}</p>
              )}
              
              <div className="cleaning-checklist">
                <h4>Чек-лист уборки:</h4>
                <ul>
                  <li>Пропылесосить ковры и мебель</li>
                  <li>Протереть пыль с поверхностей</li>
                  <li>Убрать в ванной комнате</li>
                  <li>Сменить постельное белье</li>
                  <li>Проверить наличие расходных материалов</li>
                </ul>
              </div>
            </div>
            
            <div className="cleaning-controls">
              <button 
                className="btn-complete-cleaning"
                onClick={() => completeTask(currentTask.id)}
              >
                <FiCheck /> Завершить уборку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Срочные задачи */}
      {urgentTasks.length > 0 && (
        <div className="urgent-cleanings">
          <h2>
            <FiAlertTriangle />
            Срочная уборка ({urgentTasks.length})
          </h2>
          <div className="cleanings-grid">
            {urgentTasks.map(task => (
              <div key={task.id} className="cleaning-card urgent">
                <div className="card-header">
                  <h4>{task.property?.name || `Объект ${task.property_id}`}</h4>
                  <span className="priority-badge urgent">СРОЧНО</span>
                </div>
                
                <p className="room-number">
                  Помещение: {task.property?.number || task.property_id}
                </p>
                
                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}
                
                <div className="card-footer">
                  <div className="task-time">
                    <FiClock />
                    ~{task.estimated_duration || 60} мин
                  </div>
                  
                  <button 
                    className="btn-start-urgent"
                    onClick={() => startTask(task)}
                    disabled={!!currentTask}
                  >
                    <FiPlay /> Начать уборку
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Плановые задачи */}
      <div className="scheduled-cleanings">
        <h2>
          <FiList />
          Плановая уборка ({pendingTasks.length})
        </h2>
        
        {pendingTasks.length > 0 ? (
          <div className="cleanings-list">
            {pendingTasks.map(task => (
              <div key={task.id} className="cleaning-item">
                <div className="item-info">
                  <h4>{task.property?.name || `Объект ${task.property_id}`}</h4>
                  <p>Помещение: {task.property?.number || task.property_id}</p>
                  {task.description && (
                    <p className="item-description">{task.description}</p>
                  )}
                </div>
                
                <div className="item-meta">
                  <span 
                    className="priority-indicator"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  />
                  <div className="estimated-time">
                    <FiClock />
                    ~{task.estimated_duration || 60} мин
                  </div>
                </div>
                
                <div className="item-actions">
                  <button 
                    className="btn-start-cleaning"
                    onClick={() => startTask(task)}
                    disabled={!!currentTask}
                  >
                    <FiPlay /> Начать
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-tasks">
            <FiCheckCircle size={48} />
            <h3>Все задачи уборки выполнены!</h3>
            <p>Отличная работа! Новые задачи появятся здесь.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CleanerDashboard;