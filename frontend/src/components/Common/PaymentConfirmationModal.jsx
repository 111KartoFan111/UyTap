// frontend/src/components/Common/PaymentConfirmationModal.jsx
import { useState, useEffect } from 'react';
import { FiX, FiDollarSign, FiCreditCard, FiCheck, FiAlertCircle } from 'react-icons/fi';
import './PaymentConfirmationModal.css';

const PaymentConfirmationModal = ({ 
  rental, 
  property, 
  client, 
  onConfirm, 
  onCancel 
}) => {
  const [paymentData, setPaymentData] = useState({
    received_amount: 0,
    payment_method: 'cash',
    payment_notes: '',
    payment_confirmed: false
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (rental) {
      // Предлагаем к оплате оставшуюся сумму
      const remainingAmount = rental.total_amount - (rental.paid_amount || 0);
      setPaymentData(prev => ({
        ...prev,
        received_amount: remainingAmount
      }));
    }
  }, [rental]);

  const validatePayment = () => {
    const newErrors = {};

    if (!paymentData.payment_confirmed) {
      newErrors.payment_confirmed = 'Необходимо подтвердить получение оплаты';
    }

    if (paymentData.received_amount <= 0) {
      newErrors.received_amount = 'Сумма оплаты должна быть больше 0';
    }

    if (paymentData.received_amount > (rental.total_amount - rental.paid_amount)) {
      newErrors.received_amount = 'Сумма не может превышать оставшуюся к доплате';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (validatePayment()) {
      onConfirm(paymentData);
    }
  };

  const formatCurrency = (amount) => {
    return `₸ ${amount.toLocaleString()}`;
  };

  const remainingAmount = rental ? rental.total_amount - (rental.paid_amount || 0) : 0;

  return (
    <div className="payment-modal-overlay" onClick={onCancel}>
      <div className="payment-modal-content" onClick={e => e.stopPropagation()}>
        <div className="payment-modal-header">
          <h2>
            <FiDollarSign /> Подтверждение оплаты при заселении
          </h2>
          <button className="close-btn" onClick={onCancel}>
            <FiX size={20} />
          </button>
        </div>

        <div className="payment-modal-body">
          {/* Информация об аренде */}
          <div className="rental-info-section">
            <h3>Информация об аренде</h3>
            <div className="rental-details">
              <div className="detail-item">
                <span>Помещение:</span>
                <span>{property?.number} - {property?.name}</span>
              </div>
              <div className="detail-item">
                <span>Клиент:</span>
                <span>{client?.first_name} {client?.last_name}</span>
              </div>
              <div className="detail-item">
                <span>Период:</span>
                <span>
                  {new Date(rental?.start_date).toLocaleDateString()} - 
                  {new Date(rental?.end_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Финансовая информация */}
          <div className="payment-info-section">
            <h3>Финансовая информация</h3>
            <div className="payment-breakdown">
              <div className="payment-row">
                <span>Общая стоимость:</span>
                <span className="amount total">{formatCurrency(rental?.total_amount || 0)}</span>
              </div>
              <div className="payment-row">
                <span>Уже оплачено:</span>
                <span className="amount paid">{formatCurrency(rental?.paid_amount || 0)}</span>
              </div>
              <div className="payment-row important">
                <span>К доплате:</span>
                <span className="amount remaining">{formatCurrency(remainingAmount)}</span>
              </div>
              {rental?.deposit > 0 && (
                <div className="payment-row">
                  <span>Депозит:</span>
                  <span className="amount deposit">{formatCurrency(rental.deposit)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Форма подтверждения оплаты */}
          <div className="payment-form-section">
            <h3>Подтверждение получения оплаты</h3>
            
            <div className="form-field">
              <label>Получена сумма *</label>
              <div className="amount-input">
                <span className="currency-symbol">₸</span>
                <input
                  type="number"
                  min="0"
                  max={remainingAmount}
                  step="100"
                  value={paymentData.received_amount}
                  onChange={(e) => setPaymentData(prev => ({
                    ...prev,
                    received_amount: parseFloat(e.target.value) || 0
                  }))}
                  className={errors.received_amount ? 'error' : ''}
                />
              </div>
              {errors.received_amount && (
                <span className="error-text">{errors.received_amount}</span>
              )}
            </div>

            <div className="form-field">
              <label>Способ оплаты</label>
              <div className="payment-methods">
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="payment_method"
                    value="cash"
                    checked={paymentData.payment_method === 'cash'}
                    onChange={(e) => setPaymentData(prev => ({
                      ...prev,
                      payment_method: e.target.value
                    }))}
                  />
                  <FiDollarSign />
                  <span>Наличные</span>
                </label>
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="payment_method"
                    value="card"
                    checked={paymentData.payment_method === 'card'}
                    onChange={(e) => setPaymentData(prev => ({
                      ...prev,
                      payment_method: e.target.value
                    }))}
                  />
                  <FiCreditCard />
                  <span>Банковская карта</span>
                </label>
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="payment_method"
                    value="transfer"
                    checked={paymentData.payment_method === 'transfer'}
                    onChange={(e) => setPaymentData(prev => ({
                      ...prev,
                      payment_method: e.target.value
                    }))}
                  />
                  <FiCreditCard />
                  <span>Банковский перевод</span>
                </label>
              </div>
            </div>

            <div className="form-field">
              <label>Примечания к оплате</label>
              <textarea
                value={paymentData.payment_notes}
                onChange={(e) => setPaymentData(prev => ({
                  ...prev,
                  payment_notes: e.target.value
                }))}
                placeholder="Дополнительная информация об оплате..."
                rows="3"
              />
            </div>

            {/* Подтверждение */}
            <div className="confirmation-section">
              <label className="confirmation-checkbox">
                <input
                  type="checkbox"
                  checked={paymentData.payment_confirmed}
                  onChange={(e) => setPaymentData(prev => ({
                    ...prev,
                    payment_confirmed: e.target.checked
                  }))}
                />
                <FiCheck />
                <span>
                  Подтверждаю получение оплаты в размере {formatCurrency(paymentData.received_amount)} 
                  от клиента {client?.first_name} {client?.last_name}
                </span>
              </label>
              {errors.payment_confirmed && (
                <span className="error-text">{errors.payment_confirmed}</span>
              )}
            </div>

            {remainingAmount > paymentData.received_amount && (
              <div className="warning-section">
                <FiAlertCircle />
                <span>
                  Внимание: Получена частичная оплата. 
                  Остается к доплате: {formatCurrency(remainingAmount - paymentData.received_amount)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="payment-modal-actions">
          <button 
            type="button" 
            className="btn-cancel" 
            onClick={onCancel}
          >
            Отмена
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={!paymentData.payment_confirmed}
          >
            <FiCheck />
            Подтвердить оплату и заселить
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmationModal;