// frontend/src/pages/Accountant/Payrolls/components/index.js
// Центральный файл для экспорта всех компонентов зарплат

// Основные компоненты
export { default as PayrollDetailCard } from './PayrollDetailCard';
export { default as PayrollStatistics } from './PayrollStatistics';
export { default as PayrollQuickActions } from './PayrollQuickActions';
export { default as PayrollFilters } from './PayrollFilters';
export { default as PayrollTable } from './PayrollTable';

// Существующие модальные окна (из родительской папки)
export { default as PayrollModal } from './PayrollModal';
export { default as TemplateModal } from './TemplateModal';
export { default as OperationModal } from './OperationModal';

// Дополнительные компоненты (при необходимости)
// export { default as PayrollAnalytics } from './PayrollAnalytics';
// export { default as PayrollExport } from './PayrollExport';
// export { default as BulkOperationsModal } from './BulkOperationsModal';