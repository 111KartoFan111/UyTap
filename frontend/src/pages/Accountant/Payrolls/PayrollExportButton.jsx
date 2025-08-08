// frontend/src/pages/Accountant/Payrolls/PayrollExportButton.jsx
import React, { useState } from 'react';
import { FiDownload, FiSettings } from 'react-icons/fi';
import { useData } from '../../../contexts/DataContext';
import './PayrollExportButton.css'; // Предполагается, что стили находятся в этом файле

const PayrollExportButton = ({ payrollItem, employee, variant = 'icon' }) => {
  const { payroll, utils } = useData();
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleExport = async (format = 'xlsx', includeTaxBreakdown = true) => {
    try {
      setLoading(true);
      setShowOptions(false);

      console.log('🔄 Exporting payroll for:', payrollItem.id, { format, includeTaxBreakdown });

      // Определяем период для экспорта
      const periodStart = payrollItem.period_start || new Date(payrollItem.period_year, payrollItem.period_month - 1, 1);
      const periodEnd = payrollItem.period_end || new Date(payrollItem.period_year, payrollItem.period_month, 0, 23, 59, 59);

      // Подготавливаем параметры для экспорта
      const exportParams = {
        start_date: periodStart.toISOString(),
        end_date: periodEnd.toISOString(),
        user_id: payrollItem.user_id,
        format: format,
        include_tax_breakdown: includeTaxBreakdown
      };

      // Вызываем API для экспорта
      const blob = await payroll.exportPayrollWithTaxes(exportParams);

      if (!blob || blob.size === 0) {
        throw new Error('Получен пустой файл');
      }

      // Генерируем имя файла
      const employeeName = employee ? 
        `${employee.first_name}_${employee.last_name}`.replace(/\s+/g, '_') : 
        'unknown';
      
      const period = `${payrollItem.period_month || 'XX'}_${payrollItem.period_year || 'XXXX'}`;
      const filename = `payroll_${employeeName}_${period}.${format}`;

      // Скачиваем файл
      utils.downloadFile(blob, filename);
      utils.showSuccess('Отчет по зарплате успешно экспортирован');

      console.log('✅ Payroll export successful');

    } catch (error) {
      console.error('❌ Payroll export failed:', error);
      
      let errorMessage = 'Не удалось экспортировать зарплату';
      if (error.message) {
        if (error.message.includes('404')) {
          errorMessage = 'Функция экспорта зарплат недоступна. Обратитесь к администратору.';
        } else if (error.message.includes('403')) {
          errorMessage = 'Нет прав для экспорта зарплат';
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      utils.showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <div className="payroll-export-dropdown">
        <button 
          className="btn-icon export"
          onClick={() => setShowOptions(!showOptions)}
          disabled={loading}
          title="Экспорт зарплаты"
        >
          {loading ? (
            <div className="spinner-small"></div>
          ) : (
            <FiDownload />
          )}
        </button>

        {showOptions && (
          <div className="export-options-dropdown">
            <div className="dropdown-header">
              <span>Экспорт зарплаты</span>
              <button 
                className="close-dropdown"
                onClick={() => setShowOptions(false)}
              >
                ×
              </button>
            </div>
            
            <div className="export-options">
              <button 
                className="export-option"
                onClick={() => handleExport('xlsx', true)}
                disabled={loading}
              >
                <FiDownload />
                <div className="option-info">
                  <span>Excel с налогами</span>
                  <small>Подробная разбивка налогов</small>
                </div>
              </button>

              <button 
                className="export-option"
                onClick={() => handleExport('xlsx', false)}
                disabled={loading}
              >
                <FiDownload />
                <div className="option-info">
                  <span>Excel базовый</span>
                  <small>Без детализации налогов</small>
                </div>
              </button>

              <button 
                className="export-option"
                onClick={() => handleExport('csv', true)}
                disabled={loading}
              >
                <FiDownload />
                <div className="option-info">
                  <span>CSV с налогами</span>
                  <small>Для импорта в другие системы</small>
                </div>
              </button>
            </div>
          </div>
        )}

        {showOptions && (
          <div 
            className="dropdown-overlay"
            onClick={() => setShowOptions(false)}
          />
        )}
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <div className="payroll-export-button-group">
        <button 
          className="btn-outline"
          onClick={() => handleExport('xlsx', true)}
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="spinner-small"></div>
              Экспорт...
            </>
          ) : (
            <>
              <FiDownload />
              Скачать зарплату
            </>
          )}
        </button>

        <button 
          className="btn-icon-outline"
          onClick={() => setShowOptions(!showOptions)}
          disabled={loading}
          title="Дополнительные опции экспорта"
        >
          <FiSettings />
        </button>

        {showOptions && (
          <div className="export-options-dropdown right">
            <div className="dropdown-header">
              <span>Опции экспорта</span>
              <button 
                className="close-dropdown"
                onClick={() => setShowOptions(false)}
              >
                ×
              </button>
            </div>
            
            <div className="export-options">
              <button 
                className="export-option"
                onClick={() => handleExport('xlsx', true)}
                disabled={loading}
              >
                <FiDownload />
                <div className="option-info">
                  <span>Excel с налогами</span>
                  <small>Подробная разбивка ИПН и соц.взносов</small>
                </div>
              </button>

              <button 
                className="export-option"
                onClick={() => handleExport('xlsx', false)}
                disabled={loading}
              >
                <FiDownload />
                <div className="option-info">
                  <span>Excel базовый</span>
                  <small>Только основные данные</small>
                </div>
              </button>

              <button 
                className="export-option"
                onClick={() => handleExport('csv', true)}
                disabled={loading}
              >
                <FiDownload />
                <div className="option-info">
                  <span>CSV формат</span>
                  <small>Для 1С и других систем</small>
                </div>
              </button>
            </div>
          </div>
        )}

        {showOptions && (
          <div 
            className="dropdown-overlay"
            onClick={() => setShowOptions(false)}
          />
        )}
      </div>
    );
  }

  return null;
};

export default PayrollExportButton;