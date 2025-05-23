import { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiPlus, FiGrid, FiList, FiUser } from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import './Tasks.css';

const Tasks = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState({
    inbox: [],
    next: [],
    inProgress: [],
    finished: [],
    failed: []
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState('board');

  useEffect(() => {
    const loadData = async () => {
      const tasksData = await import('../../mockData/tasks.json');
      
      const groupedTasks = {
        inbox: [],
        next: [],
        inProgress: [],
        finished: [],
        failed: []
      };

      tasksData.tasks.forEach(task => {
        if (groupedTasks[task.status]) {
          groupedTasks[task.status].push(task);
        }
      });

      setTasks(groupedTasks);
    };

    loadData();
  }, []);

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'urgent': return '#e74c3c';
      case 'high': return '#f39c12';
      case 'medium': return '#3498db';
      case 'low': return '#95a5a6';
      default: return '#95a5a6';
    }
  };

  const renderTask = (task) => (
    <div key={task.id} className="task-card">
      <div className="task-header">
        <h4>{task.title}</h4>
        <div 
          className="task-priority" 
          style={{ backgroundColor: getPriorityColor(task.priority) }}
        />
      </div>
      <p className="task-room">{t('rooms.room')} {task.room}</p>
      {task.assignee && (
        <div className="task-assignee">
          <img 
            src={`https://i.pravatar.cc/32?img=${task.id + 80}`} 
            alt={task.assignee} 
          />
          <span>{task.assignee}</span>
          {task.dueDate && <span className="due-date">{task.dueDate}</span>}
        </div>
      )}
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
    </div>
  );

  return (
    <div className="tasks">
      <div className="tasks-header">
        <h1>{t('tasks.title')}</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input type="text" placeholder={t('common.search')} />
          </div>
          <button className="filter-btn">
            <FiFilter /> {t('common.filter')}
          </button>
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            {t('tasks.showCompleted')}
          </label>
          <button className="assignees-btn">
            <FiUser /> {t('tasks.assignees')}
          </button>
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

      <div className="tasks-board">
        {/* Inbox Column */}
        <div className="task-column">
          <div className="column-header">
            <h3>{t('tasks.columns.inbox')} <span className="task-count">{tasks.inbox.length}</span></h3>
            <button className="add-task-btn">
              <FiPlus /> {t('tasks.newTask')}
            </button>
          </div>
          <div className="task-list">
            {tasks.inbox.map(renderTask)}
          </div>
        </div>

        {/* Next Column */}
        <div className="task-column">
          <div className="column-header">
            <h3>{t('tasks.columns.next')} <span className="task-count">{tasks.next.length}</span></h3>
            <button className="add-task-btn">
              <FiPlus /> {t('tasks.newTask')}
            </button>
          </div>
          <div className="task-list">
            {tasks.next.map(renderTask)}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="task-column">
          <div className="column-header">
            <h3>{t('tasks.columns.inProgress')}</h3>
            <button className="add-task-btn">
              <FiPlus /> {t('tasks.newTask')}
            </button>
          </div>
          <div className="task-list">
            {tasks.inProgress.map(renderTask)}
          </div>
        </div>

        {/* Finished Column */}
        <div className="task-column">
          <div className="column-header">
            <h3>{t('tasks.columns.finished')} <span className="task-count">{tasks.finished.length}</span></h3>
            <button className="add-task-btn">
              <FiPlus /> {t('tasks.newTask')}
            </button>
          </div>
          <div className="task-list">
            {tasks.finished.map(renderTask)}
          </div>
        </div>

        {/* Failed Column */}
        <div className="task-column">
          <div className="column-header">
            <h3>{t('tasks.columns.failed')} <span className="task-count">{tasks.failed.length}</span></h3>
            <button className="add-task-btn">
              <FiPlus /> {t('tasks.newTask')}
            </button>
          </div>
          <div className="task-list">
            {tasks.failed.map(renderTask)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tasks;