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
  FiPlay,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiMove,
  FiFilter,
  FiDownload,
  FiX,
  FiSearch
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useData } from '../../contexts/DataContext.jsx';
import Modal from '../../components/Common/Modal.jsx';

import '../TechnicalStaff/TechnicalStaffDashboard.css';

const InventoryCheck = () => {
  const { user } = useAuth();
  const { inventory, tasks, utils } = useData();
  
  const [inventoryStats, setInventoryStats] = useState({
    totalItems: 0,
    lowStockItems: 0,
    totalValue: 0,
    categoriesCount: 0
  });
  
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [supplyTasks, setSupplyTasks] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Фильтры
  const [filters, setFilters] = useState({
    category: '',
    searchQuery: '',
    stockStatus: '', // '', 'low', 'normal', 'high', 'out'
    showLowStockOnly: false
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Модальные окна
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [movementData, setMovementData] = useState({
    movement_type: 'in',
    quantity: '',
    unit_cost: '',
    reason: '',
    notes: ''
  });
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    category: '',
    sku: '',
    unit: 'шт',
    min_stock: 0,
    max_stock: null,
    cost_per_unit: null,
    supplier: '',
    supplier_contact: '',
    current_stock: 0
  });

  useEffect(() => {
    loadAllData();
  }, []);

  // Применяем фильтры при их изменении
  useEffect(() => {
    applyFilters();
  }, [filters]);

  const loadAllData = async () => {
    await Promise.all([
      loadInventoryStats(),
      loadLowStockItems(),
      loadInventoryItems(),
      loadSupplyTasks()
    ]);
  };

  const loadInventoryStats = async () => {
    try {
      setLoading(true);
      
      const stats = await inventory.getStatistics();
      const items = await inventory.getAll({ limit: 1000 });
      
      // Подсчитываем категории
      const categories = new Set(items.map(item => item.category).filter(Boolean));
      setAllCategories([...categories].sort());
      
      setInventoryStats({
        totalItems: stats.total_items || items.length,
        lowStockItems: stats.low_stock_count || items.filter(item => item.current_stock <= item.min_stock).length,
        totalValue: stats.total_value || items.reduce((sum, item) => sum + (item.current_stock * (item.cost_per_unit || 0)), 0),
        categoriesCount: categories.size
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
      const lowStock = await inventory.getLowStock();
      setLowStockItems(lowStock || []);
    } catch (error) {
      console.error('Error loading low stock items:', error);
      // Fallback - получаем все товары и фильтруем
      try {
        const allItems = await inventory.getAll();
        const lowStock = allItems.filter(item => item.current_stock <= item.min_stock);
        setLowStockItems(lowStock);
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
      }
    }
  };

  const loadInventoryItems = async () => {
    try {
      const items = await inventory.getAll({ limit: 1000 });
      setInventoryItems(items || []);
    } catch (error) {
      console.error('Error loading inventory items:', error);
    }
  };

  const loadSupplyTasks = async () => {
    try {
      const myTasks = await tasks.getMy();
      
      const supplyRelatedTasks = myTasks.filter(task => 
        ['delivery', 'maintenance'].includes(task.task_type) ||
        task.title.toLowerCase().includes('склад') ||
        task.title.toLowerCase().includes('поставка') ||
        task.title.toLowerCase().includes('материал') ||
        task.title.toLowerCase().includes('доставка')
      );
      
      setSupplyTasks(supplyRelatedTasks);
    } catch (error) {
      console.error('Error loading supply tasks:', error);
    }
  };

  // Функция фильтрации
  const applyFilters = () => {
    let filtered = [...inventoryItems];

    // Фильтр по категории
    if (filters.category) {
      filtered = filtered.filter(item => 
        item.category && item.category.toLowerCase() === filters.category.toLowerCase()
      );
    }

    // Поиск по названию, описанию, артикулу
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.sku && item.sku.toLowerCase().includes(query))
      );
    }

    // Фильтр по статусу остатков
    if (filters.stockStatus) {
      filtered = filtered.filter(item => {
        const status = getStockStatus(item).status;
        return status === filters.stockStatus;
      });
    }

    // Показать только товары с низким остатком
    if (filters.showLowStockOnly) {
      filtered = filtered.filter(item => item.current_stock <= item.min_stock);
    }

    return filtered;
  };

  const getFilteredItems = () => {
    return applyFilters();
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      searchQuery: '',
      stockStatus: '',
      showLowStockOnly: false
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.category) count++;
    if (filters.searchQuery) count++;
    if (filters.stockStatus) count++;
    if (filters.showLowStockOnly) count++;
    return count;
  };

  // Добавление нового товара
  const handleAddItem = async () => {
    try {
      if (!newItem.name || !newItem.unit) {
        utils.showError('Заполните обязательные поля: название и единица измерения');
        return;
      }

      await inventory.create({
        ...newItem,
        min_stock: Number(newItem.min_stock) || 0,
        max_stock: newItem.max_stock ? Number(newItem.max_stock) : null,
        cost_per_unit: newItem.cost_per_unit ? Number(newItem.cost_per_unit) : null,
        current_stock: Number(newItem.current_stock) || 0
      });

      setShowAddItemModal(false);
      setNewItem({
        name: '',
        description: '',
        category: '',
        sku: '',
        unit: 'шт',
        min_stock: 0,
        max_stock: null,
        cost_per_unit: null,
        supplier: '',
        supplier_contact: '',
        current_stock: 0
      });

      await loadAllData();
    } catch (error) {
      console.error('Error adding item:', error);
      utils.showError('Ошибка добавления товара');
    }
  };

  // Создание движения товара
  const handleCreateMovement = async () => {
    try {
      if (!selectedItem || !movementData.quantity) {
        utils.showError('Заполните обязательные поля');
        return;
      }

      const quantity = Number(movementData.quantity);
      if (isNaN(quantity) || quantity === 0) {
        utils.showError('Введите корректное количество');
        return;
      }

      await inventory.createMovement(selectedItem.id, {
        ...movementData,
        inventory_id: selectedItem.id,
        quantity: movementData.movement_type === 'out' ? -Math.abs(quantity) : Math.abs(quantity),
        unit_cost: movementData.unit_cost ? Number(movementData.unit_cost) : null
      });

      setShowMovementModal(false);
      setSelectedItem(null);
      setMovementData({
        movement_type: 'in',
        quantity: '',
        unit_cost: '',
        reason: '',
        notes: ''
      });

      await loadAllData();
    } catch (error) {
      console.error('Error creating movement:', error);
      utils.showError('Ошибка создания движения');
    }
  };

  const startSupplyTask = async (task) => {
    try {
      await tasks.start(task.id);
      utils.showSuccess('Задача начата');
      
      setSupplyTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'in_progress' } : t
      ));
    } catch (error) {
      console.error('Error starting task:', error);
      utils.showError('Ошибка начала задачи');
    }
  };

  const completeSupplyTask = async (taskId) => {
    try {
      await tasks.complete(taskId, {
        completion_notes: 'Задача выполнена',
        quality_rating: 5
      });
      
      setSupplyTasks(prev => prev.filter(t => t.id !== taskId));
      utils.showSuccess('Задача завершена');
    } catch (error) {
      console.error('Error completing task:', error);
      utils.showError('Ошибка завершения задачи');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const getStockStatus = (item) => {
    if (item.current_stock <= 0) return { status: 'out', color: '#e74c3c', text: 'Закончился' };
    if (item.current_stock <= item.min_stock) return { status: 'low', color: '#f39c12', text: 'Низкий остаток' };
    if (item.max_stock && item.current_stock >= item.max_stock) return { status: 'high', color: '#e74c3c', text: 'Избыток' };
    return { status: 'normal', color: '#27ae60', text: 'Нормальный' };
  };

  const getStockStatusName = (status) => {
    switch (status) {
      case 'out': return 'Закончился';
      case 'low': return 'Низкий остаток';
      case 'high': return 'Избыток';
      case 'normal': return 'Нормальный';
      default: return status;
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

  const filteredItems = getFilteredItems();
  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="technical-dashboard">
      <div className="technical-header">
        <h1>Управление складом</h1>
        <div className="user-greeting">
          Привет, {user.first_name}! Контролируем запасы!
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn-start"
            onClick={() => setShowAddItemModal(true)}
            style={{ background: '#27ae60' }}
          >
            <FiPlus /> Добавить товар
          </button>
          
          <button 
            className="btn-start"
            onClick={() => setShowFilters(!showFilters)}
            style={{ 
              background: showFilters ? '#3498db' : '#95a5a6',
              position: 'relative'
            }}
          >
            <FiFilter /> Фильтры
            {activeFiltersCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#e74c3c',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
          
          <button 
            className="btn-start"
            onClick={() => inventory.export('xlsx')}
            style={{ background: '#3498db' }}
          >
            <FiDownload /> Экспорт
          </button>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '12px',
              marginBottom: '12px'
            }}>
              {/* Поиск */}
              <div>
                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                  Поиск по названию, описанию, артикулу
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Введите запрос..."
                    value={filters.searchQuery}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      searchQuery: e.target.value 
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px 32px 8px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <FiSearch style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#666'
                  }} />
                </div>
              </div>

              {/* Категория */}
              <div>
                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                  Категория
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    category: e.target.value 
                  }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Все категории</option>
                  {allCategories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Статус остатков */}
              <div>
                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                  Статус остатков
                </label>
                <select
                  value={filters.stockStatus}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    stockStatus: e.target.value 
                  }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Все статусы</option>
                  <option value="out">Закончился</option>
                  <option value="low">Низкий остаток</option>
                  <option value="normal">Нормальный</option>
                  <option value="high">Избыток</option>
                </select>
              </div>

              {/* Чекбокс для низких остатков */}
              <div>
                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                  Быстрые фильтры
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '8px 0'
                }}>
                  <input
                    type="checkbox"
                    checked={filters.showLowStockOnly}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      showLowStockOnly: e.target.checked 
                    }))}
                  />
                  <span>Только низкие остатки</span>
                </label>
              </div>
            </div>

            {/* Кнопки управления фильтрами */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={clearFilters}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <FiX /> Очистить фильтры
              </button>
              
              <span style={{ fontSize: '12px', color: '#666' }}>
                Найдено: {filteredItems.length} из {inventoryItems.length} товаров
              </span>
            </div>
          </div>
        )}
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
            <FiList />
          </div>
          <div className="stat-content">
            <h3>Категории</h3>
            <div className="stat-number">{inventoryStats.categoriesCount}</div>
            <div className="stat-label">категорий товаров</div>
          </div>
        </div>
      </div>

      {/* Товары с низким остатком */}
      {lowStockItems.length > 0 && !filters.showLowStockOnly && (
        <div className="urgent-requests">
          <h2>
            <FiAlertTriangle />
            Требуют пополнения ({lowStockItems.length})
          </h2>
          <div className="requests-grid">
            {lowStockItems.slice(0, 6).map(item => {
              const stockStatus = getStockStatus(item);
              return (
                <div key={item.id} className="request-card urgent">
                  <div className="request-header">
                    <div className="request-type">
                      <FiPackage style={{ color: stockStatus.color }} />
                      <span>{item.category || 'Товар'}</span>
                    </div>
                    <div className="priority urgent">{stockStatus.text}</div>
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
                      onClick={() => {
                        setSelectedItem(item);
                        setMovementData(prev => ({ ...prev, movement_type: 'in' }));
                        setShowMovementModal(true);
                      }}
                      style={{ marginRight: '8px' }}
                    >
                      <FiShoppingCart /> Пополнить
                    </button>
                    <button 
                      className="btn-start"
                      onClick={() => {
                        setSelectedItem(item);
                        setMovementData(prev => ({ ...prev, movement_type: 'out' }));
                        setShowMovementModal(true);
                      }}
                      style={{ background: '#f39c12' }}
                    >
                      <FiMove /> Расход
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Основной инвентарь с фильтрацией */}
      {filteredItems.length > 0 && (
        <div className="requests-sections">
          <div className="requests-section">
            <h2>
              {filters.showLowStockOnly ? 'Товары с низким остатком' : 'Инвентарь'} 
              ({filteredItems.length})
              {activeFiltersCount > 0 && (
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: 'normal', 
                  color: '#666',
                  marginLeft: '8px'
                }}>
                  • фильтров активно: {activeFiltersCount}
                </span>
              )}
            </h2>
            <div className="requests-list">
              {filteredItems.map(item => {
                const stockStatus = getStockStatus(item);
                return (
                  <div key={item.id} className="request-card">
                    <div className="request-header">
                      <div className="request-type">
                        <FiPackage style={{ color: stockStatus.color }} />
                        <span>{item.category || 'Товар'}</span>
                      </div>
                      <div 
                        className="priority"
                        style={{ color: stockStatus.color }}
                      >
                        {stockStatus.text}
                      </div>
                    </div>
                    
                    <h4>{item.name}</h4>
                    <div className="request-details">
                      <div className="request-room">
                        <FiBox />
                        Остаток: {item.current_stock} {item.unit}
                      </div>
                      <div className="request-client">
                        <FiBarChart2 />
                        Стоимость: {formatCurrency(item.current_stock * (item.cost_per_unit || 0))}
                      </div>
                    </div>
                    
                    {item.description && (
                      <div className="request-description">{item.description}</div>
                    )}
                    
                    <div className="request-meta">
                      <div className="request-time">
                        <FiCalendar />
                        {item.updated_at ? formatDate(item.updated_at) : 'Давно'}
                      </div>
                      <div className="request-created">
                        {item.cost_per_unit ? `${formatCurrency(item.cost_per_unit)}/${item.unit}` : 'Цена не указана'}
                      </div>
                    </div>
                    
                    <div className="request-actions">
                      <button 
                        className="btn-start"
                        onClick={() => {
                          setSelectedItem(item);
                          setMovementData(prev => ({ ...prev, movement_type: 'in' }));
                          setShowMovementModal(true);
                        }}
                        style={{ marginRight: '8px', background: '#27ae60' }}
                      >
                        <FiPlus /> Приход
                      </button>
                      <button 
                        className="btn-start"
                        onClick={() => {
                          setSelectedItem(item);
                          setMovementData(prev => ({ ...prev, movement_type: 'out' }));
                          setShowMovementModal(true);
                        }}
                        style={{ background: '#e74c3c' }}
                      >
                        <FiMove /> Расход
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Сообщение когда нет результатов по фильтрам */}
      {filteredItems.length === 0 && inventoryItems.length > 0 && activeFiltersCount > 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#666'
        }}>
          <FiPackage size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3>Товары не найдены</h3>
          <p>По выбранным фильтрам товары не найдены. Попробуйте изменить критерии поиска.</p>
          <button 
            onClick={clearFilters}
            className="btn-start"
            style={{ marginTop: '16px', background: '#3498db' }}
          >
            <FiX /> Очистить фильтры
          </button>
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
                  
                  <div className="request-actions">
                    {task.status === 'assigned' && (
                      <button 
                        className="btn-start"
                        onClick={() => startSupplyTask(task)}
                        style={{ marginRight: '8px' }}
                      >
                        <FiPlay /> Начать
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button 
                        className="btn-start"
                        onClick={() => completeSupplyTask(task.id)}
                        style={{ background: '#27ae60' }}
                      >
                        <FiCheckCircle /> Завершить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления товара */}
      <Modal 
        isOpen={showAddItemModal} 
        onClose={() => setShowAddItemModal(false)}
        title="Добавить товар"
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label>Название *</label>
            <input
              type="text"
              value={newItem.name}
              onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Название товара"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          
          <div>
            <label>Описание</label>
            <textarea
              value={newItem.description}
              onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Описание товара"
              rows={3}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label>Категория</label>
              <input
                type="text"
                value={newItem.category}
                onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Категория"
                list="categories"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <datalist id="categories">
                {allCategories.map(category => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            
            <div>
              <label>Артикул</label>
              <input
                type="text"
                value={newItem.sku}
                onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="SKU"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label>Единица измерения *</label>
              <select
                value={newItem.unit}
                onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="шт">штуки</option>
                <option value="кг">килограммы</option>
                <option value="л">литры</option>
                <option value="м">метры</option>
                <option value="м2">кв. метры</option>
                <option value="упак">упаковки</option>
              </select>
            </div>
            
            <div>
              <label>Мин. остаток</label>
              <input
                type="number"
                value={newItem.min_stock}
                onChange={(e) => setNewItem(prev => ({ ...prev, min_stock: e.target.value }))}
                min="0"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label>Макс. остаток</label>
              <input
                type="number"
                value={newItem.max_stock || ''}
                onChange={(e) => setNewItem(prev => ({ ...prev, max_stock: e.target.value || null }))}
                min="0"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label>Цена за единицу</label>
              <input
                type="number"
                value={newItem.cost_per_unit || ''}
                onChange={(e) => setNewItem(prev => ({ ...prev, cost_per_unit: e.target.value || null }))}
                min="0"
                step="0.01"
                placeholder="0.00"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label>Начальный остаток</label>
              <input
                type="number"
                value={newItem.current_stock}
                onChange={(e) => setNewItem(prev => ({ ...prev, current_stock: e.target.value }))}
                min="0"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>
          
          <div>
            <label>Поставщик</label>
            <input
              type="text"
              value={newItem.supplier}
              onChange={(e) => setNewItem(prev => ({ ...prev, supplier: e.target.value }))}
              placeholder="Название поставщика"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          
          <div>
            <label>Контакт поставщика</label>
            <input
              type="text"
              value={newItem.supplier_contact}
              onChange={(e) => setNewItem(prev => ({ ...prev, supplier_contact: e.target.value }))}
              placeholder="Телефон, email"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button 
              onClick={() => setShowAddItemModal(false)}
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
              onClick={handleAddItem}
              className="btn-start"
              style={{ background: '#27ae60' }}
            >
              <FiPlus /> Добавить
            </button>
          </div>
        </div>
      </Modal>

      {/* Модальное окно движения товара */}
      <Modal 
        isOpen={showMovementModal} 
        onClose={() => {
          setShowMovementModal(false);
          setSelectedItem(null);
          setMovementData({
            movement_type: 'in',
            quantity: '',
            unit_cost: '',
            reason: '',
            notes: ''
          });
        }}
        title={`${movementData.movement_type === 'in' ? 'Поступление' : 'Расход'}: ${selectedItem?.name || ''}`}
      >
        {selectedItem && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div><strong>Товар:</strong> {selectedItem.name}</div>
              <div><strong>Текущий остаток:</strong> {selectedItem.current_stock} {selectedItem.unit}</div>
              <div><strong>Минимум:</strong> {selectedItem.min_stock} {selectedItem.unit}</div>
            </div>
            
            <div>
              <label>Тип движения</label>
              <select
                value={movementData.movement_type}
                onChange={(e) => setMovementData(prev => ({ ...prev, movement_type: e.target.value }))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="in">Поступление</option>
                <option value="out">Расход</option>
                <option value="adjustment">Корректировка</option>
                <option value="writeoff">Списание</option>
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label>Количество *</label>
                <input
                  type="number"
                  value={movementData.quantity}
                  onChange={(e) => setMovementData(prev => ({ ...prev, quantity: e.target.value }))}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              
              <div>
                <label>Цена за единицу</label>
                <input
                  type="number"
                  value={movementData.unit_cost}
                  onChange={(e) => setMovementData(prev => ({ ...prev, unit_cost: e.target.value }))}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>
            
            <div>
              <label>Причина</label>
              <input
                type="text"
                value={movementData.reason}
                onChange={(e) => setMovementData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Причина движения"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label>Примечания</label>
              <textarea
                value={movementData.notes}
                onChange={(e) => setMovementData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Дополнительные примечания"
                rows={3}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            {movementData.quantity && (
              <div style={{ padding: '12px', background: '#e8f5e8', borderRadius: '8px' }}>
                <div><strong>Новый остаток будет:</strong> {
                  selectedItem.current_stock + 
                  (movementData.movement_type === 'out' ? -Math.abs(Number(movementData.quantity)) : Math.abs(Number(movementData.quantity)))
                } {selectedItem.unit}</div>
                {movementData.unit_cost && (
                  <div><strong>Общая стоимость:</strong> {formatCurrency(Number(movementData.quantity) * Number(movementData.unit_cost))}</div>
                )}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                onClick={() => {
                  setShowMovementModal(false);
                  setSelectedItem(null);
                  setMovementData({
                    movement_type: 'in',
                    quantity: '',
                    unit_cost: '',
                    reason: '',
                    notes: ''
                  });
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
                onClick={handleCreateMovement}
                className="btn-start"
                style={{ 
                  background: movementData.movement_type === 'in' ? '#27ae60' : '#e74c3c' 
                }}
              >
                <FiMove /> {movementData.movement_type === 'in' ? 'Оприходовать' : 'Списать'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InventoryCheck;