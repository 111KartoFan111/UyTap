import { useState, useEffect } from 'react';
import { FiX, FiCalendar, FiUser, FiCreditCard, FiClock } from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';
import './RentalModal.css';

const RentalModal = ({ room, onClose, onSubmit }) => {
  const { clients, utils } = useData();
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientDocument: '',
    rentalType: 'daily', // hourly, daily, monthly
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    duration: 1,
    rate: 0,
    totalAmount: 0,
    paymentMethod: 'cash', // cash, card, transfer
    deposit: 0,
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [existingClients, setExistingClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isNewClient, setIsNewClient] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);

  // Загрузка существующих клиентов
  useEffect(() => {
    loadExistingClients();
  }, []);

  const loadExistingClients = async () => {
    try {
      setLoadingClients(true);
      const clientsData = await clients.getAll({ limit: 100 });
      setExistingClients(clientsData);
    } catch (error) {
      console.error('Failed to load clients:', error);
      utils.showError('Не удалось загрузить список клиентов');
    } finally {
      setLoadingClients(false);
    }
  };

  // Получаем тарифы из данных комнаты
  useEffect(() => {
    if (room) {
      const rates = {
        hourly: room.hourly_rate || 0,
        daily: room.daily_rate || 0,
        monthly: room.monthly_rate || 0
      };
      
      // Устанавливаем тариф по умолчанию
      const defaultRate = rates[formData.rentalType] || 0;
      setFormData(prev => ({
        ...prev,
        rate: defaultRate
      }));
      
      updateAmount(formData.rentalType, formData.duration, defaultRate);
    }
  }, [room]);

  // Обновление суммы при изменении типа аренды или продолжительности
  const updateAmount = (type, duration, rate = null) => {
    const currentRate = rate || getRateForType(type);
    const total = currentRate * duration;
    setFormData(prev => ({
      ...prev,
      rate: currentRate,
      totalAmount: total,
      deposit: Math.round(total * 0.2) // 20% депозит
    }));
  };

  const getRateForType = (type) => {
    if (!room) return 0;
    switch (type) {
      case 'hourly': return room.hourly_rate || 0;
      case 'daily': return room.daily_rate || 0;
      case 'monthly': return room.monthly_rate || 0;
      default: return 0;
    }
  };

  const handleRentalTypeChange = (type) => {
    setFormData(prev => ({ ...prev, rentalType: type }));
    updateAmount(type, formData.duration);
  };

  const handleDurationChange = (duration) => {
    const numDuration = parseInt(duration) || 1;
    setFormData(prev => ({ ...prev, duration: numDuration }));
    updateAmount(formData.rentalType, numDuration);
  };

  const calculateEndDate = () => {
    if (!formData.startDate || !formData.duration) return '';
    
    const start = new Date(formData.startDate + (formData.startTime ? `T${formData.startTime}` : 'T00:00'));
    let end = new Date(start);
    
    switch (formData.rentalType) {
      case 'hourly':
        end.setHours(start.getHours() + formData.duration);
        break;
      case 'daily':
        end.setDate(start.getDate() + formData.duration);
        break;
      case 'monthly':
        end.setMonth(start.getMonth() + formData.duration);
        break;
    }
    
    return end.toISOString();
  };

  const handleClientSelect = (clientId) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const client = existingClients.find(c => c.id === clientId);
      if (client) {
        setFormData(prev => ({
          ...prev,
          clientName: `${client.first_name} ${client.last_name}`,
          clientPhone: client.phone || '',
          clientEmail: client.email || '',
          clientDocument: client.document_number || ''
        }));
        setIsNewClient(false);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        clientDocument: ''
      }));
      setIsNewClient(true);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Введите ФИО клиента';
    }
    if (!formData.clientPhone.trim()) {
      newErrors.clientPhone = 'Введите телефон';
    }
    if (!formData.clientDocument.trim()) {
      newErrors.clientDocument = 'Введите номер документа';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Выберите дату начала';
    }
    if (formData.rentalType === 'hourly' && !formData.startTime) {
      newErrors.startTime = 'Укажите время начала';
    }
    if (formData.duration < 1) {
      newErrors.duration = 'Укажите продолжительность';
    }
    if (formData.rate <= 0) {
      newErrors.rate = 'Тариф должен быть больше 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        let clientId = selectedClientId;

        // Если выбран новый клиент, создаем его
        if (isNewClient || !clientId) {
          const nameParts = formData.clientName.trim().split(' ');
          const newClientData = {
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            phone: formData.clientPhone,
            email: formData.clientEmail || null,
            document_number: formData.clientDocument,
            document_type: 'passport'
          };

          const newClient = await clients.create(newClientData);
          clientId = newClient.id;
        }

        // Формируем данные для создания аренды в правильном формате API
        const startDateTime = formData.startDate + (formData.startTime ? `T${formData.startTime}:00` : 'T00:00:00');
        const endDateTime = calculateEndDate();

        const rentalData = {
          property_id: room.id,
          client_id: clientId,
          rental_type: formData.rentalType,
          start_date: startDateTime,
          end_date: endDateTime,
          rate: formData.rate,
          total_amount: formData.totalAmount,
          deposit: formData.deposit,
          payment_method: formData.paymentMethod,
          guest_count: 1,
          notes: formData.notes || null
        };

        await onSubmit(rentalData);
      } catch (error) {
        console.error('Failed to create rental:', error);
        utils.showError('Не удалось создать аренду: ' + (error.message || 'Неизвестная ошибка'));
      }
    }
  };

  return (
    <div className="rental-modal-overlay" onClick={onClose}>
      <div className="rental-modal-content" onClick={e => e.stopPropagation()}>
        <div className="rental-modal-header">
          <h2>
            {room ? `Аренда комнаты ${room.number}` : 'Новая аренда'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form className="rental-form" onSubmit={handleSubmit}>
          {/* Информация о клиенте */}
          <div className="form-section">
            <h3>
              <FiUser /> Информация о клиенте
            </h3>
            
            {/* Выбор существующего клиента */}
            <div className="form-field">
              <label>Существующий клиент</label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                disabled={loadingClients}
              >
                <option value="">Новый клиент</option>
                {existingClients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.first_name} {client.last_name} - {client.phone}
                  </option>
                ))}
              </select>
              {loadingClients && <small>Загрузка клиентов...</small>}
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>ФИО клиента *</label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                  className={errors.clientName ? 'error' : ''}
                  disabled={!isNewClient && selectedClientId}
                />
                {errors.clientName && <span className="error-text">{errors.clientName}</span>}
              </div>
              <div className="form-field">
                <label>Телефон *</label>
                <input
                  type="tel"
                  value={formData.clientPhone}
                  onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                  placeholder="+7 (777) 123-45-67"
                  className={errors.clientPhone ? 'error' : ''}
                  disabled={!isNewClient && selectedClientId}
                />
                {errors.clientPhone && <span className="error-text">{errors.clientPhone}</span>}
              </div>
              <div className="form-field">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                  placeholder="client@example.com"
                  disabled={!isNewClient && selectedClientId}
                />
              </div>
              <div className="form-field">
                <label>Документ *</label>
                <input
                  type="text"
                  value={formData.clientDocument}
                  onChange={(e) => setFormData({ ...formData, clientDocument: e.target.value })}
                  placeholder="123456789012"
                  className={errors.clientDocument ? 'error' : ''}
                  disabled={!isNewClient && selectedClientId}
                />
                {errors.clientDocument && <span className="error-text">{errors.clientDocument}</span>}
              </div>
            </div>
          </div>

          {/* Параметры аренды */}
          <div className="form-section">
            <h3>
              <FiCalendar /> Параметры аренды
            </h3>
            
            <div className="rental-type-selector">
              <label>Тип аренды:</label>
              <div className="rental-types">
                {room?.hourly_rate && (
                  <button
                    type="button"
                    className={`rental-type-btn ${formData.rentalType === 'hourly' ? 'active' : ''}`}
                    onClick={() => handleRentalTypeChange('hourly')}
                  >
                    <FiClock />
                    Почасово
                  </button>
                )}
                {room?.daily_rate && (
                  <button
                    type="button"
                    className={`rental-type-btn ${formData.rentalType === 'daily' ? 'active' : ''}`}
                    onClick={() => handleRentalTypeChange('daily')}
                  >
                    <FiCalendar />
                    Посуточно
                  </button>
                )}
                {room?.monthly_rate && (
                  <button
                    type="button"
                    className={`rental-type-btn ${formData.rentalType === 'monthly' ? 'active' : ''}`}
                    onClick={() => handleRentalTypeChange('monthly')}
                  >
                    <FiCalendar />
                    Помесячно
                  </button>
                )}
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>Дата начала *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className={errors.startDate ? 'error' : ''}
                />
                {errors.startDate && <span className="error-text">{errors.startDate}</span>}
              </div>
              
              {formData.rentalType === 'hourly' && (
                <div className="form-field">
                  <label>Время начала *</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className={errors.startTime ? 'error' : ''}
                  />
                  {errors.startTime && <span className="error-text">{errors.startTime}</span>}
                </div>
              )}

              <div className="form-field">
                <label>
                  Продолжительность *
                  {formData.rentalType === 'hourly' && ' (часов)'}
                  {formData.rentalType === 'daily' && ' (дней)'}
                  {formData.rentalType === 'monthly' && ' (месяцев)'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.duration}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className={errors.duration ? 'error' : ''}
                />
                {errors.duration && <span className="error-text">{errors.duration}</span>}
              </div>

              <div className="form-field">
                <label>Дата окончания</label>
                <input
                  type="datetime-local"
                  value={calculateEndDate().slice(0, 16)}
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Стоимость */}
          <div className="form-section">
            <h3>
              <FiCreditCard /> Стоимость и оплата
            </h3>
            
            <div className="cost-breakdown">
              <div className="cost-item">
                <span>Тариф:</span>
                <span>₸ {formData.rate.toLocaleString()} 
                  {formData.rentalType === 'hourly' && '/час'}
                  {formData.rentalType === 'daily' && '/сутки'}
                  {formData.rentalType === 'monthly' && '/месяц'}
                </span>
              </div>
              <div className="cost-item">
                <span>Продолжительность:</span>
                <span>{formData.duration} 
                  {formData.rentalType === 'hourly' && ' ч.'}
                  {formData.rentalType === 'daily' && ' дн.'}
                  {formData.rentalType === 'monthly' && ' мес.'}
                </span>
              </div>
              <div className="cost-item total">
                <span>Общая сумма:</span>
                <span>₸ {formData.totalAmount.toLocaleString()}</span>
              </div>
              <div className="cost-item">
                <span>Депозит (20%):</span>
                <span>₸ {formData.deposit.toLocaleString()}</span>
              </div>
            </div>

            <div className="form-field">
              <label>Способ оплаты:</label>
              <div className="payment-methods">
                <label className="payment-method">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={formData.paymentMethod === 'cash'}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  />
                  Наличные
                </label>
                <label className="payment-method">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={formData.paymentMethod === 'card'}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  />
                  Карта
                </label>
                <label className="payment-method">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="transfer"
                    checked={formData.paymentMethod === 'transfer'}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  />
                  Перевод
                </label>
              </div>
            </div>
          </div>

          {/* Примечания */}
          <div className="form-section">
            <div className="form-field">
              <label>Примечания</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Дополнительная информация..."
                rows="3"
              />
            </div>
          </div>

          {/* Кнопки */}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-submit">
              Создать аренду
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RentalModal;