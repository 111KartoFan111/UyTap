import { useState, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import './TaskHistory.css'; // Import the CSS file

const TaskHistory = () => {
  const { tasks: tasksAPI } = useData();
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await tasksAPI.getAll();
        setTasks(response);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [tasksAPI]);

  if (loading) return <p className="loading">Загрузка...</p>;
  if (error) return <p className="error">Ошибка: {error.message}</p>;

  return (
    <div className="task-history">
      <a href={user.role === 'admin' ? '/admin/tasks' : '/manager/tasks'}>
        <button className="btn btn-primary">Назад</button>
      </a>
      <h1>История задач</h1>
      <p>Всего задач: {tasks.length}</p>
      <p>
        Последняя задача:{' '}
        {tasks.length > 0
          ? new Date(tasks[0].created_at).toLocaleDateString('ru-RU')
          : 'Нет задач'}
      </p>
      {tasks.length === 0 ? (
        <p className="no-tasks">Нет задач для отображения.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className="task-item">
              <div className="task-header">
                <strong>{task.title}</strong> — <span className={`status ${task.status}`}>{task.status}</span> — {task.payment_amount} ₸
              </div>
              <p className="task-description">{task.description}</p>
              <p>
                Создано:{' '}
                {new Date(task.created_at).toLocaleDateString('ru-RU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p>
                Обновлено:{' '}
                {new Date(task.updated_at).toLocaleDateString('ru-RU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p>
                Завершено:{' '}
                {task.completed_at
                  ? new Date(task.completed_at).toLocaleDateString('ru-RU')
                  : 'Не завершено'}
              </p>
              <p>
                Ответственный:{' '}
                {task.assignee
                  ? `${task.assignee.first_name} ${task.assignee.last_name}`
                  : 'Не назначено'}
              </p>
              <p>Приоритет: <span className={`priority ${task.priority}`}>{task.priority}</span></p>
              {task.completion_notes && <p>Примечания: {task.completion_notes}</p>}
              <p>
                Объект: {task.property.name} ({task.property.address})
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TaskHistory;