import { useState } from 'react';
import { FiX, FiPlus } from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';

const OperationModal = ({ employees, onClose, onSubmit }) => {
  const { payroll, utils } = useData();
  const [operationType, setOperationType] = useState('bonus');
  const [formData, setFormData] = useState({
    user_id: '',
    amount: '',
    description: '',
    operation_date: new Date().toISOString().split('T')[0]
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.user_id) {
      newErrors.user_id = 'Выберите сотрудника';
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Введите корректную сумму';
    }
    if (!formData.description?.trim()) {
      newErrors.description = 'Введите описание операции';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const amount = parseFloat(formData.amount);
      const reason = formData.description.trim();

      // Используем правильный API вызов в зависимости от типа операции
      switch (operationType) {
        case 'bonus':
          await payroll.addQuickBonus(formData.user_id, {
            amount,
            reason,
            apply_to_current_month: true
          });
          break;
        case 'penalty':
          await payroll.addQuickPenalty(formData.user_id, {
            amount,
            reason,
            apply_to_current_month: true
          });
          break;
        case 'overtime':
          await payroll.addOvertimePayment(formData.user_id, {
            hours: amount, // для сверхурочных amount это часы
            description: reason
          });
          break;
        case 'allowance':
          await payroll.addAllowance(formData.user_id, {
            amount,
            title: 'Надбавка',
            description: reason,
            is_recurring: false
          });
          break;
        case 'deduction':
          await payroll.addDeduction(formData.user_id, {
            amount,
            title: 'Удержание',
            reason
          });
          break;
        default:
          throw new Error('Неподдерживаемый тип операции');
      }

      utils.showSuccess('Операция добавлена');
      onSubmit();
      onClose();
    } catch (error) {
      console.error('Failed to add operation:', error);
      utils.showError('Не удалось добавить операцию: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const operationTypes = [
    { value: 'bonus', label: 'Премия', icon: '💰', description: 'Разовая премия сотруднику' },
    { value: 'penalty', label: 'Штраф', icon: '⚠️', description: 'Штраф за нарушения' },
    { value: 'overtime', label: 'Сверхурочные', icon: '⏰', description: 'Оплата сверхурочных часов' },
    { value: 'allowance', label: 'Надбавка', icon: '📈', description: 'Постоянная или временная надбавка' },
    { value: 'deduction', label: 'Удержание', icon: '📉', description: 'Удержание из зарплаты' }
  ];

  const getSelectedOperationType = () => {
    return operationTypes.find(type => type.value === operationType);
  };

  const getAmountLabel = () => {
    switch (operationType) {
      case 'overtime':
        return 'Количество часов *';
      default:
        return 'Сумма *';
    }
  };

  const getAmountPlaceholder = () => {
    switch (operationType) {
      case 'overtime':
        return 'Например: 8';
      default:
        return 'Например: 50000';
    }
  };

  const getAmountStep = () => {
    switch (operationType) {
      case 'overtime':
        return '0.5';
      default:
        return '1000';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content operation-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiPlus /> Добавить операцию
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form className="operation-form" onSubmit={handleSubmit}>
          <div className="operation-types">
            <h3>Выберите тип операции</h3>
            <div className="operation-types-grid">
              {operationTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  className={`operation-type-btn ${operationType === type.value ? 'active' : ''}`}
                  onClick={() => setOperationType(type.value)}
                >
                  <span className="operation-icon">{type.icon}</span>
                  <div className="operation-info">
                    <span className="operation-title">{type.label}</span>
                    <span className="operation-description">{type.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="selected-operation-info">
            <div className="selected-operation-header">
              <span className="selected-icon">{getSelectedOperationType()?.icon}</span>
              <div>
                <h4>{getSelectedOperationType()?.label}</h4>
                <p>{getSelectedOperationType()?.description}</p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Сотрудник *</label>
              <select
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                className={errors.user_id ? 'error' : ''}
                required
              >
                <option value="">Выберите сотрудника</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} - {employee.role}
                  </option>
                ))}
              </select>
              {errors.user_id && <span className="error-text">{errors.user_id}</span>}
            </div>

            <div className="form-field">
              <label>{getAmountLabel()}</label>
              <input
                type="number"
                min="0"
                step={getAmountStep()}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder={getAmountPlaceholder()}
                className={errors.amount ? 'error' : ''}
                required
              />
              {errors.amount && <span className="error-text">{errors.amount}</span>}
              {operationType === 'overtime' && (
                <small className="field-hint">
                  Укажите количество сверхурочных часов. Оплата будет рассчитана автоматически по тарифу сотрудника.
                </small>
              )}
            </div>

            <div className="form-field">
              <label>Дата операции</label>
              <input
                type="date"
                value={formData.operation_date}
                onChange={(e) => setFormData({ ...formData, operation_date: e.target.value })}
              />
            </div>

            <div className="form-field full-width">
              <label>
                {operationType === 'penalty' || operationType === 'deduction' ? 'Причина *' : 'Описание *'}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={
                  operationType === 'bonus' ? 'За отличную работу...' :
                  operationType === 'penalty' ? 'Причина штрафа...' :
                  operationType === 'overtime' ? 'Описание сверхурочной работы...' :
                  operationType === 'allowance' ? 'Основание для надбавки...' :
                  'Причина удержания...'
                }
                rows="3"
                className={errors.description ? 'error' : ''}
                required
              />
              {errors.description && <span className="error-text">{errors.description}</span>}
            </div>

            {(operationType === 'bonus' || operationType === 'penalty') && (
              <div className="form-field full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    readOnly
                  />
                  Применить к текущему месяцу
                </label>
                <small className="field-hint">
                  Операция будет учтена при расчете зарплаты за текущий месяц
                </small>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              Добавить {getSelectedOperationType()?.label.toLowerCase()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OperationModal;