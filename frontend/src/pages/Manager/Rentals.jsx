// frontend/src/pages/Manager/Rentals.jsx - УЛУЧШЕННАЯ ВЕРСИЯ
import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiFilter, FiCalendar, FiUsers, FiHome, FiEye, FiEdit2, FiX, FiCheck, FiClock, FiLogIn, FiLogOut, FiDollarSign, FiCreditCard } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import RentalModal from './Floor/RentalModal';
import './Pages.css';
import QuickPaymentPopup from '../../components/Payments/QuickPaymentPopup';
import { PaymentManager } from '../../components/Payments';

const Rentals = () => {
  const { rentals, properties, clients, utils } = useData();
  
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [selectedRental, setSelectedRental] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  
  const [rentalsList, setRentalsList] = useState([]);
  const [filteredRentals, setFilteredRentals] = useState([]);
  const [propertiesList, setPropertiesList] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');

  // 🆕 Состояния для управления платежами
  const [showQuickPayment, setShowQuickPayment] = useState(false);
  const [showPaymentManager, setShowPaymentManager] = useState(false);
  const [selectedRentalForPayment, setSelectedRentalForPayment] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  
  const [stats, setStats] = useState({
    totalRentals: 0,
    activeRentals: 0,
    pendingCheckIn: 0,
    pendingCheckOut: 0,
    totalRevenue: 0,
    occupancyRate: 0,
    unpaidCompletedRentals: 0, // 🆕 Добавляем статистику по неоплаченным завершенным арендам
    partiallyPaidRentals: 0    // 🆕 Частично оплаченные аренды
  });

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadData();
  }, [currentPage]);

  // Фильтрация при изменении поисковых параметров
  useEffect(() => {
    filterRentals();
  }, [rentalsList, searchTerm, statusFilter, typeFilter, propertyFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Загружаем данные параллельно
      const [rentalsData, propertiesData, clientsData] = await Promise.allSettled([
        rentals.getAll({
          skip: (currentPage - 1) * pageSize,
          limit: pageSize
        }),
        properties.getAll(),
        clients.getAll({ limit: 1000 })
      ]);

      const rentalsResult = rentalsData.status === 'fulfilled' ? rentalsData.value : [];
      const propertiesResult = propertiesData.status === 'fulfilled' ? propertiesData.value : [];
      const clientsResult = clientsData.status === 'fulfilled' ? clientsData.value : [];

      setRentalsList(rentalsResult);
      setPropertiesList(propertiesResult);
      setClientsList(clientsResult);
      
      calculateStats(rentalsResult, propertiesResult);
      
    } catch (error) {
      console.error('Failed to load rentals data:', error);
      utils.showError('Не удалось загрузить данные об аренде');
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Улучшенная функция для открытия быстрого платежа
  const handleQuickPayment = (rental, event) => {
    const rect = event.target.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY
    };
    
    setSelectedRentalForPayment({ 
      ...rental, 
      popupPosition: position,
      // Добавляем информацию о клиенте и помещении для удобства
      client: clientsList.find(c => c.id === rental.client_id),
      property: propertiesList.find(p => p.id === rental.property_id)
    });
    setShowQuickPayment(true);
  };

  // 🆕 Функция для открытия полного менеджера платежей
  const handleOpenPaymentManager = (rental) => {
    setSelectedRentalForPayment({
      ...rental,
      client: clientsList.find(c => c.id === rental.client_id),
      property: propertiesList.find(p => p.id === rental.property_id)
    });
    setShowPaymentManager(true);
  };

  // 🆕 Улучшенный метод добавления платежа с лучшей обработкой ошибок
  const handlePaymentAdd = async (rentalId, paymentData) => {
    try {
      const response = await fetch(`http://localhost:8000/api/rentals/${rentalId}/payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Payment failed');
      }

      const updatedAmount = paymentData.payment_amount;
      
      // Обновляем локальное состояние
      const updateRental = (rental) => {
        if (rental.id === rentalId) {
          return {
            ...rental,
            paid_amount: (rental.paid_amount || 0) + updatedAmount
          };
        }
        return rental;
      };
      
      setRentalsList(prev => prev.map(updateRental));
      setFilteredRentals(prev => prev.map(updateRental));

      utils.showSuccess(`Платеж ₸${updatedAmount.toLocaleString()} добавлен!`);
      
      // Перезагружаем данные для обновления статистики
      await loadData();
      
    } catch (error) {
      console.error('Payment failed:', error);
      utils.showError('Ошибка при добавлении платежа: ' + error.message);
      throw error;
    }
  };

  // 🆕 Обновление статистики с учетом платежей
  const calculateStats = (rentalsData, propertiesData) => {
    const now = new Date();
    const totalRentals = rentalsData.length;
    const activeRentals = rentalsData.filter(rental => rental.is_active).length;
    
    const pendingCheckIn = rentalsData.filter(rental => 
      rental.is_active && !rental.checked_in
    ).length;
    
    const pendingCheckOut = rentalsData.filter(rental => 
      rental.is_active && rental.checked_in && !rental.checked_out &&
      new Date(rental.end_date) <= now
    ).length;
    
    const totalRevenue = rentalsData.reduce((sum, rental) => 
      sum + (rental.paid_amount || 0), 0
    );
    
    // 🆕 Подсчитываем проблемные аренды с оплатой
    const unpaidCompletedRentals = rentalsData.filter(rental => 
      rental.checked_out && (rental.paid_amount || 0) === 0
    ).length;
    
    const partiallyPaidRentals = rentalsData.filter(rental => 
      (rental.paid_amount || 0) > 0 && (rental.paid_amount || 0) < rental.total_amount
    ).length;
    
    const occupiedProperties = propertiesData.filter(prop => 
      prop.status === 'occupied'
    ).length;
    const occupancyRate = propertiesData.length > 0 
      ? Math.round((occupiedProperties / propertiesData.length) * 100)
      : 0;

    setStats({
      totalRentals,
      activeRentals,
      pendingCheckIn,
      pendingCheckOut,
      totalRevenue,
      occupancyRate,
      unpaidCompletedRentals,
      partiallyPaidRentals
    });
  };

  const filterRentals = () => {
    let filtered = rentalsList;

    // Фильтр по поисковому запросу
    if (searchTerm) {
      filtered = filtered.filter(rental => {
        const client = clientsList.find(c => c.id === rental.client_id);
        const property = propertiesList.find(p => p.id === rental.property_id);
        
        const clientName = client ? `${client.first_name} ${client.last_name}` : '';
        const propertyNumber = property ? property.number : '';
        
        return (
          clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          propertyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rental.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // 🆕 Расширенные фильтры по статусу с учетом оплаты
    if (statusFilter !== 'all') {
      filtered = filtered.filter(rental => {
        const isPaid = (rental.paid_amount || 0) >= rental.total_amount;
        const isPartiallyPaid = (rental.paid_amount || 0) > 0 && (rental.paid_amount || 0) < rental.total_amount;
        const isUnpaid = (rental.paid_amount || 0) === 0;
        
        switch (statusFilter) {
          case 'active':
            return rental.is_active;
          case 'pending_checkin':
            return rental.is_active && !rental.checked_in;
          case 'checked_in':
            return rental.checked_in && !rental.checked_out;
          case 'completed':
            return rental.checked_out;
          case 'expired':
            return rental.is_active && new Date(rental.end_date) < new Date();
          case 'unpaid_completed': // 🆕 Новый фильтр
            return rental.checked_out && isUnpaid;
          case 'partially_paid': // 🆕 Новый фильтр
            return isPartiallyPaid;
          case 'fully_paid': // 🆕 Новый фильтр
            return isPaid;
          default:
            return true;
        }
      });
    }

    // Остальные фильтры...
    if (typeFilter !== 'all') {
      filtered = filtered.filter(rental => rental.rental_type === typeFilter);
    }

    if (propertyFilter !== 'all') {
      filtered = filtered.filter(rental => rental.property_id === propertyFilter);
    }

    setFilteredRentals(filtered);
  };

  // 🆕 Функция для определения статуса оплаты
  const getPaymentStatus = (rental) => {
    const paid = rental.paid_amount || 0;
    const total = rental.total_amount;
    
    if (paid === 0) return { status: 'unpaid', text: '❌ Не оплачено', color: 'text-red-600' };
    if (paid < total) return { status: 'partial', text: '⚠️ Частично', color: 'text-yellow-600' };
    return { status: 'paid', text: '✅ Оплачено', color: 'text-green-600' };
  };

  // Остальные функции остаются без изменений...
  const handleCreateRental = async (rentalData) => {
    try {
      const newRental = await rentals.create(rentalData);
      setRentalsList(prev => [newRental, ...prev]);
      setShowRentalModal(false);
      setSelectedProperty(null);
      loadData();
    } catch (error) {
      console.error('Failed to create rental:', error);
    }
  };

  const handleUpdateRental = async (rentalData) => {
    try {
      const updatedRental = await rentals.update(selectedRental.id, rentalData);
      setRentalsList(prev => prev.map(rental => 
        rental.id === selectedRental.id ? updatedRental : rental
      ));
      setShowRentalModal(false);
      setSelectedRental(null);
    } catch (error) {
      console.error('Failed to update rental:', error);
    }
  };

  const handleCheckIn = async (rental) => {
    try {
      await rentals.checkIn(rental.id);
      setRentalsList(prev => prev.map(r => 
        r.id === rental.id 
          ? { ...r, checked_in: true, check_in_time: new Date().toISOString() }
          : r
      ));
      utils.showSuccess('Заселение выполнено');
    } catch (error) {
      console.error('Failed to check in rental:', error);
    }
  };

  const handleCheckOut = async (rental) => {
    try {
      await rentals.checkOut(rental.id);
      setRentalsList(prev => prev.map(r => 
        r.id === rental.id 
          ? { 
              ...r, 
              checked_out: true, 
              check_out_time: new Date().toISOString(),
              is_active: false
            }
          : r
      ));
      utils.showSuccess('Выселение выполнено');
    } catch (error) {
      console.error('Failed to check out rental:', error);
    }
  };

  const handleExtendRental = async (rental, days) => {
    try {
      const currentEndDate = new Date(rental.end_date);
      const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);
      
      await rentals.update(rental.id, {
        end_date: newEndDate.toISOString()
      });
      
      setRentalsList(prev => prev.map(r => 
        r.id === rental.id 
          ? { ...r, end_date: newEndDate.toISOString() }
          : r
      ));
      
      utils.showSuccess(`Аренда продлена на ${days} дн.`);
    } catch (error) {
      console.error('Failed to extend rental:', error);
    }
  };

  const handleCancelRental = async (rental) => {
    const reason = prompt('Укажите причину отмены аренды:');
    if (!reason) return;

    try {
      await rentals.cancel(rental.id, reason);
      setRentalsList(prev => prev.filter(r => r.id !== rental.id));
      utils.showSuccess('Аренда отменена');
    } catch (error) {
      console.error('Failed to cancel rental:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRentalStatus = (rental) => {
    const now = new Date();
    const endDate = new Date(rental.end_date);
    
    if (rental.checked_out) return 'completed';
    if (rental.is_active && rental.checked_in && endDate < now) return 'expired';
    if (rental.is_active && rental.checked_in) return 'active';
    if (rental.is_active && !rental.checked_in) return 'pending_checkin';
    return 'inactive';
  };

  const getStatusDisplayName = (status) => {
    const statusNames = {
      'active': 'Активна',
      'pending_checkin': 'Ожидает заселения',
      'completed': 'Завершена',
      'expired': 'Просрочена',
      'inactive': 'Неактивна'
    };
    return statusNames[status] || status;
  };

  const getTypeDisplayName = (type) => {
    const typeNames = {
      'hourly': 'Почасовая',
      'daily': 'Посуточная',
      'weekly': 'Понедельная',
      'monthly': 'Помесячная',
      'yearly': 'Годовая'
    };
    return typeNames[type] || type;
  };

  // 🆕 Обновленные опции фильтров с фильтрами по оплате
  const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: 'active', label: 'Активные' },
    { value: 'pending_checkin', label: 'Ожидают заселения' },
    { value: 'checked_in', label: 'Заселены' },
    { value: 'completed', label: 'Завершенные' },
    { value: 'expired', label: 'Просроченные' },
    { value: 'unpaid_completed', label: '🔴 Завершенные без оплаты' },
    { value: 'partially_paid', label: '🟡 Частично оплаченные' },
    { value: 'fully_paid', label: '🟢 Полностью оплаченные' }
  ];

  const typeOptions = [
    { value: 'all', label: 'Все типы' },
    { value: 'hourly', label: 'Почасовая' },
    { value: 'daily', label: 'Посуточная' },
    { value: 'weekly', label: 'Понедельная' },
    { value: 'monthly', label: 'Помесячная' },
    { value: 'yearly', label: 'Годовая' }
  ];

  if (loading) {
    return (
      <div className="rentals-page loading">
        <div className="loading-spinner"></div>
        <p>Загрузка данных об аренде...</p>
      </div>
    );
  }

  return (
    <div className="rentals-page">
      <div className="page-header">
        <h1>Управление арендой</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Поиск по клиенту, номеру..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="clear-search"
                onClick={() => setSearchTerm('')}
              >
                <FiX />
              </button>
            )}
          </div>
          
          <div className="filter-group">
            <FiFilter />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <FiHome />
            <select 
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
            >
              <option value="all">Все помещения</option>
              {propertiesList.map(property => (
                <option key={property.id} value={property.id}>
                  {property.number} - {property.name}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            className="btn-primary"
            onClick={() => {
              setSelectedRental(null);
              setShowRentalModal(true);
            }}
          >
            <FiPlus /> Новая аренда
          </button>
        </div>
      </div>
      
      {/* 🆕 Обновленная статистика с показателями оплаты */}
      <div className="rentals-stats">
        <div className="stat-card">
          <h3>Всего аренд</h3>
          <div className="stat-number">{stats.totalRentals}</div>
        </div>
        <div className="stat-card">
          <h3>Активные аренды</h3>
          <div className="stat-number">{stats.activeRentals}</div>
        </div>
        <div className="stat-card">
          <h3>Ожидают заселения</h3>
          <div className="stat-number">{stats.pendingCheckIn}</div>
        </div>
        <div className="stat-card">
          <h3>Ожидают выселения</h3>
          <div className="stat-number">{stats.pendingCheckOut}</div>
        </div>
        <div className="stat-card">
          <h3>Общая выручка</h3>
          <div className="stat-number">₸ {stats.totalRevenue.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <h3>Загруженность</h3>
          <div className="stat-number">{stats.occupancyRate}%</div>
        </div>
        {/* 🆕 Новые карточки статистики */}
        {stats.unpaidCompletedRentals > 0 && (
          <div className="stat-card alert">
            <h3>🔴 Без оплаты</h3>
            <div className="stat-number">{stats.unpaidCompletedRentals}</div>
          </div>
        )}
        {stats.partiallyPaidRentals > 0 && (
          <div className="stat-card warning">
            <h3>🟡 Частично оплачено</h3>
            <div className="stat-number">{stats.partiallyPaidRentals}</div>
          </div>
        )}
      </div>

      {/* Таблица аренд */}
      <div className="rentals-table-wrapper">
        {filteredRentals.length > 0 ? (
          <table className="rentals-table">
            <thead>
              <tr>
                <th>Помещение</th>
                <th>Клиент</th>
                <th>Период</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Сумма/Оплата</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredRentals.map(rental => {
                const client = clientsList.find(c => c.id === rental.client_id);
                const property = propertiesList.find(p => p.id === rental.property_id);
                const status = getRentalStatus(rental);
                const paymentStatus = getPaymentStatus(rental);
                const outstanding = rental.total_amount - (rental.paid_amount || 0);
                
                return (
                  <tr key={rental.id}>
                    <td>
                      <div className="property-info">
                        <div className="property-number">
                          {property?.number || 'Не указано'}
                        </div>
                        <div className="property-name">
                          {property?.name || 'Помещение'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="client-info">
                        <div className="client-name">
                          {client ? `${client.first_name} ${client.last_name}` : 'Не указан'}
                        </div>
                        {client?.phone && (
                          <div className="client-phone">
                            {client.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="period-info">
                        <div className="period-dates">
                          {formatDate(rental.start_date)} - {formatDate(rental.end_date)}
                        </div>
                        {rental.checked_in && (
                          <div className="check-times">
                            Заселен: {formatDateTime(rental.check_in_time)}
                          </div>
                        )}
                        {rental.checked_out && (
                          <div className="check-times">
                            Выселен: {formatDateTime(rental.check_out_time)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`type-badge ${rental.rental_type}`}>
                        {getTypeDisplayName(rental.rental_type)}
                      </span>
                    </td>
                    <td>
                      <div className="status-column">
                        <span className={`status-badge ${status}`}>
                          {getStatusDisplayName(status)}
                        </span>
                        {/* 🆕 Добавляем статус оплаты */}
                        <span className={`payment-status ${paymentStatus.status}`}>
                          {paymentStatus.text}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="amount-info">
                        <div className="total-amount">
                          ₸ {rental.total_amount.toLocaleString()}
                        </div>
                        <div className="paid-amount">
                          Оплачено: ₸ {(rental.paid_amount || 0).toLocaleString()}
                        </div>
                        {outstanding > 0 && (
                          <div className="outstanding-amount" style={{ color: '#ef4444', fontWeight: 'bold' }}>
                            К доплате: ₸ {outstanding.toLocaleString()}
                          </div>
                        )}
                        {/* 🆕 Прогресс-бар оплаты */}
                        <div className="payment-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{ 
                                width: `${Math.min(((rental.paid_amount || 0) / rental.total_amount) * 100, 100)}%`,
                                backgroundColor: paymentStatus.status === 'paid' ? '#10b981' : 
                                                paymentStatus.status === 'partial' ? '#f59e0b' : '#ef4444'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="rental-actions">
                        {/* 🆕 Улучшенные кнопки для работы с платежами */}
                        {outstanding > 0 && (
                          <>
                            <button 
                              className={`btn-icon payment ${
                                rental.paid_amount === 0 ? 'critical' : 'warning'
                              }`}
                              onClick={(e) => handleQuickPayment(rental, e)}
                              title={`Быстрый платеж (₸${outstanding.toLocaleString()})`}
                              style={{
                                backgroundColor: rental.paid_amount === 0 ? '#dc2626' : '#d97706',
                                color: 'white',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginRight: '4px'
                              }}
                            >
                              <FiDollarSign />
                            </button>
                            <button 
                              className="btn-icon payment-manager"
                              onClick={() => handleOpenPaymentManager(rental)}
                              title="Управление платежами"
                              style={{
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginRight: '4px'
                              }}
                            >
                              <FiCreditCard />
                            </button>
                          </>
                        )}
                        
                        {/* Существующие кнопки действий */}
                        {status === 'pending_checkin' && (
                          <button 
                            className="btn-icon checkin"
                            onClick={() => handleCheckIn(rental)}
                            title="Заселить"
                          >
                            <FiLogIn />
                          </button>
                        )}
                        
                        {status === 'active' && (
                          <>
                            <button 
                              className="btn-icon checkout"
                              onClick={() => handleCheckOut(rental)}
                              title="Выселить"
                            >
                              <FiLogOut />
                            </button>
                            <button 
                              className="btn-icon extend"
                              onClick={() => handleExtendRental(rental, 1)}
                              title="Продлить на 1 день"
                            >
                              <FiClock />
                            </button>
                          </>
                        )}
                        
                        <button 
                          className="btn-icon view"
                          onClick={() => {
                            setSelectedRental(rental);
                            setShowRentalModal(true);
                          }}
                          title="Просмотр/Редактирование"
                        >
                          <FiEye />
                        </button>
                        
                        {rental.is_active && (
                          <button 
                            className="btn-icon cancel"
                            onClick={() => handleCancelRental(rental)}
                            title="Отменить"
                          >
                            <FiX />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="no-rentals">
            <div className="empty-state">
              <FiCalendar size={48} />
              <h3>
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || propertyFilter !== 'all'
                  ? 'Аренды не найдены' 
                  : 'Нет аренд'
                }
              </h3>
              <p>
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || propertyFilter !== 'all'
                  ? 'Попробуйте изменить условия поиска'
                  : 'Создайте первую аренду для начала работы'
                }
              </p>
              {(!searchTerm && statusFilter === 'all' && typeFilter === 'all' && propertyFilter === 'all') && (
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setSelectedRental(null);
                    setShowRentalModal(true);
                  }}
                >
                  <FiPlus /> Создать первую аренду
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🆕 Быстрые действия для проблемных оплат */}
      {(stats.unpaidCompletedRentals > 0 || stats.partiallyPaidRentals > 0) && (
        <div className="payment-alerts">
          <h3>⚠️ Требуют внимания:</h3>
          <div className="alert-actions">
            {stats.unpaidCompletedRentals > 0 && (
              <button 
                className="alert-btn critical"
                onClick={() => setStatusFilter('unpaid_completed')}
              >
                🔴 {stats.unpaidCompletedRentals} завершенных без оплаты
              </button>
            )}
            {stats.partiallyPaidRentals > 0 && (
              <button 
                className="alert-btn warning"
                onClick={() => setStatusFilter('partially_paid')}
              >
                🟡 {stats.partiallyPaidRentals} частично оплаченных
              </button>
            )}
          </div>
        </div>
      )}

      {/* Модальные окна */}
      {showQuickPayment && selectedRentalForPayment && (
        <QuickPaymentPopup
          rental={selectedRentalForPayment}
          position={selectedRentalForPayment.popupPosition}
          onClose={() => {
            setShowQuickPayment(false);
            setSelectedRentalForPayment(null);
          }}
          onPaymentAdd={handlePaymentAdd}
        />
      )}

      {/* 🆕 Полный менеджер платежей */}
      {showPaymentManager && selectedRentalForPayment && (
        <PaymentManager
          rental={selectedRentalForPayment}
          onClose={() => {
            setShowPaymentManager(false);
            setSelectedRentalForPayment(null);
          }}
          onPaymentUpdate={(updatedRental) => {
            // Обновляем аренду после изменения платежа
            const updateRental = (rental) => {
              if (rental.id === updatedRental.id) {
                return updatedRental;
              }
              return rental;
            };
            
            setRentalsList(prev => prev.map(updateRental));
            setFilteredRentals(prev => prev.map(updateRental));
            
            // Перезагружаем статистику
            loadData();
          }}
        />
      )}

      {showRentalModal && (
        <RentalModal
          rental={selectedRental}
          room={selectedProperty}
          onClose={() => {
            setShowRentalModal(false);
            setSelectedRental(null);
            setSelectedProperty(null);
          }}
          onSubmit={selectedRental ? handleUpdateRental : handleCreateRental}
        />
      )}
    </div>
  );
};

export default Rentals;