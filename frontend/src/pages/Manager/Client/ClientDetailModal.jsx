import { useState, useEffect } from 'react';
import { 
  FiX, FiUser, FiPhone, FiMail, FiMapPin, FiCalendar, 
  FiCreditCard, FiEdit2, FiPlus, FiHome, FiClock,
  FiDollarSign, FiFileText, FiStar, FiActivity
} from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext'; // Используем контекст
import './ClientDetailModal.css';

const ClientDetailModal = ({ client, onClose, onEdit }) => {
  const { clients, rentals } = useData(); // Получаем API из контекста
  const [activeTab, setActiveTab] = useState('overview');
  const [clientHistory, setClientHistory] = useState(null);
  const [clientRentals, setClientRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (client) {
      loadClientDetails();
    }
  }, [client]);

  const loadClientDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Загружаем данные параллельно
      const promises = [];
      
      // Загружаем полную информацию о клиенте
      promises.push(
        clients.getById(client.id).catch((err) => {
          console.warn('Failed to load full client data:', err);
          return client; // Используем базовые данные если не удалось загрузить полные
        })
      );

      // Загружаем историю клиента
      promises.push(
        clients.getHistory(client.id).catch((err) => {
          console.warn('Failed to load client history:', err);
          return null;
        })
      );

      // Загружаем аренды клиента
      promises.push(
        rentals.getAll({ client_id: client.id }).catch((err) => {
          console.warn('Failed to load client rentals:', err);
          return [];
        })
      );

      const [fullClient, history, rentalsList] = await Promise.all(promises);

      setClientHistory(history);
      setClientRentals(rentalsList || []);
      
    } catch (err) {
      console.error('Failed to load client details:', err);
      setError('Не удалось загрузить данные клиента');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch (e) {
      return 'Неверная дата';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleString('ru-RU');
    } catch (e) {
      return 'Неверная дата';
    }
  };

  const formatCurrency = (amount) => {
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'KZT',
        minimumFractionDigits: 0
      }).format(amount || 0);
    } catch (e) {
      return `₸ ${(amount || 0).toLocaleString()}`;
    }
  };

  const getRentalTypeText = (type) => {
    const types = {
      hourly: 'Почасовая',
      daily: 'Посуточная',
      weekly: 'Еженедельная',
      monthly: 'Ежемесячная',
      yearly: 'Годовая'
    };
    return types[type] || type;
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

  const getDocumentTypeName = (type) => {
    const documentTypes = {
      'passport': 'Паспорт',
      'id_card': 'Удостоверение личности',
      'driving_license': 'Водительские права',
      'other': 'Другой документ'
    };
    return documentTypes[type] || 'Документ';
  };

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: FiUser },
    { id: 'rentals', label: 'История аренд', icon: FiHome },
    { id: 'documents', label: 'Документы', icon: FiFileText },
    { id: 'notes', label: 'Заметки', icon: FiEdit2 }
  ];

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content client-detail-modal" onClick={e => e.stopPropagation()}>
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Загрузка данных клиента...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content client-detail-modal" onClick={e => e.stopPropagation()}>
          <div className="error-container">
            <p>Ошибка: {error}</p>
            <button onClick={onClose} className="btn-primary">Закрыть</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content client-detail-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="client-header-info">
            <div className="client-avatar">
              <FiUser size={32} />
            </div>
            <div className="client-basic-info">
              <h2>{client.first_name} {client.last_name}</h2>
              <p className="client-subtitle">
                Клиент с {formatDate(client.created_at)}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => onEdit(client)} 
              className="btn-outline"
            >
              <FiEdit2 /> Редактировать
            </button>
            <button onClick={onClose} className="close-btn">
              <FiX />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="client-quick-stats">
          <div className="stat-item">
            <FiHome />
            <div>
              <span className="stat-number">{client.total_rentals || 0}</span>
              <span className="stat-label">Аренд</span>
            </div>
          </div>
          <div className="stat-item">
            <FiDollarSign />
            <div>
              <span className="stat-number">{formatCurrency(client.total_spent || 0)}</span>
              <span className="stat-label">Потрачено</span>
            </div>
          </div>
          <div className="stat-item">
            <FiCalendar />
            <div>
              <span className="stat-number">{client.last_visit ? formatDate(client.last_visit) : 'Никогда'}</span>
              <span className="stat-label">Последний визит</span>
            </div>
          </div>
          <div className="stat-item">
            <FiStar />
            <div>
              <span className="stat-number">
                {(client.total_rentals || 0) > 1 ? 'VIP' : 'Новый'}
              </span>
              <span className="stat-label">Статус</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="client-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="info-sections">
                {/* Основная информация */}
                <div className="info-section">
                  <h3>
                    <FiUser /> Основная информация
                  </h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Полное имя</label>
                      <span>
                        {client.first_name} {client.middle_name ? client.middle_name + ' ' : ''}{client.last_name}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Дата рождения</label>
                      <span>{formatDate(client.date_of_birth)}</span>
                    </div>
                    <div className="info-item">
                      <label>Источник</label>
                      <span className={`source-badge ${client.source || 'other'}`}>
                        {getSourceDisplayName(client.source)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Контактная информация */}
                <div className="info-section">
                  <h3>
                    <FiPhone /> Контактная информация
                  </h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Телефон</label>
                      <span>
                        {client.phone ? (
                          <a href={`tel:${client.phone}`}>{client.phone}</a>
                        ) : 'Не указан'}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Email</label>
                      <span>
                        {client.email ? (
                          <a href={`mailto:${client.email}`}>{client.email}</a>
                        ) : 'Не указан'}
                      </span>
                    </div>
                    <div className="info-item full-width">
                      <label>Адрес</label>
                      <span>{client.address || 'Не указан'}</span>
                    </div>
                  </div>
                </div>

                {/* Документы */}
                {(client.document_type || client.document_number) && (
                  <div className="info-section">
                    <h3>
                      <FiFileText /> Документы
                    </h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Тип документа</label>
                        <span>{getDocumentTypeName(client.document_type)}</span>
                      </div>
                      <div className="info-item">
                        <label>Номер документа</label>
                        <span>{client.document_number || 'Не указан'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Заметки */}
                {client.notes && (
                  <div className="info-section">
                    <h3>
                      <FiEdit2 /> Заметки
                    </h3>
                    <div className="notes-content">
                      <p>{client.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rentals' && (
            <div className="rentals-tab">
              <div className="rentals-header">
                <h3>
                  <FiHome /> История аренд ({clientRentals.length})
                </h3>
                <button className="btn-primary btn-sm">
                  <FiPlus /> Новая аренда
                </button>
              </div>

              {clientRentals.length > 0 ? (
                <div className="rentals-list">
                  {clientRentals.map(rental => (
                    <div key={rental.id} className="rental-card">
                      <div className="rental-header">
                        <div className="rental-property">
                          <h4>
                            {rental.property?.name || 
                             (rental.property?.number ? `Помещение #${rental.property.number}` : 
                              'Помещение')}
                          </h4>
                          <span className="rental-type">
                            {getRentalTypeText(rental.rental_type)}
                          </span>
                        </div>
                        <div className="rental-status">
                          <span 
                            className="status-badge"
                            style={{ 
                              backgroundColor: rental.is_active ? '#27ae60' : '#95a5a6',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            {rental.is_active ? 'Активная' : 
                             rental.checked_out ? 'Завершена' : 'Неактивная'}
                          </span>
                        </div>
                      </div>

                      <div className="rental-details">
                        <div className="rental-dates">
                          <div className="date-item">
                            <FiCalendar size={14} />
                            <span>
                              {formatDate(rental.start_date)} - {formatDate(rental.end_date)}
                            </span>
                          </div>
                          {rental.check_in_time && (
                            <div className="date-item">
                              <FiClock size={14} />
                              <span>Заселение: {formatDateTime(rental.check_in_time)}</span>
                            </div>
                          )}
                          {rental.check_out_time && (
                            <div className="date-item">
                              <FiClock size={14} />
                              <span>Выселение: {formatDateTime(rental.check_out_time)}</span>
                            </div>
                          )}
                        </div>

                        <div className="rental-financial">
                          <div className="financial-item">
                            <label>Стоимость:</label>
                            <span>{formatCurrency(rental.total_amount)}</span>
                          </div>
                          <div className="financial-item">
                            <label>Оплачено:</label>
                            <span>{formatCurrency(rental.paid_amount)}</span>
                          </div>
                          {(rental.deposit || 0) > 0 && (
                            <div className="financial-item">
                              <label>Депозит:</label>
                              <span>{formatCurrency(rental.deposit)}</span>
                            </div>
                          )}
                        </div>

                        {rental.notes && (
                          <div className="rental-notes">
                            <label>Заметки:</label>
                            <p>{rental.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-rentals">
                  <FiHome size={48} />
                  <h4>Нет истории аренд</h4>
                  <p>У этого клиента пока нет аренд</p>
                  <button className="btn-primary">
                    <FiPlus /> Создать первую аренду
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="documents-tab">
              <div className="documents-header">
                <h3>
                  <FiFileText /> Документы
                </h3>
                <button className="btn-primary btn-sm">
                  <FiPlus /> Добавить документ
                </button>
              </div>
              
              <div className="empty-documents">
                <FiFileText size={48} />
                <h4>Нет документов</h4>
                <p>Документы клиента будут отображаться здесь</p>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="notes-tab">
              <div className="notes-header">
                <h3>
                  <FiEdit2 /> Заметки и комментарии
                </h3>
              </div>
              
              <div className="notes-content">
                <textarea
                  placeholder="Добавьте заметку о клиенте..."
                  rows={6}
                  defaultValue={client.notes || ''}
                  className="notes-textarea"
                />
                <div className="notes-actions">
                  <button className="btn-primary">Сохранить заметку</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDetailModal;