// frontend/src/pages/Manager/Orders/CreateOrders.jsx - ОБНОВЛЕННАЯ ВЕРСИЯ С ПЛАТЕЖАМИ
import React, { useState, useEffect } from 'react';
import './CreateOrders.css';
import {
  Search, Filter, Package, ShoppingCart, Plus, Minus, X, Receipt,
  User, Calendar, Check, AlertCircle, DollarSign, Package2, Trash2,
  Edit, FileText, Clipboard, File, CreditCard, Banknote
} from 'lucide-react';
import { FiX } from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';

const CreateOrders = () => {
  const { inventory, rentals, properties, utils, orders } = useData();
  const [availableRentals, setAvailableRentals] = useState([]);
  const [selectedRentalId, setSelectedRentalId] = useState('');
  const { user } = useAuth();

  const [inventoryItems, setInventoryItems] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [availableProperties, setAvailableProperties] = useState([]);
  
  // НОВЫЕ СОСТОЯНИЯ ДЛЯ ПЛАТЕЖЕЙ
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDetails, setPaymentDetails] = useState({
    cardLast4: '',
    bankName: '',
    referenceNumber: '',
    notes: ''
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  const loadProperties = async () => {
    try {
      const activeProperties = await properties.getAll({ status: 'occupied' });
      setAvailableProperties(activeProperties || []);
    } catch (error) {
      console.warn('Could not load properties:', error);
      setAvailableProperties([]);
    }
  };

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const items = await inventory.getAll({
        in_stock_only: true,
        is_active: true,
        limit: 1000
      });

      setInventoryItems(items || []);
      setFilteredInventory(items || []);
    } catch (error) {
      utils.showError('Не удалось загрузить товары: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRentals = async () => {
    try {
      const activeRentals = await rentals.getAll({ is_active: true });
      setAvailableRentals(activeRentals || []);
    } catch (error) {
      console.warn('Could not load rentals:', error);
      setAvailableRentals([]);
    }
  };

  useEffect(() => {
    loadInventoryData();
    loadRentals();
    loadProperties();
  }, []);

  useEffect(() => {
    let filtered = inventoryItems;

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    setFilteredInventory(filtered);
  }, [inventoryItems, searchTerm, selectedCategory]);

  const categories = [...new Set(inventoryItems.map(item => item.category).filter(Boolean))];

  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);

    if (existingItem) {
      if (existingItem.quantity < item.current_stock) {
        setCart(cart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1, total: (cartItem.quantity + 1) * cartItem.price }
            : cartItem
        ));
      } else {
        utils.showWarning('Недостаточно товара на складе');
      }
    } else {
      const cartItem = {
        id: item.id,
        name: item.name,
        price: item.cost_per_unit || 0,
        quantity: 1,
        unit: item.unit,
        max_stock: item.current_stock,
        inventory_id: item.id,
        is_inventory_item: true,
        total: item.cost_per_unit || 0
      };
      setCart([...cart, cartItem]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const inventoryItem = inventoryItems.find(item => item.id === itemId);
    if (inventoryItem && newQuantity > inventoryItem.current_stock) {
      utils.showWarning('Недостаточно товара на складе');
      return;
    }

    setCart(cart.map(item =>
      item.id === itemId
        ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
        : item
    ));
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  // НОВАЯ ФУНКЦИЯ: Создание заказа без немедленной оплаты
  const createOrderOnly = async () => {
    if (cart.length === 0) {
      utils.showError('Корзина пуста');
      return;
    }

    if (!selectedProperty) {
      utils.showError('Выберите помещение для доставки');
      return;
    }

    if (!customerInfo.name.trim()) {
      utils.showError('Укажите имя покупателя');
      return;
    }

    try {
      setIsProcessingSale(true);

      const orderData = {
        property_id: selectedProperty,
        order_type: 'product_sale',
        title: `Продажа товаров - ${customerInfo.name}`,
        description: `Продажа ${getTotalItems()} товаров на сумму ${getTotalAmount().toLocaleString('ru-RU')} ₸`,
        items: cart.map(item => ({
          inventory_id: item.inventory_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total,
          is_inventory_item: true,
          notes: ''
        })),
        total_amount: getTotalAmount(),
        special_instructions: customerInfo.phone ? `Контакт покупателя: ${customerInfo.phone}` : '',
        client_id: null,
        rental_id: selectedRentalId || null
      };

      console.log('Creating order with data:', orderData);
      const createdOrder = await orders.create(orderData);
      console.log('Order created:', createdOrder);

      setCompletedOrder(createdOrder);
      setShowPaymentDialog(true);

    } catch (error) {
      console.error('Order creation error:', error);
      utils.showError('Ошибка при создании заказа: ' + error.message);
    } finally {
      setIsProcessingSale(false);
    }
  };

  // НОВАЯ ФУНКЦИЯ: Обработка платежа
// ИСПРАВЛЕННАЯ ФУНКЦИЯ: Обработка платежа
  const processPayment = async () => {
    if (!completedOrder) {
      utils.showError('Заказ не найден');
      return;
    }

    try {
      setIsProcessingPayment(true);

      // Создаем данные платежа
      const paymentData = {
        amount: completedOrder.total_amount,
        method: paymentMethod,
        payer_name: customerInfo.name,
        payer_phone: customerInfo.phone || '',
        payer_email: customerInfo.email || '',
        reference_number: paymentDetails.referenceNumber || '',
        card_last4: paymentMethod === 'card' ? paymentDetails.cardLast4 : '',
        bank_name: paymentMethod === 'transfer' ? paymentDetails.bankName : ''
      };

      console.log('🔄 Processing payment:', paymentData);

      // Используем API из контекста для обработки платежа
      let paymentResult;
      try {
        paymentResult = await orderPayments.processSale(completedOrder.id, paymentData);
        console.log('✅ Payment processed:', paymentResult);
      } catch (paymentError) {
        console.error('❌ Payment API failed:', paymentError);
        
        // Fallback: пытаемся использовать прямой API вызов
        try {
          const response = await fetch(`http://localhost:8000/api/orders/${completedOrder.id}/sale-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify(paymentData)
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            // Пытаемся получить детали ошибки
            try {
              const errorText = await response.text();
              if (errorText) {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.detail || errorData.message || errorMessage;
              }
            } catch (parseError) {
              console.warn('Could not parse error response:', parseError);
            }
            
            throw new Error(errorMessage);
          }

          // Проверяем, есть ли контент для парсинга
          const responseText = await response.text();
          paymentResult = responseText ? JSON.parse(responseText) : { success: true };
          
          console.log('✅ Fallback payment processed:', paymentResult);
        } catch (fallbackError) {
          console.error('❌ Fallback payment failed:', fallbackError);
          throw fallbackError;
        }
      }

      // Завершаем заказ после успешной оплаты
      console.log('🔄 Completing order:', completedOrder.id);
      
      try {
        const completionResult = await orders.complete(
          completedOrder.id, 
          `Продажа завершена с оплатой ${utils.payment.formatPaymentMethod(paymentMethod)}. Покупатель: ${customerInfo.name}`
        );
        console.log('✅ Order completed:', completionResult);
      } catch (completionError) {
        console.warn('⚠️  Order completion warning:', completionError);
        // Продолжаем, даже если не удалось завершить заказ, так как платеж уже обработан
      }

      utils.showSuccess('Продажа и оплата успешно завершены!');

      // Очищаем форму и состояние
      resetFormState();

      // Перезагружаем инвентарь для обновления остатков
      await loadInventoryData();

    } catch (error) {
      console.error('❌ Payment processing error:', error);
      
      // Показываем понятную ошибку пользователю
      let errorMessage = 'Ошибка при обработке платежа';
      
      if (error.message.includes('404')) {
        errorMessage = 'Сервис платежей недоступен. Обратитесь к администратору.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Нет прав для обработки платежей';
      } else if (error.message.includes('400')) {
        errorMessage = 'Некорректные данные платежа: ' + error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      utils.showError(errorMessage);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Функция для сброса состояния формы
  const resetFormState = () => {
    setCart([]);
    setCustomerInfo({ name: '', phone: '', email: '' });
    setSelectedProperty('');
    setSelectedRentalId('');
    setShowCart(false);
    setShowPaymentDialog(false);
    setCompletedOrder(null);
    setPaymentDetails({
      cardLast4: '',
      bankName: '',
      referenceNumber: '',
      notes: ''
    });
    setPaymentMethod('cash');
  };

  // ОБНОВЛЕННАЯ ФУНКЦИЯ: Обработка продажи (теперь через два этапа)
  const processSale = async () => {
    await createOrderOnly();
  };

  const clearCart = () => {
    setCart([]);
  };

  // НОВЫЙ КОМПОНЕНТ: Диалог оплаты
  const PaymentDialog = () => {
    if (!showPaymentDialog || !completedOrder) return null;

    return (
      <div className="payment-overlay">
        <div className="payment-dialog">
          <div className="payment-header">
            <h2>Оплата заказа</h2>
            <button 
              className="close-btn" 
              onClick={() => setShowPaymentDialog(false)}
              disabled={isProcessingPayment}
            >
              <FiX size={20} />
            </button>
          </div>

          <div className="payment-content">
            <div className="order-summary">
              <h3>Детали заказа</h3>
              <p><strong>Номер заказа:</strong> {completedOrder.order_number}</p>
              <p><strong>Покупатель:</strong> {customerInfo.name}</p>
              <p><strong>Сумма к оплате:</strong> {completedOrder.total_amount.toLocaleString('ru-RU')} ₸</p>
            </div>

            <div className="payment-methods">
              <h3>Способ оплаты</h3>
              <div className="payment-options">
                <label className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <Banknote size={20} />
                  <span>Наличные</span>
                </label>

                <label className={`payment-option ${paymentMethod === 'card' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <CreditCard size={20} />
                  <span>Банковская карта</span>
                </label>

                <label className={`payment-option ${paymentMethod === 'transfer' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    value="transfer"
                    checked={paymentMethod === 'transfer'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <DollarSign size={20} />
                  <span>Банковский перевод</span>
                </label>

                <label className={`payment-option ${paymentMethod === 'qr_code' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    value="qr_code"
                    checked={paymentMethod === 'qr_code'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <FileText size={20} />
                  <span>QR-код</span>
                </label>
              </div>
            </div>

            {/* Дополнительные поля в зависимости от способа оплаты */}
            {paymentMethod === 'card' && (
              <div className="payment-details">
                <div className="form-group">
                  <label>Последние 4 цифры карты:</label>
                  <input
                    type="text"
                    className="input"
                    maxLength="4"
                    pattern="[0-9]{4}"
                    placeholder="1234"
                    value={paymentDetails.cardLast4}
                    onChange={(e) => setPaymentDetails({
                      ...paymentDetails,
                      cardLast4: e.target.value.replace(/\D/g, '')
                    })}
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'transfer' && (
              <div className="payment-details">
                <div className="form-group">
                  <label>Банк:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Название банка"
                    value={paymentDetails.bankName}
                    onChange={(e) => setPaymentDetails({
                      ...paymentDetails,
                      bankName: e.target.value
                    })}
                  />
                </div>
              </div>
            )}

            {paymentMethod !== 'cash' && (
              <div className="payment-details">
                <div className="form-group">
                  <label>Номер транзакции/чека (опционально):</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Номер транзакции"
                    value={paymentDetails.referenceNumber}
                    onChange={(e) => setPaymentDetails({
                      ...paymentDetails,
                      referenceNumber: e.target.value
                    })}
                  />
                </div>
              </div>
            )}

            <div className="payment-actions">
              <button
                className="btn btn-primary"
                onClick={processPayment}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? 'Обработка...' : 'Подтвердить оплату'}
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => setShowPaymentDialog(false)}
                disabled={isProcessingPayment}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!user || !['admin', 'manager', 'system_owner'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="card w-96">
          <div className="p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Доступ запрещен</h2>
            <p className="text-gray-600">
              Только администраторы и менеджеры могут осуществлять продажи товаров.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="headers">
        <div>
          <h1 className="page-title">Продажа товаров</h1>
          <p className="subtitle">Продажа товаров из инвентаря с обработкой платежей</p>
        </div>
        <div className="action-buttons">
          <button className="btn btn-outline" onClick={() => setShowCart(!showCart)}>
            Корзина ({getTotalItems()})
          </button>
          <button className="btn btn-outline" onClick={loadInventoryData}>Обновить</button>
        </div>
      </div>

      <div className="contents">
        <div className="sidebars">
          <div className="cards">
            <h2 className="cards-title">Фильтры</h2>
            <label>Поиск товаров</label>
            <input
              type="text"
              className="input"
              placeholder="Название или описание..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <label>Категория</label>
            <select
              className="input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Все категории</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <div className="stats">
              <p>Доступно товаров: <strong>{filteredInventory.length}</strong></p>
              <p>В корзине: <strong>{getTotalItems()}</strong></p>
            </div>
          </div>
        </div>

        <div className="main">
          {loading ? (
            <div className="loader">Загрузка...</div>
          ) : filteredInventory.length === 0 ? (
            <div className="cards empty">
              <h3>Товары не найдены</h3>
              <p>{searchTerm || selectedCategory ? 'Измените фильтры' : 'Нет доступных товаров'}</p>
            </div>
          ) : (
            <div className="grid">
              {filteredInventory.map((item) => (
                <div key={item.id} className="cards item-cards">
                  <h4>{item.name}</h4>
                  <p>{item.description || 'Нет описания'}</p>
                  <p>Категория: {item.category}</p>
                  <p><strong>{(item.cost_per_unit || 0).toLocaleString('ru-RU')} ₸</strong> за {item.unit}</p>
                  <p>В наличии: {item.current_stock}</p>

                  {cart.find(cartItem => cartItem.id === item.id) ? (
                    <div className="counter">
                      <button onClick={() => updateQuantity(item.id, cart.find(ci => ci.id === item.id).quantity - 1)}>-</button>
                      <span>{cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}</span>
                      <button onClick={() => updateQuantity(item.id, cart.find(ci => ci.id === item.id).quantity + 1)}>+</button>
                    </div>
                  ) : (
                    <button 
                      className="btn" 
                      onClick={() => addToCart(item)} 
                      disabled={item.current_stock === 0}
                    >
                      В корзину
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Корзина (обновленная) */}
      {showCart && (
        <div className="cart-overlay">
          <div className="cart">
            <button className="close-btn" onClick={() => setShowCart(false)}>
              <FiX size={20} />
            </button>
            <h2>Корзина покупок</h2>
            {cart.length === 0 ? (
              <p>Корзина пуста</p>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div>
                      <h4>{item.name}</h4>
                      <p>{item.quantity} × {item.price.toLocaleString('ru-RU')} ₸</p>
                      <p><strong>{item.total.toLocaleString('ru-RU')} ₸</strong></p>
                    </div>
                    <div className="counter">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                      <button onClick={() => removeFromCart(item.id)}>x</button>
                    </div>
                  </div>
                ))}

                <div className="cart-total">
                  <p>Итого: <strong>{getTotalAmount().toLocaleString('ru-RU')} ₸</strong></p>
                </div>

                <div className="checkout">
                  <div className="form-group">
                    <label htmlFor="rental-select">Связанная аренда (опционально):</label>
                    <select
                      id="rental-select"
                      className="input"
                      value={selectedRentalId}
                      onChange={(e) => {
                        const rentalId = e.target.value;
                        setSelectedRentalId(rentalId);

                        if (rentalId) {
                          const selectedRental = availableRentals.find(r => r.id === rentalId);
                          if (selectedRental) {
                            if (selectedRental.client) {
                              const { client } = selectedRental;
                              setCustomerInfo({
                                name: `${client.first_name} ${client.last_name}`,
                                phone: client.phone || '',
                                email: client.email || ''
                              });
                            }
                            setSelectedProperty(selectedRental.property.id);
                          }
                        } else {
                          setCustomerInfo({ name: '', phone: '', email: '' });
                          setSelectedProperty('');
                        }
                      }}
                    >
                      <option value="">Выберите аренду</option>
                      {availableRentals.map(rental => (
                        <option key={rental.id} value={rental.id}>
                          {rental.property.name} ({rental.property.number}) - {rental.client ? `${rental.client.first_name} ${rental.client.last_name}` : 'Без клиента'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="property-select">Помещение для доставки <span style={{color: 'red'}}>*</span>:</label>
                    <select
                      id="property-select"
                      className="input"
                      value={selectedProperty}
                      onChange={(e) => setSelectedProperty(e.target.value)}
                      required
                    >
                      <option value="">Выберите помещение</option>
                      {availableProperties.map(prop => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name} ({prop.number})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="customer-name">Имя покупателя <span style={{color: 'red'}}>*</span>:</label>
                    <input
                      id="customer-name"
                      type="text"
                      className="input"
                      placeholder="Введите имя покупателя"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="customer-phone">Телефон покупателя:</label>
                    <input
                      id="customer-phone"
                      type="tel"
                      className="input"
                      placeholder="Введите телефон"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    />
                  </div>

                  <div className="checkout-buttons">
                    <button
                      className="btn btn-primary"
                      onClick={processSale}
                      disabled={isProcessingSale || !selectedProperty || !customerInfo.name.trim()}
                    >
                      {isProcessingSale ? 'Создание заказа...' : 'Создать заказ и оплатить'}
                    </button>
                    <button className="btn btn-outline" onClick={clearCart}>Очистить корзину</button>
                    <button className="btn btn-outline" onClick={() => setShowCart(false)}>Закрыть</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Диалог оплаты */}
      <PaymentDialog />
    </div>
  );
};

export default CreateOrders;