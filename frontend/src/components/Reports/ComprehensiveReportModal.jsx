// frontend/src/components/Reports/ComprehensiveReportModal.jsx
import React, { useState, useEffect } from 'react';
import { FiX, FiDownload, FiFileText, FiSettings, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import './ComprehensiveReportModal.css'; // Предполагается, что стили находятся в этом файле
const ComprehensiveReportModal = ({ isOpen, onClose }) => {
  const { utils } = useData();
  
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    format: 'xlsx',
    utility_bills_amount: 0,
    include_tax_calculations: true,
    include_acquiring_details: true,
    additional_admin_expenses: []
  });
  
  const [loading, setLoading] = useState(false);
  const [newExpense, setNewExpense] = useState({
    category: '',
    description: '',
    amount: ''
  });

  // Устанавливаем даты по умолчанию при открытии
  useEffect(() => {
    if (isOpen) {
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

  const expenseCategories = [
    { value: 'office_supplies', label: 'Канцелярские товары' },
    { value: 'marketing', label: 'Реклама и маркетинг' },
    { value: 'legal_services', label: 'Юридические услуги' },
    { value: 'insurance', label: 'Страхование' },
    { value: 'software_licenses', label: 'Лицензии на ПО' },
    { value: 'maintenance', label: 'Техническое обслуживание' },
    { value: 'telecommunications', label: 'Связь и интернет' },
    { value: 'cleaning_supplies', label: 'Моющие средства' },
    { value: 'security', label: 'Охрана и безопасность' },
    { value: 'transport', label: 'Транспортные расходы' },
    { value: 'utilities', label: 'Коммунальные услуги' },
    { value: 'other', label: 'Прочие расходы' }
  ];

  const handleAddExpense = () => {
    if (!newExpense.category || !newExpense.description || !newExpense.amount) {
      utils.showError('Заполните все поля для добавления расхода');
      return;
    }

    const expense = {
      id: Date.now(),
      category: newExpense.category,
      description: newExpense.description.trim(),
      amount: parseFloat(newExpense.amount)
    };

    setFormData(prev => ({
      ...prev,
      additional_admin_expenses: [...prev.additional_admin_expenses, expense]
    }));

    setNewExpense({ category: '', description: '', amount: '' });
  };

  const handleRemoveExpense = (expenseId) => {
    setFormData(prev => ({
      ...prev,
      additional_admin_expenses: prev.additional_admin_expenses.filter(exp => exp.id !== expenseId)
    }));
  };

  const handleGenerate = async () => {
    if (!formData.start_date || !formData.end_date) {
      utils.showError('Выберите период для отчета');
      return;
    }

    try {
      setLoading(true);

      // Подготавливаем данные для API
      const requestData = {
        start_date: formData.start_date + 'T00:00:00',
        end_date: formData.end_date + 'T23:59:59',
        format: formData.format,
        utility_bills_amount: parseFloat(formData.utility_bills_amount) || 0,
        include_tax_calculations: formData.include_tax_calculations,
        include_acquiring_details: formData.include_acquiring_details,
        additional_admin_expenses: formData.additional_admin_expenses.map(exp => ({
          category: exp.category,
          description: exp.description,
          amount: exp.amount
        }))
      };

      console.log('Generating comprehensive report with data:', requestData);

      // Вызываем API для генерации отчета
      const { reportsAPI } = await import('../../services/api');
      const blob = await reportsAPI.exportComprehensiveReport(requestData);

      if (!blob || blob.size === 0) {
        throw new Error('Получен пустой файл');
      }

      // Генерируем имя файла
      const dateStr = `${formData.start_date}_${formData.end_date}`;
      const filename = `comprehensive_report_${dateStr}.${formData.format}`;

      // Скачиваем файл
      utils.downloadFile(blob, filename);
      utils.showSuccess('Комплексный отчет успешно сгенерирован');
      
      onClose();
      
    } catch (error) {
      console.error('Failed to generate comprehensive report:', error);
      utils.showError('Не удалось сгенерировать отчет: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category) => {
    return expenseCategories.find(cat => cat.value === category)?.label || category;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content comprehensive-report-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiFileText /> Комплексный отчет
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          {/* Основные параметры */}
          <div className="form-section">
            <h3>Параметры отчета</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Дата начала *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Дата окончания *</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Формат файла</label>
                <select
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                >
                  <option value="xlsx">Excel (XLSX)</option>
                  <option value="xml">XML</option>
                </select>
              </div>

              <div className="form-field">
                <label>Сумма коммунальных услуг (₸)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.utility_bills_amount}
                  onChange={(e) => setFormData({ ...formData, utility_bills_amount: e.target.value })}
                  placeholder="0"
                />
                <small>Укажите общую сумму коммунальных платежей за период</small>
              </div>
            </div>
          </div>

          {/* Дополнительные настройки */}
          <div className="form-section">
            <h3>Дополнительные настройки</h3>
            <div className="checkbox-group">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={formData.include_tax_calculations}
                  onChange={(e) => setFormData({ ...formData, include_tax_calculations: e.target.checked })}
                />
                <span>Включить расчет налогов</span>
                <small>Подоходный налог, социальные взносы</small>
              </label>

              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={formData.include_acquiring_details}
                  onChange={(e) => setFormData({ ...formData, include_acquiring_details: e.target.checked })}
                />
                <span>Включить детали эквайринга</span>
                <small>Комиссии банков, детали платежей картами</small>
              </label>
            </div>
          </div>

          {/* Административные расходы */}
          <div className="form-section">
            <h3>
              <FiSettings /> Дополнительные административные расходы
            </h3>
            
            {/* Добавление нового расхода */}
            <div className="add-expense-form">
              <div className="form-grid">
                <div className="form-field">
                  <label>Категория</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  >
                    <option value="">Выберите категорию</option>
                    {expenseCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Описание</label>
                  <input
                    type="text"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    placeholder="Описание расхода"
                  />
                </div>

                <div className="form-field">
                  <label>Сумма (₸)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="form-field">
                  <button 
                    type="button" 
                    className="btn-outline"
                    onClick={handleAddExpense}
                    disabled={!newExpense.category || !newExpense.description || !newExpense.amount}
                  >
                    <FiPlus /> Добавить
                  </button>
                </div>
              </div>
            </div>

            {/* Список добавленных расходов */}
            {formData.additional_admin_expenses.length > 0 && (
              <div className="expenses-list">
                <h4>Добавленные расходы:</h4>
                <div className="expenses-table">
                  {formData.additional_admin_expenses.map(expense => (
                    <div key={expense.id} className="expense-row">
                      <div className="expense-info">
                        <div className="expense-category">
                          {getCategoryLabel(expense.category)}
                        </div>
                        <div className="expense-description">
                          {expense.description}
                        </div>
                      </div>
                      <div className="expense-amount">
                        ₸ {expense.amount.toLocaleString()}
                      </div>
                      <button 
                        className="btn-icon delete"
                        onClick={() => handleRemoveExpense(expense.id)}
                        title="Удалить"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="expenses-total">
                  <strong>
                    Итого дополнительных расходов: ₸ {formData.additional_admin_expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn-cancel" 
            onClick={onClose}
            disabled={loading}
          >
            Отмена
          </button>
          <button 
            className="btn-primary" 
            onClick={handleGenerate}
            disabled={loading || !formData.start_date || !formData.end_date}
          >
            {loading ? (
              <>
                <div className="spinner small"></div>
                Генерация...
              </>
            ) : (
              <>
                <FiDownload />
                Сгенерировать отчет
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveReportModal;