// frontend/src/pages/Manager/Orders/CreateOrders.jsx - ИСПРАВЛЕННАЯ ВЕРСИЯ
import React, { useState, useEffect } from 'react';
import './CreateOrders.css';
import {
  Search,
  Filter,
  Package,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Receipt,
  User,
  Calendar,
  Check,
  AlertCircle,
  DollarSign,
  Package2,
  Trash2,
  Edit,
  FileText,
  Clipboard,
  File,
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

  const processSale = async () => {
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

      // ИСПРАВЛЕНО: Заказ создается уже со списанием товаров
      // Просто завершаем заказ без дополнительного списания
      console.log('Completing order:', createdOrder.id);
      const completionResult = await orders.complete(
        createdOrder.id, 
        `Продажа завершена. Покупатель: ${customerInfo.name}`
      );
      console.log('Order completed:', completionResult);

      utils.showSuccess('Продажа успешно завершена!');

      // Очищаем форму
      setCart([]);
      setCustomerInfo({ name: '', phone: '', email: '' });
      setSelectedProperty('');
      setSelectedRentalId('');
      setShowCart(false);

      // Перезагружаем инвентарь для обновления остатков
      await loadInventoryData();

    } catch (error) {
      console.error('Sale processing error:', error);
      utils.showError('Ошибка при обработке продажи: ' + error.message);
    } finally {
      setIsProcessingSale(false);
    }
  };

  const clearCart = () => {
    setCart([]);
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
          <p className="subtitle">Продажа товаров из инвентаря</p>
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
                            // Автоматически устанавливаем помещение
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
                      {isProcessingSale ? 'Обработка...' : 'Завершить продажу'}
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
    </div>
  );
};

export default CreateOrders;