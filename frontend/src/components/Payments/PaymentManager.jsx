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
import { useData } from '../../contexts/DataContext';

const PaymentManager = ({ rental, onClose, onPaymentUpdate }) => {
  const { utils } = useData();
  
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
      
      // Загружаем статус платежей и историю через реальное API
      const [statusData, historyData] = await Promise.all([
        fetchPaymentStatus(rental.id),
        fetchPaymentHistory(rental.id)
      ]);
      
      setPaymentStatus(statusData);
      setPayments(historyData.payments || []);
      
    } catch (error) {
      console.error('Failed to load payment data:', error);
      utils.showError('Не удалось загрузить данные о платежах');
    } finally {
      setLoading(false);
    }
  };

  // Реальные API вызовы вместо моков
  const fetchPaymentStatus = async (rentalId) => {
    try {
      const response = await fetch(`//api/rentals/${rentalId}/payment-status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Payment status fetch failed:', error);
      // Возвращаем базовые данные на основе rental
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
    }
  };

  const fetchPaymentHistory = async (rentalId) => {
    try {
      const response = await fetch(`/api/rentals/${rentalId}/payments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment history');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Payment history fetch failed:', error);
      return {
        rental_id: rentalId,
        payments: [],
        total_payments: 0,
        total_paid_amount: rental.paid_amount || 0
      };
    }
  };

  const addPayment = async () => {
    try {
      const errors = validatePaymentForm();
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      setLoading(true);
      
      // Реальный API вызов для добавления платежа
      const response = await fetch(`/api/rentals/${rental.id}/payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_amount: parseFloat(paymentForm.payment_amount),
          payment_method: paymentForm.payment_method,
          payment_type: paymentForm.payment_type.toLowerCase(),
          description: paymentForm.description || `Оплата аренды ${rental.property?.number || ''}`,
          payer_name: paymentForm.payer_name,
          reference_number: paymentForm.reference_number,
          card_last4: paymentForm.card_last4,
          notes: paymentForm.notes,
          auto_complete: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Payment failed');
      }

      const newPayment = await response.json();

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

      utils.showSuccess('Платеж успешно добавлен!');
      
    } catch (error) {
      console.error('Failed to add payment:', error);
      utils.showError('Ошибка при добавлении платежа: ' + error.message);
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
      <div className="property-details-overlay">
        <div className="property-details-content" style={{ width: '400px', height: 'auto' }}>
          <div className="property-details-header">
            <h2>Загрузка данных о платежах...</h2>
            <button onClick={onClose} className="close-btn">
              <FiX size={20} />
            </button>
          </div>
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <FiRefreshCw className="animate-spin" size={32} style={{ marginBottom: '16px' }} />
            <p>Загружаем информацию о платежах...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="property-details-overlay" onClick={onClose}>
      <div className="property-details-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="property-details-header">
          <div className="header-info">
            <h2>
              <FiDollarSign /> Управление платежами
            </h2>
            <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
              Аренда: {rental.property?.name || rental.property?.number || 'Помещение'} | 
              Клиент: {rental.client ? `${rental.client.first_name} ${rental.client.last_name}` : 'Не указан'}
            </p>
          </div>
          <div className="header-actions">
            <button onClick={onClose} className="close-btn">
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="tabs-content" style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Payment Status Overview */}
          {paymentStatus && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#2c3e50' }}>
                Статус оплаты
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Общая сумма</div>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#2c3e50' }}>
                    {formatCurrency(paymentStatus.total_amount)}
                  </div>
                </div>
                
                <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '4px' }}>Оплачено</div>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#0369a1' }}>
                    {formatCurrency(paymentStatus.paid_amount)}
                  </div>
                </div>
                
                <div style={{ backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '4px' }}>К доплате</div>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#dc2626' }}>
                    {formatCurrency(paymentStatus.outstanding_amount)}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Прогресс оплаты</span>
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    {paymentStatus.payment_completion_percentage.toFixed(1)}%
                  </span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '12px' }}>
                  <div 
                    style={{ 
                      height: '12px', 
                      borderRadius: '9999px', 
                      transition: 'all 0.3s ease',
                      backgroundColor: paymentStatus.is_fully_paid ? '#10b981' : '#3b82f6',
                      width: `${Math.min(paymentStatus.payment_completion_percentage, 100)}%`
                    }}
                  />
                </div>
              </div>

              {/* Payment Status Alert */}
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: paymentStatus.is_fully_paid ? '#f0fdf4' : '#fef3c7',
                color: paymentStatus.is_fully_paid ? '#166534' : '#92400e',
                border: `1px solid ${paymentStatus.is_fully_paid ? '#bbf7d0' : '#fde68a'}`,
                marginBottom: '16px'
              }}>
                {paymentStatus.is_fully_paid ? (
                  <>
                    <FiCheck style={{ marginRight: '8px', color: '#10b981' }} />
                    Оплата полностью завершена
                  </>
                ) : (
                  <>
                    <FiAlertCircle style={{ marginRight: '8px', color: '#f59e0b' }} />
                    Требуется доплата: {formatCurrency(paymentStatus.outstanding_amount)}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Quick Payment Actions */}
          {paymentStatus && !paymentStatus.is_fully_paid && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontWeight: '500', marginBottom: '12px' }}>Быстрые действия</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  onClick={() => handleQuickPayment(paymentStatus.outstanding_amount)}
                  className="quick-action-btn primary"
                >
                  <FiCheck style={{ marginRight: '8px' }} />
                  Полная оплата ({formatCurrency(paymentStatus.outstanding_amount)})
                </button>
                
                {paymentStatus.outstanding_amount > 1000 && (
                  <button
                    onClick={() => handleQuickPayment(Math.round(paymentStatus.outstanding_amount / 2))}
                    className="quick-action-btn secondary"
                  >
                    Половина суммы
                  </button>
                )}
                
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="quick-action-btn secondary"
                >
                  <FiPlus style={{ marginRight: '8px' }} />
                  Добавить платеж
                </button>
              </div>
            </div>
          )}

          {/* Add Payment Form */}
          {showAddPayment && (
            <div style={{ 
              marginBottom: '24px', 
              backgroundColor: '#f8f9fa', 
              padding: '16px', 
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <h4 style={{ fontWeight: '500', marginBottom: '16px' }}>Добавить платеж</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Сумма *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.payment_amount}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      payment_amount: e.target.value
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: formErrors.payment_amount ? '1px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="0.00"
                  />
                  {formErrors.payment_amount && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {formErrors.payment_amount}
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Способ оплаты *
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      payment_method: e.target.value
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="cash">Наличные</option>
                    <option value="card">Банковская карта</option>
                    <option value="transfer">Перевод</option>
                    <option value="qr_code">QR-код</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Тип платежа
                  </label>
                  <select
                    value={paymentForm.payment_type}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      payment_type: e.target.value
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="rent_payment">Основная оплата</option>
                    <option value="deposit">Залог</option>
                    <option value="additional">Дополнительная оплата</option>
                    <option value="penalty">Штраф</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Плательщик
                  </label>
                  <input
                    type="text"
                    value={paymentForm.payer_name}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      payer_name: e.target.value
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="ФИО плательщика"
                  />
                </div>

                {paymentForm.payment_method === 'card' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                      Последние 4 цифры карты
                    </label>
                    <input
                      type="text"
                      maxLength="4"
                      value={paymentForm.card_last4}
                      onChange={(e) => setPaymentForm(prev => ({
                        ...prev,
                        card_last4: e.target.value.replace(/\D/g, '')
                      }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: formErrors.card_last4 ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      placeholder="1234"
                    />
                    {formErrors.card_last4 && (
                      <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                        {formErrors.card_last4}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Номер документа
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      reference_number: e.target.value
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="Номер чека/операции"
                  />
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                  Описание
                </label>
                <input
                  type="text"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  placeholder="Описание платежа"
                />
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                  Примечания
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  rows="2"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="Дополнительные примечания"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={() => {
                    setShowAddPayment(false);
                    setFormErrors({});
                  }}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={addPayment}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: loading ? '#9ca3af' : '#10b981',
                    color: 'white',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {loading ? (
                    <FiRefreshCw className="animate-spin" style={{ marginRight: '8px' }} />
                  ) : (
                    <FiCheck style={{ marginRight: '8px' }} />
                  )}
                  Добавить платеж
                </button>
              </div>
            </div>
          )}

          {!showAddPayment && paymentStatus?.outstanding_amount > 0 && (
            <button
              onClick={() => setShowAddPayment(true)}
              className="quick-action-btn primary"
              style={{ marginBottom: '24px' }}
            >
              <FiPlus style={{ marginRight: '8px' }} />
              Добавить платеж
            </button>
          )}

          {/* Payment History */}
          <div>
            <h4 style={{ fontWeight: '500', marginBottom: '16px' }}>
              История платежей ({payments.length})
            </h4>
            
            {payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: '#666' }}>
                <FiCreditCard size={48} style={{ margin: '0 auto 16px', color: '#d1d5db' }} />
                <p>Платежи не найдены</p>
                <p style={{ fontSize: '14px' }}>Добавьте первый платеж для этой аренды</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {payments.map((payment) => (
                  <div key={payment.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '500' }}>
                            {formatCurrency(payment.amount)}
                          </span>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: payment.status === 'completed' ? '#dcfce7' : payment.status === 'pending' ? '#fef3c7' : '#f3f4f6',
                            color: payment.status === 'completed' ? '#166534' : payment.status === 'pending' ? '#92400e' : '#374151'
                          }}>
                            {payment.status === 'completed' ? 'Завершен' : payment.status}
                          </span>
                        </div>
                        
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                          gap: '16px', 
                          fontSize: '14px', 
                          color: '#666',
                          marginBottom: '8px'
                        }}>
                          <div>
                            <span style={{ fontWeight: '500' }}>Способ: </span>
                            {getPaymentMethodName(payment.payment_method)}
                            {payment.card_last4 && ` (*${payment.card_last4})`}
                          </div>
                          <div>
                            <span style={{ fontWeight: '500' }}>Тип: </span>
                            {getPaymentTypeName(payment.payment_type)}
                          </div>
                          <div>
                            <span style={{ fontWeight: '500' }}>Дата: </span>
                            {formatDate(payment.completed_at || payment.created_at)}
                          </div>
                          {payment.reference_number && (
                            <div>
                              <span style={{ fontWeight: '500' }}>Документ: </span>
                              {payment.reference_number}
                            </div>
                          )}
                        </div>
                        
                        {payment.description && (
                          <div style={{ marginTop: '8px', fontSize: '14px', color: '#374151' }}>
                            {payment.description}
                          </div>
                        )}
                        
                        {payment.payer_name && (
                          <div style={{ marginTop: '4px', fontSize: '14px', color: '#666' }}>
                            Плательщик: {payment.payer_name}
                          </div>
                        )}
                        
                        {payment.notes && (
                          <div style={{ marginTop: '8px', fontSize: '14px', color: '#374151', backgroundColor: '#f9fafb', padding: '8px', borderRadius: '4px' }}>
                            {payment.notes}
                          </div>
                        )}
                      </div>
                      
                      <button style={{
                        color: '#9ca3af',
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}>
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

export default PaymentManager;
