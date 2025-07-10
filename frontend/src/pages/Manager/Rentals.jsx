import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiFilter, FiCalendar, FiUsers, FiHome, FiEye, FiEdit2, FiX, FiCheck, FiClock, FiLogIn, FiLogOut } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import RentalModal from './Floor/RentalModal';
import './Pages.css';

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
  
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  
  const [stats, setStats] = useState({
    totalRentals: 0,
    activeRentals: 0,
    pendingCheckIn: 0,
    pendingCheckOut: 0,
    totalRevenue: 0,
    occupancyRate: 0
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
      occupancyRate
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

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(rental => {
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
          default:
            return true;
        }
      });
    }

    // Фильтр по типу аренды
    if (typeFilter !== 'all') {
      filtered = filtered.filter(rental => rental.rental_type === typeFilter);
    }

    // Фильтр по помещению
    if (propertyFilter !== 'all') {
      filtered = filtered.filter(rental => rental.property_id === propertyFilter);
    }

    setFilteredRentals(filtered);
  };

  const handleCreateRental = async (rentalData) => {
    try {
      const newRental = await rentals.create(rentalData);
      setRentalsList(prev => [newRental, ...prev]);
      setShowRentalModal(false);
      setSelectedProperty(null);
      loadData(); // Перезагружаем для обновления статистики
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

  const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: 'active', label: 'Активные' },
    { value: 'pending_checkin', label: 'Ожидают заселения' },
    { value: 'checked_in', label: 'Заселены' },
    { value: 'completed', label: 'Завершенные' },
    { value: 'expired', label: 'Просроченные' }
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
      
      {/* Статистика */}
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
                <th>Сумма</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredRentals.map(rental => {
                const client = clientsList.find(c => c.id === rental.client_id);
                const property = propertiesList.find(p => p.id === rental.property_id);
                const status = getRentalStatus(rental);
                
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
                      <span className={`status-badge ${status}`}>
                        {getStatusDisplayName(status)}
                      </span>
                    </td>
                    <td>
                      <div className="amount-info">
                        <div className="total-amount">
                          ₸ {rental.total_amount.toLocaleString()}
                        </div>
                        <div className="paid-amount">
                          Оплачено: ₸ {rental.paid_amount.toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="rental-actions">
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