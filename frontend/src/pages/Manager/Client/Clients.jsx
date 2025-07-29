import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiFilter, FiEdit2, FiTrash2, FiEye, FiPhone, FiMail, FiX, FiDownload } from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';
import ClientModal from './ClientModal';
import '../Pages.css';

const Clients = () => {
  const { clients, utils } = useData();
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientsList, setClientsList] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClients: 0,
    newThisMonth: 0,
    activeRentals: 0,
    returningClients: 0
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadClients();
  }, [currentPage, searchTerm, sourceFilter]);

  // Фильтрация при изменении поисковых параметров
  useEffect(() => {
    if (searchTerm || sourceFilter !== 'all') {
      // Если есть фильтры, фильтруем локально
      filterClients();
    }
  }, [clientsList, searchTerm, sourceFilter]);

  const loadClients = async () => {
    try {
      setLoading(true);
      
      // Параметры для API
      const params = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize
      };

      // Добавляем поисковые параметры
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (sourceFilter !== 'all') {
        params.source = sourceFilter;
      }

      const clientsData = await clients.getAll(params);
      
      // Если это первая страница или нет фильтров, обновляем полный список
      if (currentPage === 1 || !searchTerm && sourceFilter === 'all') {
        setClientsList(clientsData);
        setFilteredClients(clientsData);
      } else {
        setFilteredClients(clientsData);
      }
      
      calculateStats(clientsData);
      
      // Рассчитываем общее количество страниц (примерно)
      setTotalPages(Math.ceil(clientsData.length / pageSize) || 1);
      
    } catch (error) {
      console.error('Failed to load clients:', error);
      utils.showError('Не удалось загрузить список клиентов');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (clientsData) => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const newThisMonth = clientsData.filter(client => 
      new Date(client.created_at) >= thisMonth
    ).length;

    const returningClients = clientsData.filter(client => 
      client.total_rentals > 1
    ).length;

    // Подсчет активных аренд
    const activeRentals = clientsData.reduce((total, client) => {
      return total + (client.active_rentals_count || 0);
    }, 0);

    setStats({
      totalClients: clientsData.length,
      newThisMonth,
      activeRentals,
      returningClients
    });
  };

  const filterClients = () => {
    let filtered = clientsList;

    // Фильтр по поисковому запросу
    if (searchTerm) {
      filtered = filtered.filter(client => 
        `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтр по источнику
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(client => client.source === sourceFilter);
    }

    setFilteredClients(filtered);
  };

  const handleCreateClient = async (clientData) => {
    try {
      const newClient = await clients.create(clientData);
      setClientsList(prev => [newClient, ...prev]);
      setShowClientModal(false);
      setSelectedClient(null);
      loadClients(); // Перезагружаем для обновления статистики
    } catch (error) {
      console.error('Failed to create client:', error);
    }
  };

  const handleUpdateClient = async (clientData) => {
    try {
      const updatedClient = await clients.update(selectedClient.id, clientData);
      setClientsList(prev => prev.map(client => 
        client.id === selectedClient.id ? updatedClient : client
      ));
      setFilteredClients(prev => prev.map(client => 
        client.id === selectedClient.id ? updatedClient : client
      ));
      setShowClientModal(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Failed to update client:', error);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!confirm('Вы уверены, что хотите удалить этого клиента?')) return;

    try {
      await clients.delete(clientId);
      setClientsList(prev => prev.filter(client => client.id !== clientId));
      setFilteredClients(prev => prev.filter(client => client.id !== clientId));
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setShowClientModal(true);
  };

  const handleViewClient = async (client) => {
    try {
      // Загрузить полную информацию о клиенте
      const fullClientData = await clients.getById(client.id);
      // Здесь можно открыть модальное окно с подробной информацией
      console.log('Full client data:', fullClientData);
    } catch (error) {
      console.error('Failed to load client details:', error);
      utils.showError('Не удалось загрузить детали клиента');
    }
  };

  const handleBulkImport = async () => {
    // Здесь можно добавить функционал импорта
    console.log('Bulk import functionality');
  };

  const handleExport = async () => {
    try {
      // Экспорт данных клиентов
      const exportData = filteredClients.map(client => ({
        'ФИО': `${client.first_name} ${client.last_name}`,
        'Телефон': client.phone || '',
        'Email': client.email || '',
        'Источник': getSourceDisplayName(client.source),
        'Дата регистрации': formatDate(client.created_at),
        'Общее количество аренд': client.total_rentals || 0,
        'Общая сумма': client.total_spent || 0
      }));

      // Простой экспорт в CSV
      const csvContent = [
        Object.keys(exportData[0]).join(','),
        ...exportData.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `clients_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      utils.showSuccess('Данные экспортированы успешно');
    } catch (error) {
      console.error('Failed to export clients:', error);
      utils.showError('Не удалось экспортировать данные');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getSourceDisplayName = (source) => {
    const sourceNames = {
      'walk-in': 'Прямое обращение',
      'phone': 'Звонок',
      'instagram': 'Instagram',
      'booking': 'Booking.com',
      'referral': 'Рекомендация',
      'website': 'Веб-сайт',
      'other': 'Другое'
    };
    return sourceNames[source] || source;
  };

  const sources = [
    { value: 'all', label: 'Все источники' },
    { value: 'walk-in', label: 'Прямое обращение' },
    { value: 'phone', label: 'Звонок' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'referral', label: 'Рекомендация' },
    { value: 'website', label: 'Веб-сайт' },
    { value: 'other', label: 'Другое' }
  ];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm || sourceFilter !== 'all') {
        setCurrentPage(1);
        loadClients();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, sourceFilter]);

  if (loading && currentPage === 1) {
    return (
      <div className="clients-page loading">
        <div className="loading-spinner"></div>
        <p>Загрузка клиентов...</p>
      </div>
    );
  }

  return (
    <div className="clients-page">
      <div className="page-header">
        <h1>База клиентов</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Поиск клиентов..."
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
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              {sources.map(source => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
          </div>

          <button 
            className="btn-outline"
            onClick={handleExport}
            disabled={filteredClients.length === 0}
          >
            <FiDownload /> Экспорт
          </button>
          
          <button 
            className="btn-primary"
            onClick={() => {
              setSelectedClient(null);
              setShowClientModal(true);
            }}
          >
            <FiPlus /> Добавить клиента
          </button>
        </div>
      </div>
      
      <div className="clients-stats">
        <div className="stat-card">
          <h3>Всего клиентов</h3>
          <div className="stat-number">{stats.totalClients}</div>
        </div>
        <div className="stat-card">
          <h3>Новые за месяц</h3>
          <div className="stat-number">{stats.newThisMonth}</div>
        </div>
        <div className="stat-card">
          <h3>Постоянные клиенты</h3>
          <div className="stat-number">{stats.returningClients}</div>
        </div>
        <div className="stat-card">
          <h3>Активные аренды</h3>
          <div className="stat-number">{stats.activeRentals}</div>
        </div>
      </div>

      <div className="clients-table-wrapper">
        {filteredClients.length > 0 ? (
          <>
            <table className="clients-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Контакты</th>
                  <th>Дата регистрации</th>
                  <th>Источник</th>
                  <th>Аренды</th>
                  <th>Потратил</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <div className="client-name">
                        {client.first_name} {client.last_name}
                        {client.middle_name && <span className="middle-name">{client.middle_name}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="client-contacts">
                        {client.phone && (
                          <div className="contact-item">
                            <FiPhone size={14} />
                            <a href={`tel:${client.phone}`}>{client.phone}</a>
                          </div>
                        )}
                        {client.email && (
                          <div className="contact-item">
                            <FiMail size={14} />
                            <a href={`mailto:${client.email}`}>{client.email}</a>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{formatDate(client.created_at)}</td>
                    <td>
                      <span className={`source-badge ${client.source}`}>
                        {getSourceDisplayName(client.source)}
                      </span>
                    </td>
                    <td>
                      <div className="rentals-info">
                        <span className="total-rentals">
                          Всего: {client.total_rentals || 0}
                        </span>
                        {client.last_visit && (
                          <span className="last-visit">
                            Последний: {formatDate(client.last_visit)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="spending-info">
                        ₸ {(client.total_spent || 0).toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon view"
                          onClick={() => handleViewClient(client)}
                          title="Просмотр"
                        >
                          <FiEye />
                        </button>
                        <button 
                          className="btn-icon edit"
                          onClick={() => handleEditClient(client)}
                          title="Редактировать"
                        >
                          <FiEdit2 />
                        </button>
                        <button 
                          className="btn-icon delete"
                          onClick={() => handleDeleteClient(client.id)}
                          title="Удалить"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  Предыдущая
                </button>
                
                <span className="pagination-info">
                  Страница {currentPage} из {totalPages}
                </span>
                
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Следующая
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="no-clients">
            <div className="empty-state">
              <FiSearch size={48} />
              <h3>
                {searchTerm || sourceFilter !== 'all' 
                  ? 'Клиенты не найдены' 
                  : 'Нет клиентов'
                }
              </h3>
              <p>
                {searchTerm || sourceFilter !== 'all'
                  ? 'Попробуйте изменить условия поиска'
                  : 'Добавьте первого клиента для начала работы'
                }
              </p>
              {(!searchTerm && sourceFilter === 'all') && (
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setSelectedClient(null);
                    setShowClientModal(true);
                  }}
                >
                  <FiPlus /> Добавить первого клиента
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showClientModal && (
        <ClientModal
          client={selectedClient}
          onClose={() => {
            setShowClientModal(false);
            setSelectedClient(null);
          }}
          onSubmit={selectedClient ? handleUpdateClient : handleCreateClient}
        />
      )}
    </div>
  );
};

export default Clients;