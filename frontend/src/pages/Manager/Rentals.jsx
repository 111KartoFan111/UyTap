import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiFilter, FiCalendar, FiUsers, FiHome, FiEye, FiEdit2, FiX, FiCheck, FiClock, FiLogIn, FiLogOut, FiDollarSign, FiCreditCard } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import RentalModal from './Floor/RentalModal';
import RentalDetailModal from './RentalDetailModal.jsx';
import { QuickPaymentPopup, PaymentManager } from '../../components/Payments';
import './Pages.css';



const Rentals = () => {
  const { rentals, properties, clients, utils } = useData();
  
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showRentalDetail, setShowRentalDetail] = useState(false);
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

  // Состояния для управления платежами
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
    unpaidCompletedRentals: 0,
    partiallyPaidRentals: 0
  });

  // Управление блокировкой прокрутки body
  useEffect(() => {
    const hasOpenModal = showRentalModal || showRentalDetail || showQuickPayment || showPaymentManager;
    
    if (hasOpenModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup при размонтировании компонента
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showRentalModal, showRentalDetail, showQuickPayment, showPaymentManager]);

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

    // Расширенные фильтры по статусу с учетом оплаты
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
          case 'unpaid_completed':
            return rental.checked_out && isUnpaid;
          case 'partially_paid':
            return isPartiallyPaid;
          case 'fully_paid':
            return isPaid;
          default:
            return true;
        }
      });
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(rental => rental.rental_type === typeFilter);
    }

    if (propertyFilter !== 'all') {
      filtered = filtered.filter(rental => rental.property_id === propertyFilter);
    }

    setFilteredRentals(filtered);
  };

  // Функция для открытия деталей аренды
  const handleViewRentalDetails = (rental) => {
    console.log('Opening rental details for:', rental);
    setSelectedRental(rental);
    setShowRentalDetail(true);
  };

  // Функция для быстрого платежа
  const handleQuickPayment = (rental, event) => {
    console.log('Opening quick payment for:', rental);
    event.stopPropagation(); // Предотвращаем всплытие события
    
    const rect = event.target.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY
    };
    
    setSelectedRentalForPayment({ 
      ...rental, 
      popupPosition: position,
      client: clientsList.find(c => c.id === rental.client_id),
      property: propertiesList.find(p => p.id === rental.property_id)
    });
    setShowQuickPayment(true);
  };

  // Функция для открытия полного менеджера платежей
  const handleOpenPaymentManager = (rental, event) => {
    console.log('Opening payment manager for:', rental);
    event.stopPropagation(); // Предотвращаем всплытие события
    
    setSelectedRentalForPayment({
      ...rental,
      client: clientsList.find(c => c.id === rental.client_id),
      property: propertiesList.find(p => p.id === rental.property_id)
    });
    setShowPaymentManager(true);
  };

  // Функция добавления платежа
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
      
      await loadData();
      
    } catch (error) {
      console.error('Payment failed:', error);
      utils.showError('Ошибка при добавлении платежа: ' + error.message);
      throw error;
    }
  };

  // Функция для определения статуса оплаты
  const getPaymentStatus = (rental) => {
    const paid = rental.paid_amount || 0;
    const total = rental.total_amount;
    
    if (paid === 0) return { status: 'unpaid', text: '❌ Не оплачено', color: 'text-red-600' };
    if (paid < total) return { status: 'partial', text: '⚠️ Частично', color: 'text-yellow-600' };
    return { status: 'paid', text: '✅ Оплачено', color: 'text-green-600' };
  };

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

