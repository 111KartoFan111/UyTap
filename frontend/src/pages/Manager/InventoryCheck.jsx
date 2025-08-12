import React, { useState, useEffect } from 'react';
import { FiPackage, FiDollarSign, FiCalculator, FiTrendingUp, FiAlertCircle, FiSave, FiX, FiInfo } from 'react-icons/fi';

const InventoryItemForm = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData = null, 
  isEditMode = false,
  categories = [] 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    sku: '',
    unit: 'шт',
    min_stock: 0,
    max_stock: null,
    current_stock: 0,
    // Новые поля для ценообразования
    purchase_price: null,
    selling_price: null,
    profit_margin: null,
    supplier: '',
    supplier_contact: '',
    supplier_email: '',
    barcode: '',
    location: '',
    is_active: true,
    track_expiry: false,
    expiry_date: null,
    // Дополнительные настройки
    auto_reorder: false,
    reorder_point: null,
    preferred_supplier_id: null,
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [pricingCalculations, setPricingCalculations] = useState({
    profitPerUnit: 0,
    markupPercentage: 0,
    marginPercentage: 0
  });

  // Инициализация формы при открытии
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && initialData) {
        setFormData({
          ...initialData,
          min_stock: initialData.min_stock || 0,
          max_stock: initialData.max_stock || null,
          purchase_price: initialData.purchase_price || null,
          selling_price: initialData.selling_price || null,
          profit_margin: initialData.profit_margin || null,
          is_active: initialData.is_active !== undefined ? initialData.is_active : true,
          track_expiry: initialData.track_expiry || false,
          auto_reorder: initialData.auto_reorder || false
        });
      } else {
        // Сброс формы для нового товара
        setFormData({
          name: '',
          description: '',
          category: '',
          sku: '',
          unit: 'шт',
          min_stock: 0,
          max_stock: null,
          current_stock: 0,
          purchase_price: null,
          selling_price: null,
          profit_margin: null,
          supplier: '',
          supplier_contact: '',
          supplier_email: '',
          barcode: '',
          location: '',
          is_active: true,
          track_expiry: false,
          expiry_date: null,
          auto_reorder: false,
          reorder_point: null,
          preferred_supplier_id: null,
          notes: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditMode, initialData]);

  // Автоматический расчет цен и маржи
  useEffect(() => {
    calculatePricing();
  }, [formData.purchase_price, formData.selling_price, formData.profit_margin]);

  const calculatePricing = () => {
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    const sellingPrice = parseFloat(formData.selling_price) || 0;
    const margin = parseFloat(formData.profit_margin) || 0;

    if (purchasePrice > 0 && sellingPrice > 0) {
      const profitPerUnit = sellingPrice - purchasePrice;
      const markupPercentage = (profitPerUnit / purchasePrice) * 100;
      const marginPercentage = (profitPerUnit / sellingPrice) * 100;

      setPricingCalculations({
        profitPerUnit: profitPerUnit.toFixed(2),
        markupPercentage: markupPercentage.toFixed(2),
        marginPercentage: marginPercentage.toFixed(2)
      });
    } else {
      setPricingCalculations({
        profitPerUnit: 0,
        markupPercentage: 0,
        marginPercentage: 0
      });
    }
  };

  // Автоматический расчет продажной цены по марже
  const calculateSellingPriceByMargin = (margin) => {
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    if (purchasePrice > 0 && margin > 0) {
      const sellingPrice = purchasePrice / (1 - margin / 100);
      setFormData(prev => ({
        ...prev,
        selling_price: sellingPrice.toFixed(2),
        profit_margin: margin
      }));
    }
  };

  // Автоматический расчет продажной цены по наценке
  const calculateSellingPriceByMarkup = (markup) => {
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    if (purchasePrice > 0 && markup > 0) {
      const sellingPrice = purchasePrice * (1 + markup / 100);
      setFormData(prev => ({
        ...prev,
        selling_price: sellingPrice.toFixed(2)
      }));
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Очищаем ошибку для этого поля
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Обязательные поля
    if (!formData.name.trim()) {
      newErrors.name = 'Название товара обязательно';
    }

    if (!formData.unit) {
      newErrors.unit = 'Единица измерения обязательна';
    }

    // Валидация цен
    if (formData.purchase_price && formData.selling_price) {
      const purchasePrice = parseFloat(formData.purchase_price);
      const sellingPrice = parseFloat(formData.selling_price);

      if (sellingPrice <= purchasePrice) {
        newErrors.selling_price = 'Продажная цена должна быть больше закупочной';
      }
    }

    // Валидация остатков
    if (formData.min_stock < 0) {
      newErrors.min_stock = 'Минимальный остаток не может быть отрицательным';
    }

    if (formData.max_stock && formData.max_stock <= formData.min_stock) {
      newErrors.max_stock = 'Максимальный остаток должен быть больше минимального';
    }

    if (formData.current_stock < 0) {
      newErrors.current_stock = 'Текущий остаток не может быть отрицательным';
    }

    // Валидация даты истечения
    if (formData.track_expiry && formData.expiry_date) {
      const expiryDate = new Date(formData.expiry_date);
      const today = new Date();
      
      if (expiryDate <= today) {
        newErrors.expiry_date = 'Дата истечения должна быть в будущем';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Подготавливаем данные для отправки
    const submitData = {
      ...formData,
      min_stock: parseInt(formData.min_stock) || 0,
      max_stock: formData.max_stock ? parseInt(formData.max_stock) : null,
      current_stock: parseInt(formData.current_stock) || 0,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : null,
      profit_margin: pricingCalculations.marginPercentage ? parseFloat(pricingCalculations.marginPercentage) : null,
      reorder_point: formData.reorder_point ? parseInt(formData.reorder_point) : null
    };

    onSubmit(submitData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0, 0, 0, 0.5)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000 
    }}>
      <div className="modal-content" style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        width: '90%', 
        maxWidth: '800px', 
        maxHeight: '90vh', 
        overflow: 'auto',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Заголовок */}
        <div style={{ 
          padding: '24px 24px 0 24px', 
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FiPackage size={24} style={{ color: '#3b82f6' }} />
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
                {isEditMode ? 'Редактировать товар' : 'Добавить новый товар'}
              </h2>
            </div>
            <button 
              onClick={onClose}
              style={{ 
                background: 'none', 
                border: 'none', 
                fontSize: '1.5rem', 
                cursor: 'pointer',
                color: '#6b7280',
                padding: '4px'
              }}
            >
              <FiX />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px 24px' }}>
          {/* Основная информация */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.1rem', 
              fontWeight: '600',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FiPackage size={18} />
              Основная информация
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Название товара <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Введите название товара"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: errors.name ? '2px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                {errors.name && (
                  <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {errors.name}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Категория
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  placeholder="Категория товара"
                  list="categories-list"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Контакт поставщика
                </label>
                <input
                  type="text"
                  value={formData.supplier_contact}
                  onChange={(e) => handleInputChange('supplier_contact', e.target.value)}
                  placeholder="Телефон поставщика"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Email поставщика
                </label>
                <input
                  type="email"
                  value={formData.supplier_email}
                  onChange={(e) => handleInputChange('supplier_email', e.target.value)}
                  placeholder="email@supplier.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Штрихкод
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => handleInputChange('barcode', e.target.value)}
                  placeholder="Штрихкод товара"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Местоположение на складе
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Стеллаж A1-B2"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                Примечания
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Дополнительные заметки о товаре"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Предупреждения и рекомендации */}
          {(formData.current_stock <= formData.min_stock && formData.current_stock > 0) && (
            <div style={{ 
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#fef3c7',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiAlertCircle size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#92400e' }}>
                  Внимание: Текущий остаток равен или ниже минимального уровня
                </span>
              </div>
            </div>
          )}

          {(!formData.purchase_price || !formData.selling_price) && (
            <div style={{ 
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#dbeafe',
              borderLeft: '4px solid #3b82f6',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiInfo size={16} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '14px', color: '#1e40af' }}>
                  Рекомендуется указать закупочную и продажную цены для корректного учета прибыльности
                </span>
              </div>
            </div>
          )}

          {/* Кнопки действий */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'flex-end',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button 
              type="button"
              onClick={onClose}
              style={{ 
                padding: '12px 24px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                color: '#374151'
              }}
            >
              Отмена
            </button>
            <button 
              type="submit"
              style={{ 
                padding: '12px 24px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FiSave size={16} />
              {isEditMode ? 'Сохранить изменения' : 'Создать товар'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryItemForm;