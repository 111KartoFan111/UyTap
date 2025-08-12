import React, { useState, useEffect } from 'react';
import { 
  FiFileText, 
  FiX, 
  FiCalendar, 
  FiDollarSign, 
  FiDownload, 
  FiEye, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiInfo,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiBarChart2,
  FiSettings
} from 'react-icons/fi';

const ComprehensiveReportModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1); // 1: Настройки, 2: Предпросмотр, 3: Генерация
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [templates, setTemplates] = useState(null);
  
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    format: 'xlsx',
    utility_bills_amount: 0,
    additional_admin_expenses: []
  });

  const [validationResult, setValidationResult] = useState(null);
  const [errors, setErrors] = useState({});

  // Инициализация даты (последний месяц)
  useEffect(() => {
    if (isOpen && !formData.start_date) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      
      setFormData(prev => ({
        ...prev,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      }));
    }
  }, [isOpen]);

  // Загрузка шаблонов при открытии
  useEffect(() => {
    if (isOpen && step === 1) {
      loadExpenseTemplates();
    }
  }, [isOpen, step]);

  const loadExpenseTemplates = async () => {
    try {
      // Имитация API вызова для получения шаблонов
      const mockTemplates = {
        operational: [
          { category: "utility_bills", description: "Коммунальные услуги", amount: 150000, frequency: "monthly" },
          { category: "internet_phone", description: "Интернет и связь", amount: 25000, frequency: "monthly" },
          { category: "cleaning_supplies", description: "Моющие средства", amount: 35000, frequency: "monthly" }
        ],
        administrative: [
          { category: "legal_services", description: "Юридические услуги", amount: 80000, frequency: "monthly" },
          { category: "accounting_services", description: "Бухгалтерские услуги", amount: 120000, frequency: "monthly" },
          { category: "bank_services", description: "Банковское обслуживание", amount: 15000, frequency: "monthly" }
        ],
        marketing: [
          { category: "advertising", description: "Реклама в интернете", amount: 100000, frequency: "monthly" },
          { category: "social_media", description: "Продвижение в соцсетях", amount: 40000, frequency: "monthly" }
        ]
      };
      
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.start_date) {
      newErrors.start_date = 'Укажите дату начала периода';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'Укажите дату окончания периода';
    }

    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);

      if (startDate >= endDate) {
        newErrors.end_date = 'Дата окончания должна быть позже даты начала';
      }

      // Проверяем, что период не слишком большой (не более года)
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 365) {
        newErrors.end_date = 'Период отчета не может превышать один год';
      }
    }

    if (formData.utility_bills_amount < 0) {
      newErrors.utility_bills_amount = 'Сумма не может быть отрицательной';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!validateForm()) {
        return;
      }
      
      setStep(2);
      await loadPreview();
    } else if (step === 2) {
      setStep(3);
      await generateReport();
    }
  };

  const loadPreview = async () => {
    try {
      setLoading(true);
      
      // Имитация API вызова для предпросмотра
      const mockPreview = {
        organization_name: "Моя Организация",
        report_period: {
          start_date: formData.start_date,
          end_date: formData.end_date,
          duration_days: Math.ceil((new Date(formData.end_date) - new Date(formData.start_date)) / (1000 * 60 * 60 * 24))
        },
        financial_overview: {
          total_revenue: 2500000,
          total_expenses: 1800000,
          net_profit: 700000,
          profitability_percent: 28,
          expense_ratio: 72
        },
        sections_summary: {
          payroll: {
            total_gross: 850000,
            total_net: 650000,
            employees_count: 12,
            avg_salary: 54167,
            top_earner: "Иванов И.И."
          },
          inventory: {
            total_outgoing_cost: 450000,
            total_profit: 180000,
            items_count: 156,
            profit_margin: 40,
            most_profitable_item: "Товар А"
          },
          properties: {
            total_revenue: 2200000,
            total_commission: 85000,
            properties_count: 8,
            best_performer: "Офис №1",
            commission_rate: 3.86
          },
          administrative: {
            total_admin_expenses: 350000,
            expenses_count: formData.additional_admin_expenses.length + 1,
            largest_expense: "Коммунальные услуги",
            admin_to_revenue_ratio: 14
          }
        },
        acquiring_overview: {
          card_payment_share: 65,
          commission_amount: 85000,
          effective_commission_rate: 2.8
        },
        data_quality: {
          staff_records: 12,
          inventory_items: 156,
          properties_analyzed: 8,
          admin_expenses: formData.additional_admin_expenses.length + 1,
          completeness_score: 85
        }
      };

      setPreviewData(mockPreview);

      // Также загружаем валидацию данных
      const mockValidation = {
        period: {
          start_date: formData.start_date,
          end_date: formData.end_date,
          duration_days: mockPreview.report_period.duration_days
        },
        data_availability: {
          rentals: { total_rentals: 45, paid_rentals: 42, payment_rate: 93.3 },
          payrolls: { total_payrolls: 12, paid_payrolls: 12, payment_rate: 100 },
          inventory: { movements_count: 234, has_cost_data: 195 },
          acquiring: { configured: true, enabled: true, providers_count: 2 }
        },
        warnings: [],
        recommendations: [
          "Данные полные и готовы для генерации качественного отчета"
        ],
        overall_score: 85
      };

      if (mockValidation.overall_score < 70) {
        mockValidation.warnings.push("Рекомендуется дополнить данные перед генерацией отчета");
      }

      setValidationResult(mockValidation);
      
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);
      
      // Имитация генерации отчета
      setTimeout(() => {
        const mockReport = {
          id: "report_" + Date.now(),
          organization_name: "Моя Организация",
          report_period: `${formData.start_date} - ${formData.end_date}`,
          total_revenue: previewData.financial_overview.total_revenue,
          total_expenses: previewData.financial_overview.total_expenses,
          net_profit: previewData.financial_overview.net_profit,
          created_at: new Date().toISOString(),
          format: formData.format
        };
        
        setReportData(mockReport);
        setLoading(false);
      }, 2000);
      
    } catch (error) {
      console.error('Report generation failed:', error);
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    try {
      // Имитация скачивания файла
      const filename = `comprehensive_report_${formData.start_date}_${formData.end_date}.${formData.format}`;
      
      // Создаем фиктивный blob для демонстрации
      const content = `Комплексный отчет\nПериод: ${formData.start_date} - ${formData.end_date}\nВыручка: ${previewData?.financial_overview.total_revenue} ₸\nРасходы: ${previewData?.financial_overview.total_expenses} ₸\nПрибыль: ${previewData?.financial_overview.net_profit} ₸`;
      const blob = new Blob([content], { type: 'text/plain' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('Report downloaded:', filename);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const addAdminExpense = () => {
    setFormData(prev => ({
      ...prev,
      additional_admin_expenses: [
        ...prev.additional_admin_expenses,
        { category: '', description: '', amount: 0 }
      ]
    }));
  };

  const updateAdminExpense = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      additional_admin_expenses: prev.additional_admin_expenses.map((expense, i) => 
        i === index ? { ...expense, [field]: value } : expense
      )
    }));
  };

  const removeAdminExpense = (index) => {
    setFormData(prev => ({
      ...prev,
      additional_admin_expenses: prev.additional_admin_expenses.filter((_, i) => i !== index)
    }));
  };

  const addTemplateExpense = (template) => {
    setFormData(prev => ({
      ...prev,
      additional_admin_expenses: [
        ...prev.additional_admin_expenses,
        {
          category: template.category,
          description: template.description,
          amount: template.amount
        }
      ]
    }));
  };

  const resetForm = () => {
    setStep(1);
    setPreviewData(null);
    setReportData(null);
    setValidationResult(null);
    setErrors({});
    setFormData({
      start_date: '',
      end_date: '',
      format: 'xlsx',
      utility_bills_amount: 0,
      additional_admin_expenses: []
    });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Заголовок */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '2px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#3b82f6',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <FiFileText size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>
                Комплексный отчет
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                Полный финансовый анализ с налогами и расходами
              </p>
            </div>
          </div>
          
          {/* Индикатор шагов */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {[1, 2, 3].map(stepNum => (
                <div key={stepNum} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: step >= stepNum ? '#3b82f6' : '#e2e8f0',
                    color: step >= stepNum ? 'white' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {stepNum}
                  </div>
                  {stepNum < 3 && (
                    <div style={{
                      width: '24px',
                      height: '2px',
                      backgroundColor: step > stepNum ? '#3b82f6' : '#e2e8f0'
                    }} />
                  )}
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => { resetForm(); onClose(); }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#64748b',
                padding: '8px'
              }}
            >
              <FiX />
            </button>
          </div>
        </div>

        {/* Содержимое в зависимости от шага */}
        <div style={{ padding: '32px' }}>
          {step === 1 && (
            <div>
              <h3 style={{ 
                margin: '0 0 24px 0', 
                fontSize: '1.25rem', 
                fontWeight: '600',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FiSettings size={20} />
                Настройки отчета
              </h3>

              {/* Период отчета */}
              <div style={{ marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '600', color: '#4b5563' }}>
                  Период отчета
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Дата начала <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: errors.start_date ? '2px solid #ef4444' : '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    {errors.start_date && (
                      <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        {errors.start_date}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Дата окончания <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: errors.end_date ? '2px solid #ef4444' : '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    {errors.end_date && (
                      <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        {errors.end_date}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Формат файла
                    </label>
                    <select
                      value={formData.format}
                      onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="xlsx">Excel (.xlsx)</option>
                      <option value="xml">XML (.xml)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Коммунальные услуги */}
              <div style={{ marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '600', color: '#4b5563' }}>
                  Коммунальные услуги
                </h4>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                    Сумма коммунальных услуг за период (₸)
                  </label>
                  <input
                    type="number"
                    value={formData.utility_bills_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, utility_bills_amount: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    style={{
                      width: '300px',
                      padding: '12px',
                      border: errors.utility_bills_amount ? '2px solid #ef4444' : '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  {errors.utility_bills_amount && (
                    <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      {errors.utility_bills_amount}
                    </span>
                  )}
                </div>
              </div>

              {/* Дополнительные административные расходы */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#4b5563' }}>
                    Дополнительные административные расходы
                  </h4>
                  <button
                    type="button"
                    onClick={addAdminExpense}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <FiPlus size={14} />
                    Добавить расход
                  </button>
                </div>

                {/* Шаблоны расходов */}
                {templates && (
                  <div style={{ marginBottom: '24px' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: '500', color: '#6b7280' }}>
                      Быстрое добавление из шаблонов:
                    </h5>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {Object.entries(templates).map(([categoryName, categoryTemplates]) => 
                        categoryTemplates.slice(0, 3).map(template => (
                          <button
                            key={template.category}
                            type="button"
                            onClick={() => addTemplateExpense(template)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              color: '#475569'
                            }}
                          >
                            {template.description} (₸{template.amount.toLocaleString()})
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Список добавленных расходов */}
                {formData.additional_admin_expenses.map((expense, index) => (
                  <div key={index} style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr auto',
                    gap: '12px',
                    alignItems: 'end',
                    marginBottom: '12px',
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>
                        Описание
                      </label>
                      <input
                        type="text"
                        value={expense.description}
                        onChange={(e) => updateAdminExpense(index, 'description', e.target.value)}
                        placeholder="Описание расхода"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>
                        Сумма (₸)
                      </label>
                      <input
                        type="number"
                        value={expense.amount}
                        onChange={(e) => updateAdminExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAdminExpense(index)}
                      style={{
                        padding: '8px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        color: '#dc2626',
                        cursor: 'pointer'
                      }}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                ))}

                {formData.additional_admin_expenses.length === 0 && (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '2px dashed #d1d5db'
                  }}>
                    <FiDollarSign size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      Нет дополнительных расходов. Нажмите "Добавить расход" для добавления.
                    </p>
                  </div>
                )}
              </div>

              {/* Кнопки навигации */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => { resetForm(); onClose(); }}
                  style={{
                    padding: '12px 24px',
                    border: '2px solid #e5e7eb',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    color: '#374151'
                  }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? <FiRefreshCw className="spinning" size={16} /> : <FiEye size={16} />}
                  {loading ? 'Загрузка...' : 'Предпросмотр'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && previewData && (
            <div>
              <h3 style={{ 
                margin: '0 0 24px 0', 
                fontSize: '1.25rem', 
                fontWeight: '600',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FiBarChart2 size={20} />
                Предпросмотр отчета
              </h3>

              {/* Основная информация */}
              <div style={{ 
                marginBottom: '24px',
                padding: '20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
                  {previewData.organization_name}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Период</span>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>
                      {previewData.report_period.duration_days} дней
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Общая выручка</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>
                      ₸ {previewData.financial_overview.total_revenue.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Общие расходы</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#dc2626' }}>
                      ₸ {previewData.financial_overview.total_expenses.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Чистая прибыль</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6' }}>
                      ₸ {previewData.financial_overview.net_profit.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Рентабельность</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#7c3aed' }}>
                      {previewData.financial_overview.profitability_percent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Разделы отчета */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Фонд оплаты труда */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px', 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Фонд оплаты труда
                  </h5>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                    Сотрудников: {previewData.sections_summary.payroll.employees_count}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#059669' }}>
                    ₸ {previewData.sections_summary.payroll.total_net.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Средняя ЗП: ₸ {previewData.sections_summary.payroll.avg_salary.toLocaleString()}
                  </div>
                </div>

                {/* Инвентарь */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px', 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Инвентарь и товары
                  </h5>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                    Товаров: {previewData.sections_summary.inventory.items_count}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#3b82f6' }}>
                    ₸ {previewData.sections_summary.inventory.total_profit.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Маржа: {previewData.sections_summary.inventory.profit_margin}%
                  </div>
                </div>

                {/* Недвижимость */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px', 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Недвижимость
                  </h5>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                    Помещений: {previewData.sections_summary.properties.properties_count}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#7c3aed' }}>
                    ₸ {previewData.sections_summary.properties.total_revenue.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Комиссия: {previewData.sections_summary.properties.commission_rate}%
                  </div>
                </div>

                {/* Административные расходы */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px', 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Админ. расходы
                  </h5>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                    Статей: {previewData.sections_summary.administrative.expenses_count}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626' }}>
                    ₸ {previewData.sections_summary.administrative.total_admin_expenses.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    {previewData.sections_summary.administrative.admin_to_revenue_ratio}% от выручки
                  </div>
                </div>
              </div>

              {/* Оценка качества данных */}
              {validationResult && (
                <div style={{ 
                  marginBottom: '24px',
                  padding: '20px',
                  backgroundColor: validationResult.overall_score >= 80 ? '#f0fdf4' : validationResult.overall_score >= 60 ? '#fffbeb' : '#fef2f2',
                  borderRadius: '12px',
                  border: `2px solid ${validationResult.overall_score >= 80 ? '#bbf7d0' : validationResult.overall_score >= 60 ? '#fed7aa' : '#fecaca'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    {validationResult.overall_score >= 80 ? (
                      <FiCheckCircle size={24} style={{ color: '#059669' }} />
                    ) : validationResult.overall_score >= 60 ? (
                      <FiAlertCircle size={24} style={{ color: '#d97706' }} />
                    ) : (
                      <FiAlertCircle size={24} style={{ color: '#dc2626' }} />
                    )}
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                        Оценка полноты данных: {validationResult.overall_score}/100
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                        {validationResult.overall_score >= 80 ? 'Отличное' : validationResult.overall_score >= 60 ? 'Хорошее' : 'Требует внимания'} качество данных для отчета
                      </p>
                    </div>
                  </div>

                  {validationResult.recommendations.length > 0 && (
                    <div>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: '600' }}>Рекомендации:</h5>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {validationResult.recommendations.map((recommendation, index) => (
                          <li key={index} style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                            {recommendation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Кнопки навигации */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    padding: '12px 24px',
                    border: '2px solid #e5e7eb',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    color: '#374151'
                  }}
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? <FiRefreshCw className="spinning" size={16} /> : <FiFileText size={16} />}
                  {loading ? 'Генерируем...' : 'Сгенерировать отчет'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center' }}>
              {loading ? (
                <div>
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    margin: '0 auto 24px auto',
                    border: '8px solid #f3f4f6',
                    borderTop: '8px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', fontWeight: '600' }}>
                    Генерируем отчет...
                  </h3>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>
                    Пожалуйста, подождите. Это может занять несколько секунд.
                  </p>
                </div>
              ) : reportData ? (
                <div>
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    margin: '0 auto 24px auto',
                    backgroundColor: '#059669',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    <FiCheckCircle size={40} />
                  </div>
                  
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', fontWeight: '600', color: '#059669' }}>
                    Отчет готов!
                  </h3>
                  
                  <div style={{ 
                    margin: '24px 0',
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h4 style={{ margin: '0 0 12px 0' }}>{reportData.organization_name}</h4>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
                      Период: {reportData.report_period}
                    </p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
                      Формат: {reportData.format.toUpperCase()}
                    </p>
                    <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                      Создан: {new Date(reportData.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={downloadReport}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <FiDownload size={16} />
                      Скачать отчет
                    </button>
                    
                    <button
                      onClick={() => { resetForm(); }}
                      style={{
                        padding: '12px 24px',
                        border: '2px solid #e5e7eb',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        color: '#374151'
                      }}
                    >
                      Создать новый отчет
                    </button>
                    
                    <button
                      onClick={() => { resetForm(); onClose(); }}
                      style={{
                        padding: '12px 24px',
                        border: '2px solid #e5e7eb',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        color: '#374151'
                      }}
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <FiAlertCircle size={80} style={{ color: '#dc2626', margin: '0 auto 24px auto', display: 'block' }} />
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', fontWeight: '600', color: '#dc2626' }}>
                    Ошибка генерации
                  </h3>
                  <p style={{ margin: '0 0 24px 0', color: '#6b7280' }}>
                    Произошла ошибка при генерации отчета. Попробуйте еще раз.
                  </p>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Попробовать снова
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .spinning {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
};

export default ComprehensiveReportModal;