// frontend/src/pages/Manager/Rentals.jsx - Исправленная функция продления

  const handleExtendRental = async (rental, days) => {
    try {
      // Находим помещение для получения тарифов
      const property = propertiesList.find(p => p.id === rental.property_id);
      
      if (!property) {
        utils.showError('Не удалось найти информацию о помещении');
        return;
      }

      // Умная логика расчета стоимости продления
      let additionalAmount = 0;
      let calculationMethod = '';

      if (days === 30 && property.monthly_rate) {
        // Продление на месяц - используем месячный тариф
        additionalAmount = property.monthly_rate;
        calculationMethod = `месячный тариф ₸${property.monthly_rate.toLocaleString()}`;
      } else if (days === 7 && property.weekly_rate) {
        // Продление на неделю - используем недельный тариф
        additionalAmount = property.weekly_rate;
        calculationMethod = `недельный тариф ₸${property.weekly_rate.toLocaleString()}`;
      } else if (days === 1 && property.daily_rate) {
        // Продление на день - используем дневной тариф
        additionalAmount = property.daily_rate;
        calculationMethod = `дневной тариф ₸${property.daily_rate.toLocaleString()}`;
      } else {
        // Расчет по дням на основе оригинального типа аренды
        let baseRate = 0;
        
        if (rental.rental_type === 'daily') {
          baseRate = property.daily_rate || rental.rate;
          calculationMethod = `${days} дн. × ₸${baseRate.toLocaleString()} (дневной тариф)`;
        } else if (rental.rental_type === 'hourly') {
          baseRate = property.hourly_rate || rental.rate;
          additionalAmount = baseRate * 24 * days; // часы × дни
          calculationMethod = `${days} дн. × 24 ч. × ₸${baseRate.toLocaleString()} (часовой тариф)`;
        } else if (rental.rental_type === 'monthly') {
          baseRate = property.monthly_rate || rental.rate;
          additionalAmount = (baseRate / 30) * days; // пропорционально от месячного тарифа
          calculationMethod = `${days} дн. от месячного тарифа ₸${baseRate.toLocaleString()}`;
        } else if (rental.rental_type === 'weekly') {
          baseRate = property.weekly_rate || rental.rate;
          additionalAmount = (baseRate / 7) * days; // пропорционально от недельного тарифа
          calculationMethod = `${days} дн. от недельного тарифа ₸${baseRate.toLocaleString()}`;
        } else {
          // Fallback на дневной тариф
          baseRate = property.daily_rate || rental.rate || 0;
          calculationMethod = `${days} дн. × ₸${baseRate.toLocaleString()} (базовый тариф)`;
        }
        
        if (additionalAmount === 0 && baseRate > 0) {
          additionalAmount = baseRate * days;
        }
      }
      
      if (additionalAmount <= 0) {
        utils.showError('Не удалось определить стоимость продления. Проверьте тарифы.');
        return;
      }

      const periodText = days === 30 ? '1 месяц' : days === 7 ? '1 неделю' : `${days} дн.`;

      // Подтверждение с пользователем
      const confirmed = confirm(
        `Продлить аренду на ${periodText}?\n\n` +
        `Расчет: ${calculationMethod}\n` +
        `Доплата: ₸${additionalAmount.toLocaleString()}\n\n` +
        `Клиенту будет создан платеж для оплаты продления.`
      );
      
      if (!confirmed) return;
      
      const currentEndDate = new Date(rental.end_date);
      const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);
      
      // Отправляем запрос на продление с доплатой
      const response = await fetch(`http://localhost:8000/api/rentals/${rental.id}/extend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_end_date: newEndDate.toISOString(),
          additional_amount: additionalAmount,
          payment_method: 'cash',
          payment_notes: `Продление на ${periodText} (${calculationMethod})`
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось продлить аренду');
      }
      
      const result = await response.json();
      
      // Обновляем локальное состояние
      setRentalsList(prev => prev.map(r => 
        r.id === rental.id 
          ? { 
              ...r, 
              end_date: newEndDate.toISOString(),
              total_amount: r.total_amount + additionalAmount
              // НЕ обновляем paid_amount, так как платеж еще не оплачен!
            }
          : r
      ));
      
      utils.showSuccess(
        `Аренда продлена на ${periodText} до ${newEndDate.toLocaleDateString()}!\n` +
        `Создан платеж на доплату: ₸${additionalAmount.toLocaleString()}`
      );
      
      // Перезагружаем данные, чтобы отобразить новый платеж в интерфейсе
      await loadData();
      
    } catch (error) {
      console.error('Failed to extend rental:', error);
      utils.showError('Не удалось продлить аренду: ' + error.message);
    }
  };

    // Также добавляем функцию для оплаты продления
    const handlePayExtension = async (rental, paymentId, amount) => {
      try {
        const response = await fetch(
          `http://localhost:8000/api/rentals/${rental.id}/extension/${paymentId}/pay`, 
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              payment_amount: amount,
              payment_method: 'cash',
              payment_type: 'additional',
              auto_complete: true,
              notes: 'Доплата за продление аренды'
            })
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Не удалось оплатить продление');
        }
        
        utils.showSuccess(`Доплата за продление оплачена: ₸${amount.toLocaleString()}`);
        
        // Перезагружаем данные
        await loadData();
        
      } catch (error) {
        console.error('Failed to pay extension:', error);
        utils.showError('Не удалось оплатить продление: ' + error.message);
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

  // Обновленные опции фильтров с фильтрами по оплате
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
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
              console.log('Opening new rental modal');
              setSelectedRental(null);
              setShowRentalModal(true);
            }}
          >
            <FiPlus /> Новая аренда
          </button>
        </div>
      </div>
      
      {/* Обновленная статистика с показателями оплаты */}
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
                        <div className="payment-progress">
                          <div className="progress-bar" style={{ 
                            width: '100%', 
                            height: '4px', 
                            backgroundColor: '#e5e7eb', 
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div 
                              className="progress-fill"
                              style={{ 
                                width: `${Math.min(((rental.paid_amount || 0) / rental.total_amount) * 100, 100)}%`,
                                height: '100%',
                                backgroundColor: paymentStatus.status === 'paid' ? '#10b981' : 
                                                paymentStatus.status === 'partial' ? '#f59e0b' : '#ef4444',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="rental-actions" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {/* Кнопки для работы с платежами */}
                        {outstanding > 0 && (
                          <>
                            <button 
                              className="btn-icon payment-manager"
                              onClick={(e) => handleOpenPaymentManager(rental, e)}
                              title="Управление платежами"
                              style={{
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              <FiCreditCard />
                            </button>
                          </>
                        )}
                        
                        {/* Кнопка подробнее */}
                        <button 
                          className="btn-icon view"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRentalDetails(rental);
                          }}
                          title="Подробная информация"
                          style={{
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            padding: '8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          <FiEye />
                        </button>
                        
                        {/* Существующие кнопки действий */}
                        {status === 'pending_checkin' && (
                          <button 
                            className="btn-icon checkin"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckIn(rental);
                            }}
                            title="Заселить"
                            style={{
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              padding: '8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            <FiLogIn />
                          </button>
                        )}
                        
                        {status === 'active' && (
                          <>
                            <button 
                              className="btn-icon checkout"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckOut(rental);
                              }}
                              title="Выселить"
                              style={{
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              <FiLogOut />
                            </button>
                            <button 
                              className="btn-icon extend"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExtendRental(rental, 1);
                              }}
                              title="Продлить на 1 день"
                              style={{
                                backgroundColor: '#8b5cf6',
                                color: 'white',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              <FiClock />
                            </button>
                          </>
                        )}
                        {rental.is_active && (
                          <button 
                            className="btn-icon cancel"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelRental(rental);
                            }}
                            title="Отменить"
                            style={{
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              padding: '8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
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

      {/* Быстрые действия для проблемных оплат */}
      {(stats.unpaidCompletedRentals > 0 || stats.partiallyPaidRentals > 0) && (
        <div className="payment-alerts" style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#92400e' }}>⚠️ Требуют внимания:</h3>
          <div className="alert-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {stats.unpaidCompletedRentals > 0 && (
              <button 
                className="alert-btn critical"
                onClick={() => setStatusFilter('unpaid_completed')}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🔴 {stats.unpaidCompletedRentals} завершенных без оплаты
              </button>
            )}
            {stats.partiallyPaidRentals > 0 && (
              <button 
                className="alert-btn warning"
                onClick={() => setStatusFilter('partially_paid')}
                style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🟡 {stats.partiallyPaidRentals} частично оплаченных
              </button>
            )}
          </div>
        </div>
      )}

      {/* Модальные окна */}
      {showQuickPayment && selectedRentalForPayment && (
        <div 
          className="quick-payment-overlay"
          onClick={() => {
            console.log('Closing quick payment popup via overlay');
            setShowQuickPayment(false);
            setSelectedRentalForPayment(null);
          }}
        >
          <QuickPaymentPopup
            rental={selectedRentalForPayment}
            position={selectedRentalForPayment.popupPosition}
            onClose={() => {
              console.log('Closing quick payment popup');
              setShowQuickPayment(false);
              setSelectedRentalForPayment(null);
            }}
            onPaymentAdd={handlePaymentAdd}
          />
        </div>
      )}

      {/* Полный менеджер платежей */}
      {showPaymentManager && selectedRentalForPayment && (
        <div className="modal-overlay">
          <PaymentManager
            rental={selectedRentalForPayment}
            onClose={() => {
              console.log('Closing payment manager');
              setShowPaymentManager(false);
              setSelectedRentalForPayment(null);
            }}
            onPaymentUpdate={(updatedRental) => {
              console.log('Payment updated:', updatedRental);
              const updateRental = (rental) => {
                if (rental.id === updatedRental.id) {
                  return updatedRental;
                }
                return rental;
              };
              
              setRentalsList(prev => prev.map(updateRental));
              setFilteredRentals(prev => prev.map(updateRental));
              
              loadData();
            }}
          />
        </div>
      )}

      {/* Модальное окно создания/редактирования аренды */}
      {showRentalModal && (
        <div className="modal-overlay">
          <RentalModal
            rental={selectedRental}
            room={selectedProperty}
            onClose={() => {
              console.log('Closing rental modal');
              setShowRentalModal(false);
              setSelectedRental(null);
              setSelectedProperty(null);
            }}
            onSubmit={selectedRental ? handleUpdateRental : handleCreateRental}
          />
        </div>
      )}

      {/* Модальное окно деталей аренды */}
      {showRentalDetail && selectedRental && (
        <div className="modal-overlay">
          <RentalDetailModal
            rental={selectedRental}
            onClose={() => {
              console.log('Closing rental detail modal');
              setShowRentalDetail(false);
              setSelectedRental(null);
            }}
            onPaymentUpdate={(updatedRental) => {
              console.log('Payment updated from detail modal:', updatedRental);
              const updateRental = (rental) => {
                if (rental.id === updatedRental.id) {
                  return updatedRental;
                }
                return rental;
              };
              
              setRentalsList(prev => prev.map(updateRental));
              setFilteredRentals(prev => prev.map(updateRental));
              
              loadData();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Rentals;