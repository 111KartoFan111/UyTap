import React, { useState, useEffect } from 'react';
import { 
  FiDollarSign, 
  FiCreditCard, 
  FiCheck, 
  FiX, 
  FiPlus,
  FiEye,
  FiAlertCircle,
  FiRefreshCw
} from 'react-icons/fi';

const PaymentManager = ({ rental, onClose, onPaymentUpdate }) => {
  const [payments, setPayments] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  
  // Форма добавления платежа
  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_method: 'cash',
    payment_type: 'rent_payment',
    description: '',
    payer_name: '',
    reference_number: '',
    card_last4: '',
    notes: ''
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (rental) {
      loadPaymentData();
    }
  }, [rental]);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      
      // Загружаем статус платежей и историю
      const [statusData, historyData] = await Promise.all([
        fetchPaymentStatus(rental.id),
        fetchPaymentHistory(rental.id)
      ]);
      
      setPaymentStatus(statusData);
      setPayments(historyData.payments || []);
      
    } catch (error) {
      console.error('Failed to load payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock API calls - замените на реальные вызовы API
  const fetchPaymentStatus = async (rentalId) => {
    // Имитация API вызова
    return {
      rental_id: rentalId,
      total_amount: rental.total_amount,
      paid_amount: rental.paid_amount || 0,
      outstanding_amount: rental.total_amount - (rental.paid_amount || 0),
      deposit_amount: rental.deposit || 0,
      payment_completion_percentage: ((rental.paid_amount || 0) / rental.total_amount) * 100,
      is_fully_paid: (rental.paid_amount || 0) >= rental.total_amount,
      payment_count: 0,
      payment_methods_used: []
    };
  };

  const fetchPaymentHistory = async (rentalId) => {
    // Имитация API вызова
    return {
      rental_id: rentalId,
      payments: [],
      total_payments: 0,
      total_paid_amount: rental.paid_amount || 0
    };
  };

  const addPayment = async () => {
    try {
      const errors = validatePaymentForm();
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      setLoading(true);
      
      // Здесь должен быть реальный API вызов
      const newPayment = {
        id: Date.now().toString(),
        amount: parseFloat(paymentForm.payment_amount),
        payment_method: paymentForm.payment_method,
        payment_type: paymentForm.payment_type,
        description: paymentForm.description || `Оплата аренды ${rental.property?.number || ''}`,
        payer_name: paymentForm.payer_name,
        reference_number: paymentForm.reference_number,
        card_last4: paymentForm.card_last4,
        status: 'completed',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        notes: paymentForm.notes
      };

      // Обновляем локальное состояние
      setPayments(prev => [newPayment, ...prev]);
      
      // Обновляем статус платежей
      const newPaidAmount = (paymentStatus.paid_amount || 0) + newPayment.amount;
      setPaymentStatus(prev => ({
        ...prev,
        paid_amount: newPaidAmount,
        outstanding_amount: prev.total_amount - newPaidAmount,
        payment_completion_percentage: (newPaidAmount / prev.total_amount) * 100,
        is_fully_paid: newPaidAmount >= prev.total_amount,
        payment_count: prev.payment_count + 1
      }));

      // Сбрасываем форму
      setPaymentForm({
        payment_amount: '',
        payment_method: 'cash',
        payment_type: 'rent_payment',
        description: '',
        payer_name: '',
        reference_number: '',
        card_last4: '',
        notes: ''
      });
      
      setShowAddPayment(false);
      setFormErrors({});
      
      // Уведомляем родительский компонент
      if (onPaymentUpdate) {
        onPaymentUpdate({
          ...rental,
          paid_amount: newPaidAmount
        });
      }

      alert('Платеж успешно добавлен!');
      
    } catch (error) {
      console.error('Failed to add payment:', error);
      alert('Ошибка при добавлении платежа: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const validatePaymentForm = () => {
    const errors = {};
    
    if (!paymentForm.payment_amount || parseFloat(paymentForm.payment_amount) <= 0) {
      errors.payment_amount = 'Введите корректную сумму';
    }
    
    if (parseFloat(paymentForm.payment_amount) > (paymentStatus?.outstanding_amount || 0)) {
      errors.payment_amount = 'Сумма превышает задолженность';
    }
    
    if (!paymentForm.payment_method) {
      errors.payment_method = 'Выберите способ оплаты';
    }
    
    if (paymentForm.payment_method === 'card' && paymentForm.card_last4 && 
        (paymentForm.card_last4.length !== 4 || !/^\d{4}$/.test(paymentForm.card_last4))) {
      errors.card_last4 = 'Введите последние 4 цифры карты';
    }
    
    return errors;
  };

  const handleQuickPayment = (amount) => {
    setPaymentForm(prev => ({
      ...prev,
      payment_amount: amount.toString(),
      description: `Быстрая оплата: ₸${amount.toLocaleString()}`
    }));
    setShowAddPayment(true);
  };

  const formatCurrency = (amount) => {
    return `₸ ${(amount || 0).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
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

  const getPaymentTypeName = (type) => {
    const types = {
      deposit: 'Залог',
      rent_payment: 'Основная оплата',
      additional: 'Дополнительная оплата',
      penalty: 'Штраф',
      refund: 'Возврат'
    };
    return types[type] || type;
  };

  if (loading && !paymentStatus) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <div className="flex items-center justify-center">
            <FiRefreshCw className="animate-spin mr-2" />
            Загрузка данных о платежах...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <FiDollarSign className="mr-2" />
              Управление платежами
            </h2>
            <p className="text-blue-100 text-sm">
              Аренда: {rental.property?.name || rental.property?.number || 'Помещение'} | 
              Клиент: {rental.client ? `${rental.client.first_name} ${rental.client.last_name}` : 'Не указан'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:bg-blue-700 p-2 rounded"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto h-full">
          {/* Payment Status Overview */}
          {paymentStatus && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Статус оплаты</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Общая сумма</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {formatCurrency(paymentStatus.total_amount)}
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600">Оплачено</div>
                  <div className="text-xl font-semibold text-green-700">
                    {formatCurrency(paymentStatus.paid_amount)}
                  </div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-red-600">К доплате</div>
                  <div className="text-xl font-semibold text-red-700">
                    {formatCurrency(paymentStatus.outstanding_amount)}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Прогресс оплаты</span>
                  <span className="text-sm text-gray-600">
                    {paymentStatus.payment_completion_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-300 ${
                      paymentStatus.is_fully_paid ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ 
                      width: `${Math.min(paymentStatus.payment_completion_percentage, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>

              {/* Payment Status Alert */}
              <div className={`p-4 rounded-lg flex items-center ${
                paymentStatus.is_fully_paid 
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
              }`}>
                {paymentStatus.is_fully_paid ? (
                  <>
                    <FiCheck className="mr-2 text-green-600" />
                    Оплата полностью завершена
                  </>
                ) : (
                  <>
                    <FiAlertCircle className="mr-2 text-yellow-600" />
                    Требуется доплата: {formatCurrency(paymentStatus.outstanding_amount)}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Quick Payment Actions */}
          {paymentStatus && !paymentStatus.is_fully_paid && (
            <div className="mb-6">
              <h4 className="font-medium mb-3">Быстрые действия</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleQuickPayment(paymentStatus.outstanding_amount)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
                >
                  <FiCheck className="mr-2" />
                  Полная оплата ({formatCurrency(paymentStatus.outstanding_amount)})
                </button>
                
                {paymentStatus.outstanding_amount > 1000 && (
                  <button
                    onClick={() => handleQuickPayment(Math.round(paymentStatus.outstanding_amount / 2))}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Половина суммы
                  </button>
                )}
                
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center"
                >
                  <FiPlus className="mr-2" />
                  Добавить платеж
                </button>
              </div>
            </div>
          )}

          {/* Add Payment Form */}
          {showAddPayment && (
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-4">Добавить платеж</h4>
              
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
                    className={`w-full p-2 border rounded-lg ${
                      formErrors.payment_amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {formErrors.payment_amount && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.payment_amount}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Способ оплаты *</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      payment_method: e.target.value
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="cash">Наличные</option>
                    <option value="card">Банковская карта</option>
                    <option value="transfer">Перевод</option>
                    <option value="qr_code">QR-код</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Тип платежа</label>
                  <select
                    value={paymentForm.payment_type}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      payment_type: e.target.value
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="rent_payment">Основная оплата</option>
                    <option value="deposit">Залог</option>
                    <option value="additional">Дополнительная оплата</option>
                    <option value="penalty">Штраф</option>
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
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="ФИО плательщика"
                  />
                </div>

                {paymentForm.payment_method === 'card' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Последние 4 цифры карты</label>
                    <input
                      type="text"
                      maxLength="4"
                      value={paymentForm.card_last4}
                      onChange={(e) => setPaymentForm(prev => ({
                        ...prev,
                        card_last4: e.target.value.replace(/\D/g, '')
                      }))}
                      className={`w-full p-2 border rounded-lg ${
                        formErrors.card_last4 ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="1234"
                    />
                    {formErrors.card_last4 && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.card_last4}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Номер документа</label>
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      reference_number: e.target.value
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="Номер чека/операции"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Описание</label>
                  <input
                    type="text"
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      description: e.target.value
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="Описание платежа"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Примечания</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    rows="2"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="Дополнительные примечания"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowAddPayment(false);
                    setFormErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  onClick={addPayment}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {loading ? (
                    <FiRefreshCw className="animate-spin mr-2" />
                  ) : (
                    <FiCheck className="mr-2" />
                  )}
                  Добавить платеж
                </button>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div>
            <h4 className="font-medium mb-4">История платежей ({payments.length})</h4>
            
            {payments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FiCreditCard size={48} className="mx-auto mb-4 text-gray-300" />
                <p>Платежи не найдены</p>
                <p className="text-sm">Добавьте первый платеж для этой аренды</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-lg">
                            {formatCurrency(payment.amount)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            payment.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {payment.status === 'completed' ? 'Завершен' : payment.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Способ: </span>
                            {getPaymentMethodName(payment.payment_method)}
                            {payment.card_last4 && ` (*${payment.card_last4})`}
                          </div>
                          <div>
                            <span className="font-medium">Тип: </span>
                            {getPaymentTypeName(payment.payment_type)}
                          </div>
                          <div>
                            <span className="font-medium">Дата: </span>
                            {formatDate(payment.completed_at || payment.created_at)}
                          </div>
                          {payment.reference_number && (
                            <div>
                              <span className="font-medium">Документ: </span>
                              {payment.reference_number}
                            </div>
                          )}
                        </div>
                        
                        {payment.description && (
                          <div className="mt-2 text-sm text-gray-700">
                            {payment.description}
                          </div>
                        )}
                        
                        {payment.payer_name && (
                          <div className="mt-1 text-sm text-gray-600">
                            Плательщик: {payment.payer_name}
                          </div>
                        )}
                      </div>
                      
                      <button className="text-gray-400 hover:text-gray-600 p-1">
                        <FiEye size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Основной компонент для демонстрации
const RentalPaymentApp = () => {
  const [showPaymentManager, setShowPaymentManager] = useState(false);
  const [selectedRental, setSelectedRental] = useState(null);

  // Пример данных аренды
  const mockRental = {
    id: "rental-123",
    total_amount: 50000,
    paid_amount: 0, // Проблема: оплата 0
    deposit: 10000,
    property: {
      id: "prop-1",
      name: "Комната 101",
      number: "101"
    },
    client: {
      id: "client-1",
      first_name: "Иван",
      last_name: "Петров"
    },
    start_date: "2024-03-01T14:00:00Z",
    end_date: "2024-03-03T12:00:00Z",
    checked_in: true,
    checked_out: true,
    is_active: false
  };

  const handleOpenPayments = () => {
    setSelectedRental(mockRental);
    setShowPaymentManager(true);
  };

  const handlePaymentUpdate = (updatedRental) => {
    console.log('Rental updated with payment:', updatedRental);
    // Здесь обновите локальное состояние или перезагрузите данные
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Система управления платежами</h1>
        
        {/* Пример карточки аренды */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Завершенная аренда</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <span className="text-sm text-gray-600">Помещение:</span>
              <div className="font-medium">{mockRental.property.name}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Клиент:</span>
              <div className="font-medium">
                {mockRental.client.first_name} {mockRental.client.last_name}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Статус:</span>
              <div className="font-medium text-green-600">Завершено</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-sm text-gray-600">Общая сумма:</span>
              <div className="font-medium text-lg">₸ {mockRental.total_amount.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Оплачено:</span>
              <div className={`font-medium text-lg ${
                mockRental.paid_amount === 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                ₸ {mockRental.paid_amount.toLocaleString()}
              </div>
            </div>
          </div>
          
          {mockRental.paid_amount === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center text-red-800">
                <FiAlertCircle className="mr-2" />
                <span className="font-medium">Внимание! Оплата не получена</span>
              </div>
              <p className="text-red-600 text-sm ml-6">
                Клиент завершил аренду, но оплата отсутствует
              </p>
            </div>
          )}
          
          <button
            onClick={handleOpenPayments}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <FiDollarSign className="mr-2" />
            Управление платежами
          </button>
        </div>
        
        {/* Инструкции */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Как использовать:</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• Нажмите "Управление платежами" для добавления оплаты</li>
            <li>• Используйте быстрые действия для полной или частичной оплаты</li>
            <li>• Добавьте детали платежа: способ оплаты, номер документа</li>
            <li>• Система автоматически обновит статус оплаты аренды</li>
          </ul>
        </div>
      </div>

      {/* Payment Manager Modal */}
      {showPaymentManager && (
        <PaymentManager
          rental={selectedRental}
          onClose={() => setShowPaymentManager(false)}
          onPaymentUpdate={handlePaymentUpdate}
        />
      )}
    </div>
  );
};

export default RentalPaymentApp;