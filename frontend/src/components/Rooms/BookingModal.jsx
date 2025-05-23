import { useState } from 'react';
import { FiX, FiCalendar, FiUser, FiCreditCard } from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import './BookingModal.css';

const BookingModal = ({ room, onClose, onSubmit }) => {
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    checkInDate: '',
    checkOutDate: '',
    guestCount: 1,
    guests: [
      {
        fullName: '',
        phone: '',
        documentType: 'passport', // 'passport' or 'id'
        documentNumber: ''
      }
    ],
    paymentMethod: 'cash' // 'cash' or 'card'
  });

  const [errors, setErrors] = useState({});

  // Обновление количества гостей
  const handleGuestCountChange = (count) => {
    const newCount = Math.max(1, Math.min(10, count)); // Ограничиваем от 1 до 10 гостей
    const newGuests = [...formData.guests];
    
    if (newCount > formData.guestCount) {
      // Добавляем новых гостей
      for (let i = formData.guestCount; i < newCount; i++) {
        newGuests.push({
          fullName: '',
          phone: '',
          documentType: 'passport',
          documentNumber: ''
        });
      }
    } else if (newCount < formData.guestCount) {
      // Удаляем лишних гостей
      newGuests.splice(newCount);
    }

    setFormData({
      ...formData,
      guestCount: newCount,
      guests: newGuests
    });
  };

  // Обновление данных гостя
  const handleGuestChange = (index, field, value) => {
    const newGuests = [...formData.guests];
    newGuests[index] = {
      ...newGuests[index],
      [field]: value
    };
    setFormData({
      ...formData,
      guests: newGuests
    });
  };

  // Валидация формы
  const validateForm = () => {
    const newErrors = {};

    // Проверка дат
    if (!formData.checkInDate) {
      newErrors.checkInDate = t('booking.errors.checkInRequired');
    }
    if (!formData.checkOutDate) {
      newErrors.checkOutDate = t('booking.errors.checkOutRequired');
    }
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      if (checkIn >= checkOut) {
        newErrors.dates = t('booking.errors.invalidDateRange');
      }
      if (checkIn < new Date().setHours(0, 0, 0, 0)) {
        newErrors.checkInDate = t('booking.errors.pastDate');
      }
    }

    // Проверка данных гостей
    formData.guests.forEach((guest, index) => {
      if (!guest.fullName.trim()) {
        newErrors[`guest_${index}_fullName`] = t('booking.errors.fullNameRequired');
      }
      if (!guest.phone.trim()) {
        newErrors[`guest_${index}_phone`] = t('booking.errors.phoneRequired');
      }
      if (!guest.documentNumber.trim()) {
        newErrors[`guest_${index}_documentNumber`] = t('booking.errors.documentRequired');
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Отправка формы
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
      onClose();
    }
  };

  // Расчет количества ночей
  const calculateNights = () => {
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      const diffTime = checkOut - checkIn;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    return 0;
  };

  return (
    <div className="booking-modal-overlay" onClick={onClose}>
      <div className="booking-modal-content" onClick={e => e.stopPropagation()}>
        <div className="booking-modal-header">
          <h2>{t('booking.title')} - {room.type === 'Villa' ? room.number : `${t('rooms.room')} ${room.number}`}</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form className="booking-form" onSubmit={handleSubmit}>
          {/* Период аренды */}
          <div className="form-section">
            <h3>
              <FiCalendar /> {t('booking.rentalPeriod')}
            </h3>
            <div className="date-fields">
              <div className="form-field">
                <label>{t('booking.checkInDate')}</label>
                <input
                  type="date"
                  value={formData.checkInDate}
                  onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                  className={errors.checkInDate ? 'error' : ''}
                />
                {errors.checkInDate && <span className="error-text">{errors.checkInDate}</span>}
              </div>
              <div className="form-field">
                <label>{t('booking.checkOutDate')}</label>
                <input
                  type="date"
                  value={formData.checkOutDate}
                  onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                  className={errors.checkOutDate ? 'error' : ''}
                />
                {errors.checkOutDate && <span className="error-text">{errors.checkOutDate}</span>}
              </div>
            </div>
            {errors.dates && <span className="error-text">{errors.dates}</span>}
            
            {calculateNights() > 0 && (
              <div className="nights-info">
                {t('booking.nights', { count: calculateNights() })}
              </div>
            )}
          </div>

          {/* Количество гостей */}
          <div className="form-section">
            <h3>
              <FiUser /> {t('booking.guestCount')}
            </h3>
            <div className="guest-counter">
              <button
                type="button"
                className="counter-btn"
                onClick={() => handleGuestCountChange(formData.guestCount - 1)}
                disabled={formData.guestCount <= 1}
              >
                -
              </button>
              <span className="counter-value">{formData.guestCount}</span>
              <button
                type="button"
                className="counter-btn"
                onClick={() => handleGuestCountChange(formData.guestCount + 1)}
                disabled={formData.guestCount >= 10}
              >
                +
              </button>
            </div>
          </div>

          {/* Информация о гостях */}
          <div className="form-section">
            <h3>{t('booking.guestInformation')}</h3>
            {formData.guests.map((guest, index) => (
              <div key={index} className="guest-block">
                <h4>{t('booking.guest')} {index + 1}</h4>
                
                <div className="form-field">
                  <label>{t('booking.fullName')}</label>
                  <input
                    type="text"
                    value={guest.fullName}
                    onChange={(e) => handleGuestChange(index, 'fullName', e.target.value)}
                    placeholder={t('booking.fullNamePlaceholder')}
                    className={errors[`guest_${index}_fullName`] ? 'error' : ''}
                  />
                  {errors[`guest_${index}_fullName`] && (
                    <span className="error-text">{errors[`guest_${index}_fullName`]}</span>
                  )}
                </div>

                <div className="form-field">
                  <label>{t('booking.phone')}</label>
                  <input
                    type="tel"
                    value={guest.phone}
                    onChange={(e) => handleGuestChange(index, 'phone', e.target.value)}
                    placeholder="+7 (xxx) xxx-xx-xx"
                    className={errors[`guest_${index}_phone`] ? 'error' : ''}
                  />
                  {errors[`guest_${index}_phone`] && (
                    <span className="error-text">{errors[`guest_${index}_phone`]}</span>
                  )}
                </div>

                <div className="document-fields">
                  <div className="form-field">
                    <label>{t('booking.documentType')}</label>
                    <select
                      value={guest.documentType}
                      onChange={(e) => handleGuestChange(index, 'documentType', e.target.value)}
                    >
                      <option value="passport">{t('booking.passport')}</option>
                      <option value="id">{t('booking.idCard')}</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>{t('booking.documentNumber')}</label>
                    <input
                      type="text"
                      value={guest.documentNumber}
                      onChange={(e) => handleGuestChange(index, 'documentNumber', e.target.value)}
                      placeholder={guest.documentType === 'passport' ? 'N12345678' : '123456789012'}
                      className={errors[`guest_${index}_documentNumber`] ? 'error' : ''}
                    />
                    {errors[`guest_${index}_documentNumber`] && (
                      <span className="error-text">{errors[`guest_${index}_documentNumber`]}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Способ оплаты */}
          <div className="form-section">
            <h3>
              <FiCreditCard /> {t('booking.paymentMethod')}
            </h3>
            <div className="payment-options">
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={formData.paymentMethod === 'cash'}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                />
                <span>{t('booking.cash')}</span>
              </label>
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={formData.paymentMethod === 'card'}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                />
                <span>{t('booking.card')}</span>
              </label>
            </div>
          </div>

          {/* Кнопки */}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-submit">
              {t('booking.confirmBooking')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;