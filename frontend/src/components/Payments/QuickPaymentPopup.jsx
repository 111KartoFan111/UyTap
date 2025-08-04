import React, { useState } from 'react';
import { FiDollarSign, FiCheck, FiX, FiCreditCard } from 'react-icons/fi';

const QuickPaymentPopup = ({ rental, onClose, onPaymentAdd, position }) => {
  const [paymentData, setPaymentData] = useState({
    amount: rental.total_amount - (rental.paid_amount || 0), // По умолчанию остаток к доплате
    method: 'cash',
    type: 'rent_payment'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (paymentData.amount <= 0) {
      alert('Введите корректную сумму');
      return;
    }
    
    try {
      setLoading(true);
      
      // Формируем данные платежа
      const payment = {
        payment_amount: parseFloat(paymentData.amount),
        payment_method: paymentData.method,
        payment_type: paymentData.type,
        description: `Быструю оплата аренды ${rental.property?.number || ''}`,
        auto_complete: true
      };
      
      await onPaymentAdd(rental.id, payment);
      onClose();
      
    } catch (error) {
      console.error('Quick payment failed:', error);
      alert('Ошибка при добавлении платежа: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const outstanding = rental.total_amount - (rental.paid_amount || 0);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-start justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-4 w-80 mt-20"
        style={{
          position: 'absolute',
          top: position?.y || '20%',
          left: position?.x || '50%',
          transform: 'translateX(-50%)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center">
            <FiDollarSign className="mr-2 text-green-600" />
            Быстрая оплата
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FiX />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-600">
            Аренда: {rental.property?.name || rental.property?.number}
          </div>
          <div className="text-sm text-gray-600">
            Клиент: {rental.client ? `${rental.client.first_name} ${rental.client.last_name}` : 'Не указан'}
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-sm">К доплате:</span>
            <span className="font-semibold text-red-600">
              ₸ {outstanding.toLocaleString()}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Сумма</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={outstanding}
                value={paymentData.amount}
                onChange={(e) => setPaymentData(prev => ({
                  ...prev,
                  amount: e.target.value
                }))}
                className="w-full p-2 pl-8 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
              <FiDollarSign className="absolute left-2 top-2.5 text-gray-400" size={16} />
            </div>
            <div className="flex gap-1 mt-1">
              <button
                type="button"
                onClick={() => setPaymentData(prev => ({...prev, amount: outstanding}))}
                className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
              >
                Весь остаток
              </button>
              <button
                type="button"
                onClick={() => setPaymentData(prev => ({...prev, amount: Math.round(outstanding / 2)}))}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200"
              >
                Половина
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Способ оплаты</label>
            <select
              value={paymentData.method}
              onChange={(e) => setPaymentData(prev => ({
                ...prev,
                method: e.target.value
              }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">💵 Наличные</option>
              <option value="card">💳 Банковская карта</option>
              <option value="transfer">🏦 Перевод</option>
              <option value="qr_code">📱 QR-код</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Тип платежа</label>
            <select
              value={paymentData.type}
              onChange={(e) => setPaymentData(prev => ({
                ...prev,
                type: e.target.value
              }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="rent_payment">Основная оплата</option>
              <option value="deposit">Залог</option>
              <option value="additional">Дополнительная оплата</option>
              <option value="penalty">Штраф</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !paymentData.amount}
              className="flex-1 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <FiCheck className="mr-1" />
                  Добавить
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Демонстрационный компонент с примером использования
const RentalTableWithQuickPayment = () => {
  const [showQuickPayment, setShowQuickPayment] = useState(false);
  const [selectedRental, setSelectedRental] = useState(null);
  const [rentals, setRentals] = useState([
    {
      id: "1",
      total_amount: 50000,
      paid_amount: 0,
      property: { number: "101", name: "Комната 101" },
      client: { first_name: "Иван", last_name: "Петров" },
      status: "completed"
    },
    {
      id: "2", 
      total_amount: 75000,
      paid_amount: 25000,
      property: { number: "102", name: "Комната 102" },
      client: { first_name: "Мария", last_name: "Сидорова" },
      status: "active"
    },
    {
      id: "3",
      total_amount: 60000,
      paid_amount: 60000,
      property: { number: "103", name: "Комната 103" },
      client: { first_name: "Петр", last_name: "Козлов" },
      status: "completed"
    }
  ]);

  const handleQuickPayment = (rental, event) => {
    // Получаем позицию клика для размещения попапа
    const rect = event.target.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY
    };
    
    setSelectedRental({ ...rental, popupPosition: position });
    setShowQuickPayment(true);
  };

  const handlePaymentAdd = async (rentalId, paymentData) => {
    // Имитация API вызова
    console.log('Adding payment:', { rentalId, paymentData });
    
    // Обновляем локальное состояние
    setRentals(prev => prev.map(rental => {
      if (rental.id === rentalId) {
        return {
          ...rental,
          paid_amount: (rental.paid_amount || 0) + paymentData.payment_amount
        };
      }
      return rental;
    }));
    
    // Имитация задержки API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    alert(`Платеж на сумму ₸${paymentData.payment_amount.toLocaleString()} успешно добавлен!`);
  };

  const getPaymentStatus = (rental) => {
    const paid = rental.paid_amount || 0;
    const total = rental.total_amount;
    
    if (paid === 0) return { status: 'unpaid', text: '❌ Не оплачено', color: 'text-red-600' };
    if (paid < total) return { status: 'partial', text: '⚠️ Частично', color: 'text-yellow-600' };
    return { status: 'paid', text: '✅ Оплачено', color: 'text-green-600' };
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Управление арендой с быстрыми платежами</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Помещение</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Клиент</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Сумма/Оплата</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Статус</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rentals.map((rental) => {
              const paymentStatus = getPaymentStatus(rental);
              const outstanding = rental.total_amount - (rental.paid_amount || 0);
              
              return (
                <tr key={rental.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="font-medium">{rental.property.name}</div>
                    <div className="text-sm text-gray-500">#{rental.property.number}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium">
                      {rental.client.first_name} {rental.client.last_name}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-600">Сумма: </span>
                        <span className="font-medium">₸ {rental.total_amount.toLocaleString()}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Оплачено: </span>
                        <span className="font-medium">₸ {(rental.paid_amount || 0).toLocaleString()}</span>
                      </div>
                      {outstanding > 0 && (
                        <div className="text-sm">
                          <span className="text-gray-600">К доплате: </span>
                          <span className="font-medium text-red-600">₸ {outstanding.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Прогресс-бар */}
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          paymentStatus.status === 'paid' ? 'bg-green-500' : 
                          paymentStatus.status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ 
                          width: `${Math.min(((rental.paid_amount || 0) / rental.total_amount) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-sm font-medium ${paymentStatus.color}`}>
                      {paymentStatus.text}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {outstanding > 0 && (
                        <button
                          onClick={(e) => handleQuickPayment(rental, e)}
                          className={`p-2 rounded-full hover:scale-110 transition-all ${
                            rental.paid_amount === 0 
                              ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                              : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                          }`}
                          title={`Добавить платеж (₸${outstanding.toLocaleString()})`}
                        >
                          <FiDollarSign size={16} />
                        </button>
                      )}
                      
                      {paymentStatus.status === 'paid' && (
                        <button
                          className="p-2 rounded-full bg-green-100 text-green-600"
                          title="Полностью оплачено"
                        >
                          <FiCheck size={16} />
                        </button>
                      )}
                      
                      <button
                        className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
                        title="Подробная информация о платежах"
                      >
                        <FiCreditCard size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Легенда */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Быстрые платежи:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
            <span>Красная кнопка = Нет оплаты</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-500 rounded-full mr-2"></div>
            <span>Желтая кнопка = Частичная оплата</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
            <span>Зеленая галочка = Полная оплата</span>
          </div>
        </div>
        <p className="text-blue-700 text-sm mt-2">
          💡 Нажмите на цветную кнопку для быстрого добавления платежа
        </p>
      </div>

      {/* Quick Payment Popup */}
      {showQuickPayment && selectedRental && (
        <QuickPaymentPopup
          rental={selectedRental}
          position={selectedRental.popupPosition}
          onClose={() => setShowQuickPayment(false)}
          onPaymentAdd={handlePaymentAdd}
        />
      )}
    </div>
  );
};

export default RentalTableWithQuickPayment;