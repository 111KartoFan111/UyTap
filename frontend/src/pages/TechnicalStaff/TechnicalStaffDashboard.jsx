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
  FiCheck
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import './TechnicalStaffDashboard.css';

const TechnicalStaffDashboard = () => {
  const { user } = useAuth();
  const [activeRequests, setActiveRequests] = useState([]);
  const [currentTask, setCurrentTask] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [workTimer, setWorkTimer] = useState(0);
  
  const [todayStats, setTodayStats] = useState({
    completedTasks: 8,
    activeRequests: 12,
    urgentIssues: 3,
    workingHours: 5.2
  });

  useEffect(() => {
    // Генерируем заявки на обслуживание
    const generateRequests = () => {
      const requestTypes = [
        { type: 'electrical', icon: FiZap, name: 'Электрика', color: '#f39c12' },
        { type: 'plumbing', icon: FiDroplet, name: 'Сантехника', color: '#3498db' },
        { type: 'hvac', icon: FiThermometer, name: 'Отопление/Кондиционер', color: '#e74c3c' },
        { type: 'internet', icon: FiWifi, name: 'Интернет/ТВ', color: '#9b59b6' },
        { type: 'general', icon: FiTool, name: 'Общий ремонт', color: '#27ae60' }
      ];

      const priorities = ['urgent', 'high', 'medium', 'low'];
      const statuses = ['new', 'assigned', 'in_progress', 'completed'];

      const requestsData = [];
      for (let i = 1; i <= 20; i++) {
        const typeData = requestTypes[Math.floor(Math.random() * requestTypes.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const status = i <= 5 ? 'new' : i <= 10 ? 'assigned' : i <= 15 ? 'in_progress' : 'completed';
        const roomNumber = `${Math.floor(Math.random() * 3) + 1}-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;
        
        requestsData.push({
          id: i,
          roomNumber,
          type: typeData.type,
          typeName: typeData.name,
          typeIcon: typeData.icon,
          typeColor: typeData.color,
          priority,
          status,
          title: getRandomIssue(typeData.type),
          description: getRandomDescription(typeData.type),
          reportedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedTime: Math.floor(Math.random() * 180) + 30, // 30-210 минут
          clientName: getRandomClient(),
          urgency: priority === 'urgent'
        });
      }
      
      setActiveRequests(requestsData);
    };

    generateRequests();

    // Таймер для текущей работы
    let interval;
    if (isWorking && currentTask) {
      interval = setInterval(() => {
        setWorkTimer(prev => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isWorking, currentTask]);

  const getRandomIssue = (type) => {
    const issues = {
      electrical: ['Не работает свет', 'Проблемы с розетками', 'Перегорела лампочка', 'Не работает выключатель'],
      plumbing: ['Засор в ванной', 'Течет кран', 'Слабый напор воды', 'Не работает душ'],
      hvac: ['Не работает кондиционер', 'Холодно в комнате', 'Шумит вентиляция', 'Не регулируется температура'],
      internet: ['Нет интернета', 'Не работает ТВ', 'Слабый сигнал WiFi', 'Проблемы с пультом'],
      general: ['Скрипит дверь', 'Не закрывается окно', 'Сломана мебель', 'Требуется мелкий ремонт']
    };
    const typeIssues = issues[type] || issues.general;
    return typeIssues[Math.floor(Math.random() * typeIssues.length)];
  };

  const getRandomDescription = (type) => {
    const descriptions = {
      electrical: 'Клиент сообщает о проблемах с электричеством в номере',
      plumbing: 'Требуется срочное вмешательство сантехника',
      hvac: 'Проблемы с климат-контролем в помещении',
      internet: 'Технические неполадки с интернетом или ТВ',
      general: 'Требуется техническое обслуживание'
    };
    return descriptions[type] || descriptions.general;
  };

  const getRandomClient = () => {
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

  const startTask = (request) => {
    setCurrentTask(request);
    setIsWorking(true);
    setWorkTimer(0);
    
    setActiveRequests(prev => prev.map(r => 
      r.id === request.id ? { ...r, status: 'in_progress' } : r
    ));
  };

  const pauseTask = () => {
    setIsWorking(false);
  };

  const resumeTask = () => {
    setIsWorking(true);
  };

  const completeTask = (requestId, resolution = 'Проблема решена') => {
    setActiveRequests(prev => prev.map(r => 
      r.id === requestId 
        ? { 
            ...r, 
            status: 'completed', 
            completedAt: new Date().toISOString(),
            workTime: workTimer,
            resolution
          } 
        : r
    ));
    
    setTodayStats(prev => ({
      ...prev,
      completedTasks: prev.completedTasks + 1,
      activeRequests: prev.activeRequests - 1,
      workingHours: prev.workingHours + (workTimer / 3600)
    }));
    
    setCurrentTask(null);
    setIsWorking(false);
    setWorkTimer(0);
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

  const getStatusText = (status) => {
    switch (status) {
      case 'new': return 'Новая';
      case 'assigned': return 'Назначена';
      case 'in_progress': return 'В работе';
      case 'completed': return 'Выполнена';
      default: return status;
    }
  };

  const newRequests = activeRequests.filter(r => r.status === 'new');
  const assignedRequests = activeRequests.filter(r => r.status === 'assigned');
  const inProgressRequests = activeRequests.filter(r => r.status === 'in_progress');
  const urgentRequests = activeRequests.filter(r => r.priority === 'urgent' && r.status !== 'completed');

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
            <div className="stat-number">{urgentRequests.length}</div>
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
                <currentTask.typeIcon style={{ color: currentTask.typeColor }} />
                <span>{currentTask.typeName}</span>
              </div>
              <h3>{currentTask.title}</h3>
              <div className="task-room">Комната {currentTask.roomNumber}</div>
              <div className="task-client">Клиент: {currentTask.clientName}</div>
              <div className="task-description">{currentTask.description}</div>
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
      {urgentRequests.length > 0 && (
        <div className="urgent-requests">
          <h2>
            <FiAlertTriangle />
            Срочные заявки ({urgentRequests.length})
          </h2>
          <div className="requests-grid">
            {urgentRequests.map(request => (
              <div key={request.id} className="request-card urgent">
                <div className="request-header">
                  <div className="request-type">
                    <request.typeIcon style={{ color: request.typeColor }} />
                    <span>{request.typeName}</span>
                  </div>
                  <div className="priority urgent">СРОЧНО</div>
                </div>
                
                <h4>{request.title}</h4>
                <div className="request-room">Комната {request.roomNumber}</div>
                <div className="request-client">{request.clientName}</div>
                
                <div className="request-meta">
                  <div className="request-time">
                    Время: ~{request.estimatedTime} мин
                  </div>
                  <div className="request-reported">
                    {new Date(request.reportedAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="request-actions">
                  <button 
                    className="btn-start urgent"
                    onClick={() => startTask(request)}
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
          <h2>Новые заявки ({newRequests.length})</h2>
          <div className="requests-list">
            {newRequests.map(request => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <div className="request-type">
                    <request.typeIcon style={{ color: request.typeColor }} />
                    <span>{request.typeName}</span>
                  </div>
                  <div 
                    className="priority"
                    style={{ color: getPriorityColor(request.priority) }}
                  >
                    {getPriorityText(request.priority)}
                  </div>
                </div>
                
                <h4>{request.title}</h4>
                <div className="request-room">Комната {request.roomNumber}</div>
                <div className="request-client">{request.clientName}</div>
                <div className="request-description">{request.description}</div>
                
                <div className="request-meta">
                  <div className="request-time">
                    Время: ~{request.estimatedTime} мин
                  </div>
                  <div className="request-reported">
                    {new Date(request.reportedAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="request-actions">
                  <button 
                    className="btn-start"
                    onClick={() => startTask(request)}
                    disabled={!!currentTask}
                  >
                    Начать работу
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalStaffDashboard;