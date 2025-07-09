import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiFilter, FiEdit2, FiTrash2, FiEye, FiPhone, FiMail, FiX } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import ClientModal from './ClientModal';
import './Pages.css';

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
    activeRentals: 0
  });

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadClients();
  }, []);

  // Фильтрация при изменении поисковых параметров
  useEffect(() => {
    filterClients();
  }, [clientsList, searchTerm, sourceFilter]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const clientsData = await clients.getAll();
      setClientsList(clientsData);
      calculateStats(clientsData);
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

    // Подсчет активных аренд (если есть поле в данных клиента)
    const activeRentals = clientsData.filter(client => 
      client.active_rentals_count > 0
    ).length;

    setStats({
      totalClients: clientsData.length,
      newThisMonth,
      activeRentals
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
      utils.showSuccess('Клиент успешно создан');
    } catch (error) {
      console.error('Failed to create client:', error);
      utils.showError('Не удалось создать клиента');
    }
  };

  const handleUpdateClient = async (clientData) => {
    try {
      const updatedClient = await clients.update(selectedClient.id, clientData);
      setClientsList(prev => prev.map(client => 
        client.id === selectedClient.id ? updatedClient : client
      ));
      setShowClientModal(false);
      setSelectedClient(null);
      utils.showSuccess('Клиент обновлен');
    } catch (error) {
      console.error('Failed to update client:', error);
      utils.showError('Не удалось обновить клиента');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!confirm('Вы уверены, что хотите удалить этого клиента?')) return;

    try {
      await clients.delete(clientId);
      setClientsList(prev => prev.filter(client => client.id !== clientId));
      utils.showSuccess('Клиент удален');
    } catch (error) {
      console.error('Failed to delete client:', error);
      utils.showError('Не удалось удалить клиента');
    }
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setShowClientModal(true);
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
      'referral': 'Рекомендация'
    };
    return sourceNames[source] || source;
  };

  const sources = [
    { value: 'all', label: 'Все источники' },
    { value: 'walk-in', label: 'Прямое обращение' },
    { value: 'phone', label: 'Звонок' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'referral', label: 'Рекомендация' }
  ];

  if (loading) {
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
          <h3>С активными арендами</h3>
          <div className="stat-number">{stats.activeRentals}</div>
        </div>
      </div>

      <div className="clients-table-wrapper">
        {filteredClients.length > 0 ? (
          <table className="clients-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Контакты</th>
                <th>Последний визит</th>
                <th>Источник</th>
                <th>Аренды</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id}>
                  <td>
                    <div className="client-name">
                      {client.first_name} {client.last_name}
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
                  <td>{formatDate(client.last_visit_date)}</td>
                  <td>
                    <span className={`source-badge ${client.source}`}>
                      {getSourceDisplayName(client.source)}
                    </span>
                  </td>
                  <td>
                    <div className="rentals-info">
                      <span className="active-rentals">
                        Активных: {client.active_rentals_count || 0}
                      </span>
                      <span className="total-rentals">
                        Всего: {client.total_rentals_count || 0}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-icon view"
                        onClick={() => {
                          // Показать детали клиента
                          console.log('View client:', client);
                        }}
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