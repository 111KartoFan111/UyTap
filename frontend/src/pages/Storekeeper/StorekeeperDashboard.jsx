// frontend/src/pages/Storekeeper/StorekeeperDashboard.jsx
import { useState, useEffect } from 'react';
import { 
  FiPackage, 
  FiAlertTriangle, 
  FiTrendingDown, 
  FiTruck,
  FiList,
  FiBarChart2,
  FiShoppingCart,
  FiBox,
  FiUser,
  FiCalendar,
  FiCheckCircle,
  FiPlay
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import '../TechnicalStaff/TechnicalStaffDashboard.css'; // Используем те же стили

const StorekeeperDashboard = () => {
  const { user } = useAuth();
  const { inventory, tasks, utils } = useData();
  
  const [inventoryStats, setInventoryStats] = useState({
    totalItems: 0,
    lowStockItems: 0,
    totalValue: 0,
    recentMovements: 0
  });
  
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [supplyTasks, setSupplyTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventoryData();
    loadLowStockItems();
    loadRecentMovements();
    loadSupplyTasks();
  }, []);

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      
      // Получаем статистику по инвентарю
      const stats = await inventory.getStatistics();
      
      setInventoryStats({
        totalItems: stats.total_items || 0,
        lowStockItems: stats.low_stock_count || 0,
        totalValue: stats.total_value || 0,
        recentMovements: stats.recent_movements || 0
      });
    } catch (error) {
      console.error('Error loading inventory stats:', error);
      utils.showError('Ошибка загрузки статистики склада');
    } finally {
      setLoading(false);
    }
  };

  const loadLowStockItems = async () => {
    try {
      // Получаем товары с низким остатком
      const lowStock = await inventory.getLowStock();
      setLowStockItems(lowStock || []);
    } catch (error) {
      console.error('Error loading low stock items:', error);
    }
  };

  const loadRecentMovements = async () => {
    try {
      // Получаем все товары и для каждого последние движения
      const items = await inventory.getAll({ limit: 10 });
      
      const movements = [];
      for (const item of items.slice(0, 5)) {
        try {
          const itemMovements = await inventory.getMovements(item.id, { limit: 3 });
          movements.push(...itemMovements.map(movement => ({
            ...movement,
            item_name: item.name
          })));
        } catch (error) {
          console.error(`Error loading movements for item ${item.id}:`, error);
        }
      }
      
      // Сортируем по дате
      movements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentMovements(movements.slice(0, 10));
    } catch (error) {
      console.error('Error loading recent movements:', error);
    }
  };

  const loadSupplyTasks = async () => {
    try {
      // Получаем задачи доставки для кладовщика
      const myTasks = await tasks.getMy();
      
      // Фильтруем задачи связанные со складом
      const supplyRelatedTasks = myTasks.filter(task => 
        ['delivery', 'maintenance'].includes(task.task_type) ||
        task.title.toLowerCase().includes('склад') ||
        task.title.toLowerCase().includes('поставка') ||
        task.title.toLowerCase().includes('материал')
      );
      
      setSupplyTasks(supplyRelatedTasks);
    } catch (error) {
      console.error('Error loading supply tasks:', error);
    }
  };

  const formatCurrency = (amount) => {
    return `₸ ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getMovementTypeIcon = (type) => {
    switch (type) {
      case 'in': return <FiTruck style={{ color: '#27ae60' }} />;
      case 'out': return <FiShoppingCart style={{ color: '#e74c3c' }} />;
      case 'adjustment': return <FiList style={{ color: '#3498db' }} />;
      case 'writeoff': return <FiAlertTriangle style={{ color: '#95a5a6' }} />;
      default: return <FiPackage />;
    }
  };

  const getMovementTypeName = (type) => {
    switch (type) {
      case 'in': return 'Поступление';
      case 'out': return 'Расход';
      case 'adjustment': return 'Корректировка';
      case 'writeoff': return 'Списание';
      default: return type;
    }
  };

  const startSupplyTask = async (task) => {
    try {
      await tasks.start(task.id);
      utils.showSuccess('Задача начата');
      
      // Обновляем локальный статус
      setSupplyTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'in_progress' } : t
      ));
    } catch (error) {
      console.error('Error starting task:', error);
      utils.showError('Ошибка начала задачи');
    }
  };

  if (loading) {
    return (
      <div className="technical-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка данных склада...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="technical-dashboard">
      <div className="technical-header">
        <h1>Управление складом</h1>
        <div className="user-greeting">
          Привет, {user.first_name}! Контролируем запасы!
        </div>
      </div>

      {/* Статистика склада */}
      <div className="daily-stats">
        <div className="stat-card">
          <div className="stat-icon completed" style={{ background: '#3498db' }}>
            <FiPackage />
          </div>
          <div className="stat-content">
            <h3>Всего товаров</h3>
            <div className="stat-number">{inventoryStats.totalItems}</div>
            <div className="stat-label">наименований</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon urgent" style={{ background: '#e74c3c' }}>
            <FiAlertTriangle />
          </div>
          <div className="stat-content">
            <h3>Низкий остаток</h3>
            <div className="stat-number">{inventoryStats.lowStockItems}</div>
            <div className="stat-label">требуют пополнения</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon active" style={{ background: '#27ae60' }}>
            <FiBarChart2 />
          </div>
          <div className="stat-content">
            <h3>Стоимость</h3>
            <div className="stat-number">{formatCurrency(inventoryStats.totalValue)}</div>
            <div className="stat-label">общая стоимость</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon hours" style={{ background: '#f39c12' }}>
            <FiTrendingDown />
          </div>
          <div className="stat-content">
            <h3>Движения</h3>
            <div className="stat-number">{inventoryStats.recentMovements}</div>
            <div className="stat-label">за последнее время</div>
          </div>
        </div>
      </div>

      {/* Товары с низким остатком */}
      {lowStockItems.length > 0 && (
        <div className="urgent-requests">
          <h2>
            <FiAlertTriangle />
            Требуют пополнения ({lowStockItems.length})
          </h2>
          <div className="requests-grid">
            {lowStockItems.slice(0, 6).map(item => (
              <div key={item.id} className="request-card urgent">
                <div className="request-header">
                  <div className="request-type">
                    <FiPackage style={{ color: '#e74c3c' }} />
                    <span>{item.category || 'Товар'}</span>
                  </div>
                  <div className="priority urgent">МАЛО</div>
                </div>
                
                <h4>{item.name}</h4>
                <div className="request-details">
                  <div className="request-room">
                    <FiBox />
                    Остаток: {item.current_stock} {item.unit}
                  </div>
                  <div className="request-client">
                    <FiAlertTriangle />
                    Минимум: {item.min_stock} {item.unit}
                  </div>
                </div>
                
                {item.supplier && (
                  <div className="request-description">
                    Поставщик: {item.supplier}
                  </div>
                )}
                
                <div className="request-meta">
                  <div className="request-time">
                    <FiCalendar />
                    {item.last_restock_date ? formatDate(item.last_restock_date) : 'Не было'}
                  </div>
                  <div className="request-created">
                    {item.cost_per_unit ? formatCurrency(item.cost_per_unit) : 'Цена не указана'}
                  </div>
                </div>
                
                <div className="request-actions">
                  <button 
                    className="btn-start urgent"
                    onClick={() => utils.showInfo('Создать заявку на пополнение')}
                  >
                    <FiShoppingCart /> Заказать
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Задачи поставок */}
      {supplyTasks.length > 0 && (
        <div className="requests-sections">
          <div className="requests-section">
            <h2>Задачи поставок ({supplyTasks.length})</h2>
            <div className="requests-list">
              {supplyTasks.map(task => (
                <div key={task.id} className="request-card">
                  <div className="request-header">
                    <div className="request-type">
                      <FiTruck style={{ color: '#3498db' }} />
                      <span>{task.task_type === 'delivery' ? 'Доставка' : 'Обслуживание'}</span>
                    </div>
                    <div 
                      className="priority"
                      style={{ 
                        color: task.priority === 'urgent' ? '#e74c3c' : '#3498db' 
                      }}
                    >
                      {task.priority === 'urgent' ? 'СРОЧНО' : 'ОБЫЧНОЕ'}
                    </div>
                  </div>
                  
                  <h4>{task.title}</h4>
                  <div className="request-details">
                    <div className="request-room">
                      <FiUser />
                      Создал: {task.created_by || 'Система'}
                    </div>
                    <div className="request-client">
                      <FiCalendar />
                      {task.due_date ? formatDate(task.due_date) : 'Без срока'}
                    </div>
                  </div>
                  
                  {task.description && (
                    <div className="request-description">{task.description}</div>
                  )}
                  
                  <div className="request-meta">
                    <div className="request-time">
                      Создано: {formatDate(task.created_at)}
                    </div>
                    <div className="request-created">
                      {task.estimated_duration ? `~${task.estimated_duration} мин` : 'Время не указано'}
                    </div>
                  </div>
                  
                  {task.status === 'assigned' && (
                    <div className="request-actions">
                      <button 
                        className="btn-start"
                        onClick={() => startSupplyTask(task)}
                      >
                        <FiPlay /> Начать выполнение
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Последние движения товаров */}
      <div className="requests-sections">
        <div className="requests-section">
          <h2>Последние движения ({recentMovements.length})</h2>
          <div className="requests-list">
            {recentMovements.map(movement => (
              <div key={movement.id} className="request-card">
                <div className="request-header">
                  <div className="request-type">
                    {getMovementTypeIcon(movement.movement_type)}
                    <span>{getMovementTypeName(movement.movement_type)}</span>
                  </div>
                  <div 
                    className="priority"
                    style={{ 
                      color: movement.movement_type === 'in' ? '#27ae60' : '#e74c3c' 
                    }}
                  >
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.unit || 'шт'}
                  </div>
                </div>
                
                <h4>{movement.item_name}</h4>
                <div className="request-details">
                  <div className="request-room">
                    <FiBox />
                    Остаток: {movement.stock_after}
                  </div>
                  <div className="request-client">
                    {movement.total_cost && (
                      <>
                        <FiBarChart2 />
                        {formatCurrency(movement.total_cost)}
                      </>
                    )}
                  </div>
                </div>
                
                {movement.reason && (
                  <div className="request-description">
                    Причина: {movement.reason}
                  </div>
                )}
                
                <div className="request-meta">
                  <div className="request-time">
                    <FiCalendar />
                    {formatDate(movement.created_at)}
                  </div>
                  <div className="request-created">
                    {movement.user_id ? 'Пользователь' : 'Система'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {recentMovements.length === 0 && (
            <div className="no-tasks">
              <FiPackage size={48} />
              <h3>Нет движений</h3>
              <p>Движения товаров появятся здесь.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorekeeperDashboard;