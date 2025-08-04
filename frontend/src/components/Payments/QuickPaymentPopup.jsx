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
    e.stopPropagation();
    
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
        description: `Быстрая оплата аренды ${rental.property?.number || ''}`,
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
      className="bg-white rounded-lg shadow-xl p-4 w-80"
      onClick={e => e.stopPropagation()}
      style={{
        maxWidth: '90vw',
        position: 'relative',
        zIndex: 10002
      }}
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
  );
};

export default QuickPaymentPopup;