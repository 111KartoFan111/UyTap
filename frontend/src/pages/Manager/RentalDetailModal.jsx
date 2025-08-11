import React, { useState, useEffect } from 'react';
import { 
  FiX, FiUser, FiHome, FiCalendar, FiDollarSign, 
  FiClock, FiMapPin, FiPhone, FiMail, FiEdit2,
  FiCreditCard, FiShoppingCart, FiPackage, FiPlus,
  FiCheck, FiAlertCircle, FiRefreshCw, FiEye
} from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';

const RentalDetailModal = ({ rental, onClose, onPaymentUpdate }) => {
  const { clients, properties, inventory, orders, rentals, utils } = useData();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [rentalData, setRentalData] = useState(rental);
  const [client, setClient] = useState(null);
  const [property, setProperty] = useState(null);
  const [rentalOrders, setRentalOrders] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  
  // Форма оплаты
  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_method: 'cash',
    payment_type: 'rent_payment',
    payer_name: '',
    reference_number: '',
    notes: ''
  });

  // Форма заказа
  const [orderForm, setOrderForm] = useState({
    order_type: 'delivery',
    title: '',
    items: [],
    total_amount: 0,
    special_instructions: ''
  });

  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    if (rental) {
      loadRentalDetails();
    }
  }, [rental]);

  const loadRentalDetails = async () => {
    try {
      setLoading(true);
      
      // Загружаем все данные параллельно
      const promises = [
        // Полная информация об аренде
        rentals.getById(rental.id).catch(err => {
          console.warn('Failed to load full rental:', err);
          return rental;
        }),
        
        // Клиент
        clients.getById(rental.client_id).catch(err => {
          console.warn('Failed to load client:', err);
          return null;
        }),
        
        // Помещение
        properties.getById(rental.property_id).catch(err => {
          console.warn('Failed to load property:', err);
          return null;
        }),
        
        // Заказы по аренде
        orders.getAll({ rental_id: rental.id }).catch(err => {
          console.warn('Failed to load orders:', err);
          return [];
        }),
        
        // История платежей
        fetch(`http://92.38.49.43:8000/api/rentals/${rental.id}/payments`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }).then(res => res.ok ? res.json() : { payments: [] }).catch(() => ({ payments: [] })),
        
        // Статус оплаты
        fetch(`http://92.38.49.43:8000/api/rentals/${rental.id}/payment-status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }).then(res => res.ok ? res.json() : null).catch(() => null),
        
        // Доступные товары для заказа
        inventory.getAll({ is_active: true }).catch(err => {
          console.warn('Failed to load inventory:', err);
          return [];
        })
      ];

      const [
        fullRental,
        clientData,
        propertyData,
        ordersData,
        paymentsData,
        statusData,
        inventoryData
      ] = await Promise.all(promises);

      setRentalData(fullRental);
      setClient(clientData);
      setProperty(propertyData);
      setRentalOrders(ordersData);
      setPaymentHistory(paymentsData.payments || []);
      setPaymentStatus(statusData);
      setAvailableItems(inventoryData);

      // Устанавливаем имя плательщика по умолчанию
      if (clientData) {
        setPaymentForm(prev => ({
          ...prev,
          payer_name: `${clientData.first_name} ${clientData.last_name}`.trim()
        }));
      }

    } catch (error) {
      console.error('Failed to load rental details:', error);
      utils.showError('Не удалось загрузить данные аренды');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    
    if (!paymentForm.payment_amount || parseFloat(paymentForm.payment_amount) <= 0) {
      utils.showError('Введите корректную сумму');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`http://92.38.49.43:8000/api/rentals/${rental.id}/payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_amount: parseFloat(paymentForm.payment_amount),
          payment_method: paymentForm.payment_method,
          payment_type: paymentForm.payment_type,
          payer_name: paymentForm.payer_name,
          reference_number: paymentForm.reference_number,
          notes: paymentForm.notes,
          auto_complete: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Payment failed');
      }

      const paymentData = await response.json();
      
      // Обновляем локальные данные
      setPaymentHistory(prev => [paymentData, ...prev]);
      
      // Обновляем сумму оплаты в аренде
      const updatedAmount = (rentalData.paid_amount || 0) + parseFloat(paymentForm.payment_amount);
      const updatedRental = { ...rentalData, paid_amount: updatedAmount };
      setRentalData(updatedRental);
      
      // Обновляем статус оплаты
      if (paymentStatus) {
        setPaymentStatus(prev => ({
          ...prev,
          paid_amount: updatedAmount,
          outstanding_amount: prev.total_amount - updatedAmount,
          payment_completion_percentage: (updatedAmount / prev.total_amount) * 100,
          is_fully_paid: updatedAmount >= prev.total_amount,
          payment_count: prev.payment_count + 1
        }));
      }
      
      // Сброс формы
      setPaymentForm({
        payment_amount: '',
        payment_method: 'cash',
        payment_type: 'rent_payment',
        payer_name: client ? `${client.first_name} ${client.last_name}`.trim() : '',
        reference_number: '',
        notes: ''
      });
      
      setShowPaymentForm(false);
      utils.showSuccess('Платеж успешно добавлен');
      
      // Уведомляем родительский компонент
      if (onPaymentUpdate) {
        onPaymentUpdate(updatedRental);
      }
      
    } catch (error) {
      console.error('Payment failed:', error);
      utils.showError('Ошибка при добавлении платежа: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    
    if (!orderForm.title.trim()) {
      utils.showError('Введите название заказа');
      return;
    }

    if (selectedItems.length === 0) {
      utils.showError('Выберите товары для заказа');
      return;
    }

    try {
      setLoading(true);
      
      const orderData = {
        property_id: rental.property_id,
        rental_id: rental.id,
        client_id: rental.client_id,
        order_type: orderForm.order_type,
        title: orderForm.title,
        items: selectedItems.map(item => ({
          inventory_id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.cost_per_unit || 0,
          total_price: (item.cost_per_unit || 0) * item.quantity,
          is_inventory_item: true
        })),
        total_amount: orderForm.total_amount,
        special_instructions: orderForm.special_instructions
      };

      const newOrder = await orders.create(orderData);
      
      setRentalOrders(prev => [newOrder, ...prev]);
      
      // Сброс формы
      setOrderForm({
        order_type: 'delivery',
        title: '',
        items: [],
        total_amount: 0,
        special_instructions: ''
      });
      setSelectedItems([]);
      setShowOrderForm(false);
      
      utils.showSuccess('Заказ успешно создан');
      
    } catch (error) {
      console.error('Failed to create order:', error);
      utils.showError('Не удалось создать заказ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addItemToOrder = (item) => {
    const existingItem = selectedItems.find(si => si.id === item.id);
    
    if (existingItem) {
      setSelectedItems(prev => prev.map(si => 
        si.id === item.id 
          ? { ...si, quantity: si.quantity + 1 }
          : si
      ));
    } else {
      setSelectedItems(prev => [...prev, { ...item, quantity: 1 }]);
    }
    
    updateOrderTotal();
  };

  const removeItemFromOrder = (itemId) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
    updateOrderTotal();
  };

  const updateItemQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeItemFromOrder(itemId);
      return;
    }
    
    setSelectedItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
    updateOrderTotal();
  };

  const updateOrderTotal = () => {
    const total = selectedItems.reduce((sum, item) => 
      sum + (item.cost_per_unit || 0) * item.quantity, 0
    );
    setOrderForm(prev => ({ ...prev, total_amount: total }));
  };

  useEffect(() => {
    updateOrderTotal();
  }, [selectedItems]);

  const formatCurrency = (amount) => {
    return `₸ ${(amount || 0).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const getPaymentMethodName = (method) => {
    const methods = {
      cash: 'Наличные',
      card: 'Банковская карта',
      transfer: 'Перевод',
      qr_code: 'QR-код'
    };
    return methods[method] || method;
  };

  const getOrderStatusName = (status) => {
    const statuses = {
      pending: 'В ожидании',
      confirmed: 'Подтвержден',
      in_progress: 'В работе',
      delivered: 'Доставлен',
      cancelled: 'Отменен'
    };
    return statuses[status] || status;
  };

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: FiUser },
    { id: 'payments', label: 'Платежи', icon: FiCreditCard },
    { id: 'orders', label: 'Заказы', icon: FiShoppingCart },
    { id: 'timeline', label: 'История', icon: FiClock }
  ];

  if (loading && !rentalData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <div className="flex items-center justify-center">
            <FiRefreshCw className="animate-spin mr-2" />
            Загрузка данных об аренде...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <FiHome className="mr-2" />
              Детали аренды
            </h2>
            <p className="text-blue-100 text-sm">
              {property?.name || property?.number} • {client ? `${client.first_name} ${client.last_name}` : 'Клиент'}
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-blue-700 p-2 rounded">
            <FiX size={20} />
          </button>
        </div>

        {/* Quick Info Bar */}
        <div className="bg-gray-50 p-4 border-b">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-gray-600">Период:</span>
              <div className="font-medium">
                {formatDate(rentalData.start_date)} — {formatDate(rentalData.end_date)}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Статус:</span>
              <div className={`font-medium ${
                rentalData.checked_out ? 'text-gray-600' :
                rentalData.checked_in ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {rentalData.checked_out ? 'Завершена' :
                 rentalData.checked_in ? 'Заселен' : 'Ожидает заселения'}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Сумма:</span>
              <div className="font-medium">{formatCurrency(rentalData.total_amount)}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Оплачено:</span>
              <div className={`font-medium ${
                (rentalData.paid_amount || 0) >= rentalData.total_amount ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(rentalData.paid_amount || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="inline mr-2" size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Информация о клиенте */}
              {client && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center">
                    <FiUser className="mr-2" /> Информация о клиенте
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">ФИО:</label>
                      <div className="font-medium">
                        {client.first_name} {client.middle_name} {client.last_name}
                      </div>
                    </div>
                    {client.phone && (
                      <div>
                        <label className="text-sm text-gray-600">Телефон:</label>
                        <div className="font-medium flex items-center">
                          <FiPhone size={14} className="mr-1" />
                          <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                            {client.phone}
                          </a>
                        </div>
                      </div>
                    )}
                    {client.email && (
                      <div>
                        <label className="text-sm text-gray-600">Email:</label>
                        <div className="font-medium flex items-center">
                          <FiMail size={14} className="mr-1" />
                          <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                            {client.email}
                          </a>
                        </div>
                      </div>
                    )}
                    {client.document_number && (
                      <div>
                        <label className="text-sm text-gray-600">Документ:</label>
                        <div className="font-medium">{client.document_number}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Информация о помещении */}
              {property && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center">
                    <FiHome className="mr-2" /> Информация о помещении
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">Название:</label>
                      <div className="font-medium">{property.name}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Номер:</label>
                      <div className="font-medium">{property.number}</div>
                    </div>
                    {property.floor && (
                      <div>
                        <label className="text-sm text-gray-600">Этаж:</label>
                        <div className="font-medium">{property.floor}</div>
                      </div>
                    )}
                    {property.area && (
                      <div>
                        <label className="text-sm text-gray-600">Площадь:</label>
                        <div className="font-medium">{property.area} м²</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Детали аренды */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center">
                  <FiCalendar className="mr-2" /> Детали аренды
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Тип аренды:</label>
                    <div className="font-medium">{rentalData.rental_type}</div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Тариф:</label>
                    <div className="font-medium">{formatCurrency(rentalData.rate)}</div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Количество гостей:</label>
                    <div className="font-medium">{rentalData.guest_count}</div>
                  </div>
                  {rentalData.deposit && (
                    <div>
                      <label className="text-sm text-gray-600">Депозит:</label>
                      <div className="font-medium">{formatCurrency(rentalData.deposit)}</div>
                    </div>
                  )}
                </div>
                
                {rentalData.notes && (
                  <div className="mt-4">
                    <label className="text-sm text-gray-600">Примечания:</label>
                    <div className="font-medium mt-1 p-2 bg-gray-50 rounded">
                      {rentalData.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Статус оплаты */}
              {paymentStatus && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Статус оплаты</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(paymentStatus.total_amount)}
                      </div>
                      <div className="text-sm text-gray-600">Общая сумма</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(paymentStatus.paid_amount)}
                      </div>
                      <div className="text-sm text-gray-600">Оплачено</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(paymentStatus.outstanding_amount)}
                      </div>
                      <div className="text-sm text-gray-600">К доплате</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Прогресс оплаты</span>
                      <span>{paymentStatus.payment_completion_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-300 ${
                          paymentStatus.is_fully_paid ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(paymentStatus.payment_completion_percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {paymentStatus.outstanding_amount > 0 && (
                    <button
                      onClick={() => {
                        setPaymentForm(prev => ({
                          ...prev,
                          payment_amount: paymentStatus.outstanding_amount.toString()
                        }));
                        setShowPaymentForm(true);
                      }}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                    >
                      Принять оплату ({formatCurrency(paymentStatus.outstanding_amount)})
                    </button>
                  )}
                </div>
              )}

              {/* Форма оплаты */}
              {showPaymentForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Добавить платеж</h4>
                  
                  <form onSubmit={handlePayment} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Сумма *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentForm.payment_amount}
                          onChange={(e) => setPaymentForm(prev => ({
                            ...prev,
                            payment_amount: e.target.value
                          }))}
                          className="w-full p-2 border rounded"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">Способ оплаты *</label>
                        <select
                          value={paymentForm.payment_method}
                          onChange={(e) => setPaymentForm(prev => ({
                            ...prev,
                            payment_method: e.target.value
                          }))}
                          className="w-full p-2 border rounded"
                        >
                          <option value="cash">Наличные</option>
                          <option value="card">Банковская карта</option>
                          <option value="transfer">Перевод</option>
                          <option value="qr_code">QR-код</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">Плательщик</label>
                        <input
                          type="text"
                          value={paymentForm.payer_name}
                          onChange={(e) => setPaymentForm(prev => ({
                            ...prev,
                            payer_name: e.target.value
                          }))}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">Номер документа</label>
                        <input
                          type="text"
                          value={paymentForm.reference_number}
                          onChange={(e) => setPaymentForm(prev => ({
                            ...prev,
                            reference_number: e.target.value
                          }))}
                          className="w-full p-2 border rounded"
                          placeholder="Номер чека/операции"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Примечания</label>
                      <textarea
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm(prev => ({
                          ...prev,
                          notes: e.target.value
                        }))}
                        className="w-full p-2 border rounded"
                        rows="2"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPaymentForm(false)}
                        className="px-4 py-2 border rounded hover:bg-gray-50"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {loading ? 'Обработка...' : 'Добавить платеж'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {!showPaymentForm && paymentStatus?.outstanding_amount > 0 && (
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  <FiPlus className="inline mr-2" />
                  Добавить платеж
                </button>
              )}

              {/* История платежей */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-semibold mb-3">История платежей ({paymentHistory.length})</h4>
                
                {paymentHistory.length > 0 ? (
                  <div className="space-y-3">
                    {paymentHistory.map(payment => (
                      <div key={payment.id} className="border rounded p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-lg">
                              {formatCurrency(payment.amount)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {getPaymentMethodName(payment.payment_method)} • 
                              {formatDateTime(payment.completed_at || payment.created_at)}
                            </div>
                            {payment.payer_name && (
                              <div className="text-sm text-gray-600">
                                Плательщик: {payment.payer_name}
                              </div>
                            )}
                            {payment.reference_number && (
                              <div className="text-sm text-gray-600">
                                Документ: {payment.reference_number}
                              </div>
                            )}
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            payment.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {payment.status === 'completed' ? 'Завершен' : payment.status}
                          </div>
                        </div>
                        {payment.notes && (
                          <div className="mt-2 text-sm text-gray-700">
                            {payment.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FiCreditCard size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>Платежи не найдены</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Форма создания заказа */}
              {showOrderForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Новый заказ</h4>
                  
                  <form onSubmit={handleCreateOrder} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Тип заказа *</label>
                        <select
                          value={orderForm.order_type}
                          onChange={(e) => setOrderForm(prev => ({
                            ...prev,
                            order_type: e.target.value
                          }))}
                          className="w-full p-2 border rounded"
                        >
                          <option value="delivery">Доставка</option>
                          <option value="cleaning">Уборка</option>
                          <option value="maintenance">Обслуживание</option>
                          <option value="laundry">Стирка</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">Название заказа *</label>
                        <input
                          type="text"
                          value={orderForm.title}
                          onChange={(e) => setOrderForm(prev => ({
                            ...prev,
                            title: e.target.value
                          }))}
                          className="w-full p-2 border rounded"
                          placeholder="Например: Доставка продуктов"
                          required
                        />
                      </div>
                    </div>
                    
                    {/* Выбор товаров */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Товары</label>
                      <div className="border rounded p-3 bg-white max-h-60 overflow-y-auto">
                        {availableItems.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {availableItems.map(item => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-gray-600">
                                    {formatCurrency(item.cost_per_unit || 0)} • 
                                    Остаток: {item.current_stock} {item.unit}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addItemToOrder(item)}
                                  disabled={item.current_stock <= 0}
                                  className="ml-2 bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                  <FiPlus size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 py-4">
                            Нет доступных товаров
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Выбранные товары */}
                    {selectedItems.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Выбранные товары</label>
                        <div className="border rounded p-3 bg-white">
                          {selectedItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                              <div className="flex-1">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-gray-600">
                                  {formatCurrency(item.cost_per_unit || 0)} × {item.quantity} = 
                                  {formatCurrency((item.cost_per_unit || 0) * item.quantity)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  max={item.current_stock}
                                  value={item.quantity}
                                  onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value))}
                                  className="w-16 px-2 py-1 border rounded text-center"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeItemFromOrder(item.id)}
                                  className="text-red-600 hover:bg-red-50 p-1 rounded"
                                >
                                  <FiX size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="pt-2 font-semibold text-right">
                            Общая сумма: {formatCurrency(orderForm.total_amount)}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Особые указания</label>
                      <textarea
                        value={orderForm.special_instructions}
                        onChange={(e) => setOrderForm(prev => ({
                          ...prev,
                          special_instructions: e.target.value
                        }))}
                        className="w-full p-2 border rounded"
                        rows="2"
                        placeholder="Дополнительные инструкции для исполнителя"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowOrderForm(false);
                          setSelectedItems([]);
                          setOrderForm({
                            order_type: 'delivery',
                            title: '',
                            items: [],
                            total_amount: 0,
                            special_instructions: ''
                          });
                        }}
                        className="px-4 py-2 border rounded hover:bg-gray-50"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={loading || selectedItems.length === 0}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {loading ? 'Создание...' : 'Создать заказ'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {!showOrderForm && rentalData.checked_in && !rentalData.checked_out && (
                <button
                  onClick={() => setShowOrderForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  <FiPlus className="inline mr-2" />
                  Создать заказ
                </button>
              )}

              {/* Список заказов */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-semibold mb-3">Заказы ({rentalOrders.length})</h4>
                
                {rentalOrders.length > 0 ? (
                  <div className="space-y-3">
                    {rentalOrders.map(order => (
                      <div key={order.id} className="border rounded p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">{order.title}</div>
                            <div className="text-sm text-gray-600">
                              {order.order_type} • {formatDateTime(order.created_at)}
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            order.status === 'delivered' 
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {getOrderStatusName(order.status)}
                          </div>
                        </div>
                        
                        {order.items && order.items.length > 0 && (
                          <div className="mb-2">
                            <div className="text-sm font-medium mb-1">Товары:</div>
                            <div className="text-sm text-gray-600">
                              {order.items.map((item, index) => (
                                <div key={index}>
                                  {item.name} × {item.quantity} = {formatCurrency(item.total_price)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <div className="font-medium">
                            Сумма: {formatCurrency(order.total_amount)}
                          </div>
                          {order.assigned_to && (
                            <div className="text-sm text-gray-600">
                              Исполнитель: {order.assigned_to}
                            </div>
                          )}
                        </div>
                        
                        {order.special_instructions && (
                          <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            {order.special_instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FiShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>Заказы не найдены</p>
                    {rentalData.checked_in && !rentalData.checked_out && (
                      <p className="text-sm mt-2">Создайте первый заказ для этой аренды</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-semibold mb-4">Хронология событий</h4>
                
                <div className="space-y-4">
                  {/* Создание аренды */}
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mt-1">
                      <FiCalendar size={16} className="text-blue-600" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="font-medium">Аренда создана</div>
                      <div className="text-sm text-gray-600">
                        {formatDateTime(rentalData.created_at)}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">
                        Период: {formatDate(rentalData.start_date)} — {formatDate(rentalData.end_date)}
                      </div>
                    </div>
                  </div>

                  {/* Заселение */}
                  {rentalData.checked_in && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mt-1">
                        <FiCheck size={16} className="text-green-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="font-medium">Клиент заселен</div>
                        <div className="text-sm text-gray-600">
                          {formatDateTime(rentalData.check_in_time)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Платежи */}
                  {paymentHistory.map(payment => (
                    <div key={payment.id} className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mt-1">
                        <FiDollarSign size={16} className="text-green-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="font-medium">
                          Получен платеж {formatCurrency(payment.amount)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatDateTime(payment.completed_at || payment.created_at)}
                        </div>
                        <div className="text-sm text-gray-700">
                          {getPaymentMethodName(payment.payment_method)}
                          {payment.payer_name && ` • ${payment.payer_name}`}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Заказы */}
                  {rentalOrders.map(order => (
                    <div key={order.id} className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mt-1">
                        <FiShoppingCart size={16} className="text-purple-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="font-medium">Заказ: {order.title}</div>
                        <div className="text-sm text-gray-600">
                          {formatDateTime(order.created_at)}
                        </div>
                        <div className="text-sm text-gray-700">
                          {formatCurrency(order.total_amount)} • {getOrderStatusName(order.status)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Выселение */}
                  {rentalData.checked_out && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mt-1">
                        <FiAlertCircle size={16} className="text-gray-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="font-medium">Клиент выселен</div>
                        <div className="text-sm text-gray-600">
                          {formatDateTime(rentalData.check_out_time)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Если нет событий */}
                  {!rentalData.checked_in && paymentHistory.length === 0 && rentalOrders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <FiClock size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>История событий пуста</p>
                      <p className="text-sm mt-2">События будут появляться здесь по мере развития аренды</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RentalDetailModal;