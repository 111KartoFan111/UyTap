// frontend/src/contexts/DataContext.jsx - ОБНОВЛЕННЫЙ
import { createContext, useContext, useState, useCallback } from 'react';
import { useToast } from '../components/Common/Toast';
import { 
  clientsAPI, 
  propertiesAPI, 
  rentalsAPI, 
  tasksAPI, 
  ordersAPI, 
  inventoryAPI,
  documentsAPI,
  payrollAPI,
  reportsAPI,
  organizationAPI
} from '../services/api';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  // Generic error handler with improved error messages
  const handleError = useCallback((error, operation, showToast = true) => {
    console.error(`${operation} failed:`, error);
    
    let errorMessage = 'Произошла ошибка';
    
    if (error.message) {
      // Улучшенная обработка ошибок API
      if (error.message.includes('Validation error')) {
        // Парсим ошибки валидации для более понятного отображения
        const validationMatch = error.message.match(/Validation error: (.+)/);
        if (validationMatch) {
          const validationErrors = validationMatch[1];
          // Переводим часто встречающиеся ошибки валидации
          errorMessage = validationErrors
            .replace(/Field required/g, 'Поле обязательно для заполнения')
            .replace(/amount -> /g, 'Сумма: ')
            .replace(/reason -> /g, 'Причина: ')
            .replace(/user_id -> /g, 'Пользователь: ')
            .replace(/query -> /g, '');
        } else {
          errorMessage = 'Ошибка валидации данных';
        }
      } else if (error.message.includes('404')) {
        errorMessage = 'Ресурс не найден';
      } else if (error.message.includes('403')) {
        errorMessage = 'Нет прав доступа';
      } else if (error.message.includes('401')) {
        errorMessage = 'Необходима авторизация';
      } else if (error.message.includes('500')) {
        errorMessage = 'Внутренняя ошибка сервера';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету';
      } else {
        errorMessage = error.message;
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    setError(errorMessage);
    
    if (showToast) {
      toast.showError(errorMessage);
    }
    
    // Clear error after 10 seconds
    setTimeout(() => setError(null), 10000);
  }, [toast]);

  // Generic success handler
  const handleSuccess = useCallback((message) => {
    if (message) {
      toast.showSuccess(message);
    }
    setError(null); // Clear any previous errors on success
  }, [toast]);

  // Generic loading wrapper with better error handling
  const withLoading = useCallback(async (operation, suppressLoading = false, successMessage = null) => {
    try {
      if (!suppressLoading) setLoading(true);
      setError(null);
      
      const result = await operation();
      
      if (successMessage) {
        handleSuccess(successMessage);
      }
      
      return result;
    } catch (error) {
      handleError(error, 'Operation');
      throw error;
    } finally {
      if (!suppressLoading) setLoading(false);
    }
  }, [handleError, handleSuccess]);

  // Enhanced clients operations
  const clients = {
    getAll: (params) => withLoading(() => clientsAPI.getClients(params), true),
    getById: (id) => withLoading(() => clientsAPI.getClient(id)),
    create: (data) => withLoading(() => clientsAPI.createClient(data), false, 'Клиент успешно создан'),
    update: (id, data) => withLoading(() => clientsAPI.updateClient(id, data), false, 'Клиент обновлен'),
    delete: (id) => withLoading(() => clientsAPI.deleteClient(id), false, 'Клиент удален'),
    getHistory: (id) => withLoading(() => clientsAPI.getClientHistory(id)),
    getStatistics: (id) => withLoading(() => clientsAPI.getClientStatistics(id)),
    bulkImport: (data) => withLoading(() => clientsAPI.bulkImport(data), false, 'Клиенты импортированы')
  };

  // Enhanced properties operations
  const properties = {
    getAll: (params) => withLoading(() => propertiesAPI.getProperties(params), true),
    getAllWithLimits: (params) => withLoading(() => propertiesAPI.getPropertiesWithLimits(params), true),
    getById: (id) => withLoading(() => propertiesAPI.getProperty(id)),
    create: (data) => withLoading(() => propertiesAPI.createProperty(data), false, 'Помещение создано'),
    update: (id, data) => withLoading(() => propertiesAPI.updateProperty(id, data), false, 'Помещение обновлено'),
    delete: (id) => withLoading(() => propertiesAPI.deleteProperty(id), false, 'Помещение удалено'),
    updateStatus: (id, status) => withLoading(() => propertiesAPI.updatePropertyStatus(id, status), false, 'Статус обновлен'),
    getTasks: (id, status) => withLoading(() => propertiesAPI.getPropertyTasks(id, status)),
    createTask: (id, data) => withLoading(() => propertiesAPI.createPropertyTask(id, data), false, 'Задача создана'),
    checkAvailability: (id, startDate, endDate) => withLoading(() => propertiesAPI.checkAvailability(id, startDate, endDate)),
    getStatistics: (id, periodDays) => withLoading(() => propertiesAPI.getPropertyStatistics(id, periodDays)),
    postUpdateAllStatuses: (data) => withLoading(() => propertiesAPI.postUpdateAllStatuses(), false, 'Статусы обновлены')
  };

  // Enhanced rentals operations
  const rentals = {
    getAll: (params) => withLoading(() => rentalsAPI.getRentals(params), true),
    getById: (id) => withLoading(() => rentalsAPI.getRental(id)),
    create: (data) => withLoading(() => rentalsAPI.createRental(data), false, 'Аренда создана'),
    update: (id, data) => withLoading(() => rentalsAPI.updateRental(id, data), false, 'Аренда обновлена'),
    checkIn: (id) => withLoading(() => rentalsAPI.checkIn(id), false, 'Заселение выполнено'),
    checkOut: (id) => withLoading(() => rentalsAPI.checkOut(id), false, 'Выселение выполнено'),
    cancel: (id, reason) => withLoading(() => rentalsAPI.cancel(id, reason), false, 'Аренда отменена')
  };

  // Enhanced tasks operations
  const tasks = {
    getAll: (params) => withLoading(() => tasksAPI.getTasks(params), true),
    getById: (id) => withLoading(() => tasksAPI.getTask(id)),
    getMy: (status) => withLoading(() => tasksAPI.getMyTasks(status), true),
    create: (data) => withLoading(() => tasksAPI.createTask(data), false, 'Задача создана'),
    update: (id, data) => withLoading(() => tasksAPI.updateTask(id, data), false, 'Задача обновлена'),
    assign: (id, assignedTo) => withLoading(() => tasksAPI.assignTask(id, assignedTo), false, 'Задача назначена'),
    start: (id) => withLoading(() => tasksAPI.startTask(id), false, 'Задача начата'),
    complete: (id, data) => withLoading(() => tasksAPI.completeTask(id, data), false, 'Задача выполнена'),
    cancel: (id, reason) => withLoading(() => tasksAPI.cancelTask(id, reason), false, 'Задача отменена'),
    getStatistics: (periodDays, userId) => withLoading(() => tasksAPI.getTaskStatistics(periodDays, userId)),
    getEmployeeWorkload: (role) => withLoading(() => tasksAPI.getEmployeeWorkload(role)),
    getUrgent: () => withLoading(() => tasksAPI.getUrgentTasks(), true),
    autoAssign: (taskIds) => withLoading(() => tasksAPI.autoAssignTasks(taskIds), false, 'Задачи назначены автоматически'),
    createRecurring: () => withLoading(() => tasksAPI.createRecurringTasks(), false, 'Регулярные задачи созданы')
  };

  // Enhanced orders operations
  const orders = {
    getAll: (params) => withLoading(() => ordersAPI.getOrders(params), true),
    getById: (id) => withLoading(() => ordersAPI.getOrder(id)),
    create: (data) => withLoading(() => ordersAPI.createOrder(data), false, 'Заказ создан'),
    update: (id, data) => withLoading(() => ordersAPI.updateOrder(id, data), false, 'Заказ обновлен'),
    assign: (id, assignedTo) => withLoading(() => ordersAPI.assignOrder(id, assignedTo), false, 'Заказ назначен'),
    complete: (id, notes) => withLoading(() => ordersAPI.completeOrder(id, notes), false, 'Заказ выполнен'),
    getStatistics: (periodDays) => withLoading(() => ordersAPI.getOrderStatistics(periodDays))
  };

  // Enhanced inventory operations
  const inventory = {
    getAll: (params) => withLoading(() => inventoryAPI.getItems(params), true),
    getById: (id) => withLoading(() => inventoryAPI.getItem(id)),
    create: (data) => withLoading(() => inventoryAPI.createItem(data), false, 'Товар добавлен'),
    update: (id, data) => withLoading(() => inventoryAPI.updateItem(id, data), false, 'Товар обновлен'),
    delete: (id) => withLoading(() => inventoryAPI.deleteItem(id), false, 'Товар удален'),
    createMovement: (itemId, data) => withLoading(() => inventoryAPI.createMovement(itemId, data), false, 'Движение создано'),
    getMovements: (itemId, params) => withLoading(() => inventoryAPI.getMovements(itemId, params)),
    getLowStock: () => withLoading(() => inventoryAPI.getLowStockItems(), true),
    getStatistics: () => withLoading(() => inventoryAPI.getStatistics()),
    bulkUpdateStock: (updates) => withLoading(() => inventoryAPI.bulkUpdateStock(updates), false, 'Остатки обновлены'),
    export: (format, category) => withLoading(() => inventoryAPI.exportData(format, category))
  };

  // Enhanced documents operations
  const documents = {
    getAll: (params) => withLoading(() => documentsAPI.getDocuments(params), true),
    getById: (id) => withLoading(() => documentsAPI.getDocument(id)),
    create: (data) => withLoading(() => documentsAPI.createDocument(data), false, 'Документ создан'),
    update: (id, data) => withLoading(() => documentsAPI.updateDocument(id, data), false, 'Документ обновлен'),
    download: (id) => withLoading(() => documentsAPI.downloadDocument(id)),
    sign: (id, signatureData) => withLoading(() => documentsAPI.signDocument(id, signatureData), false, 'Документ подписан'),
    generateContract: (rentalId) => withLoading(() => documentsAPI.generateRentalContract(rentalId), false, 'Договор сгенерирован'),
    generateAct: (rentalId) => withLoading(() => documentsAPI.generateWorkAct(rentalId), false, 'Акт сгенерирован'),
    sendESF: (id) => withLoading(() => documentsAPI.sendESF(id), false, 'ЭСФ отправлен')
  };

  // Enhanced payroll operations
  const payroll = {
    getAll: (params) => withLoading(() => payrollAPI.getAll(params), true),
    getById: (id) => withLoading(() => payrollAPI.getById(id)),
    create: (data) => withLoading(() => payrollAPI.create(data), false, 'Зарплата успешно создана'),
    update: (id, data) => withLoading(() => payrollAPI.update(id, data), false, 'Зарплата обновлена'),
    delete: (id) => withLoading(() => payrollAPI.delete(id), false, 'Зарплата удалена'),
    markAsPaid: (id, paymentMethod) => withLoading(() => payrollAPI.markAsPaid(id, paymentMethod), false, 'Зарплата отмечена как выплаченная'),
    calculateMonthly: (year, month, userId) => withLoading(() => payrollAPI.calculateMonthly(year, month, userId), false, 'Зарплата рассчитана'),
    getStatistics: (year, month) => withLoading(() => payrollAPI.getStatistics(year, month)),
    exportData: (format, year, month) => withLoading(() => payrollAPI.exportData(format, year, month)),
    
    // Templates
    getTemplates: (params) => withLoading(() => payrollAPI.getTemplates(params), true),
    createTemplate: (data) => withLoading(() => payrollAPI.createTemplate(data), false, 'Шаблон зарплаты создан'),
    updateTemplate: (id, data) => withLoading(() => payrollAPI.updateTemplate(id, data), false, 'Шаблон обновлен'),
    deactivateTemplate: (id) => withLoading(() => payrollAPI.deactivateTemplate(id), false, 'Шаблон деактивирован'),
    autoGenerate: (year, month, forceRecreate) => withLoading(() => payrollAPI.autoGenerate(year, month, forceRecreate), false, 'Зарплаты сгенерированы автоматически'),
    
    // Operations
    getOperations: (params) => withLoading(() => payrollAPI.getOperations(params), true),
    addOperation: (data) => withLoading(() => payrollAPI.addOperation(data), false, 'Операция добавлена'),
    cancelOperation: (id, reason) => withLoading(() => payrollAPI.cancelOperation(id, reason), false, 'Операция отменена'),
    
    // Quick operations - исправленные вызовы API
    addQuickBonus: (userId, data) => withLoading(async () => {
      try {
        return await payrollAPI.addQuickBonus(userId, data);
      } catch (error) {
        // Более подробная обработка ошибок для отладки
        console.error('Failed to add quick bonus:', error);
        throw new Error(`Не удалось добавить премию: ${error.message}`);
      }
    }, false, 'Премия добавлена'),
    
    addQuickPenalty: (userId, data) => withLoading(async () => {
      try {
        return await payrollAPI.addQuickPenalty(userId, data);
      } catch (error) {
        console.error('Failed to add quick penalty:', error);
        throw new Error(`Не удалось добавить штраф: ${error.message}`);
      }
    }, false, 'Штраф добавлен'),
    
    addOvertimePayment: (userId, data) => withLoading(async () => {
      try {
        return await payrollAPI.addOvertimePayment(userId, data);
      } catch (error) {
        console.error('Failed to add overtime payment:', error);
        throw new Error(`Не удалось добавить сверхурочные: ${error.message}`);
      }
    }, false, 'Сверхурочные добавлены'),
    
    addAllowance: (userId, data) => withLoading(async () => {
      try {
        return await payrollAPI.addAllowance(userId, data);
      } catch (error) {
        console.error('Failed to add allowance:', error);
        throw new Error(`Не удалось добавить надбавку: ${error.message}`);
      }
    }, false, 'Надбавка добавлена'),
    
    addDeduction: (userId, data) => withLoading(async () => {
      try {
        return await payrollAPI.addDeduction(userId, data);
      } catch (error) {
        console.error('Failed to add deduction:', error);
        throw new Error(`Не удалось добавить удержание: ${error.message}`);
      }
    }, false, 'Удержание добавлено'),
    
    // Enhanced reporting
    getUserSummary: (userId, months) => withLoading(() => payrollAPI.getUserSummary(userId, months)),
    recalculate: (id) => withLoading(() => payrollAPI.recalculate(id), false, 'Зарплата пересчитана'),
    
    // Метод экспорта для использования в компонентах
    export: (format, year, month) => payrollAPI.exportData(format, year, month)
  };

  const reports = {
  getFinancialSummary: (startDate, endDate) => withLoading(() => reportsAPI.getFinancialSummary(startDate, endDate)),
  getPropertyOccupancy: (startDate, endDate, propertyId) => withLoading(() => reportsAPI.getPropertyOccupancy(startDate, endDate, propertyId)),
  getEmployeePerformance: (startDate, endDate, role, userId) => withLoading(() => reportsAPI.getEmployeePerformance(startDate, endDate, role, userId)),
  getClientAnalytics: (startDate, endDate) => withLoading(() => reportsAPI.getClientAnalytics(startDate, endDate)),
  getMyPayroll: (periodStart, periodEnd) => withLoading(() => reportsAPI.getMyPayroll(periodStart, periodEnd)),
  
  // ИСПРАВЛЕННЫЕ методы экспорта с правильной обработкой ошибок
  exportFinancialSummary: async (startDate, endDate, format = 'xlsx') => {
    try {
      const blob = await reportsAPI.exportFinancialSummary(startDate, endDate, format);
      
      if (!blob || blob.size === 0) {
        throw new Error('Получен пустой файл');
      }
      
      return blob;
    } catch (error) {
      console.error('Financial summary export failed:', error);
      throw new Error(`Ошибка экспорта финансового отчета: ${error.message}`);
    }
  },

  exportPropertyOccupancy: async (startDate, endDate, propertyId = null, format = 'xlsx') => {
    try {
      const blob = await reportsAPI.exportPropertyOccupancy(startDate, endDate, propertyId, format);
      
      if (!blob || blob.size === 0) {
        throw new Error('Получен пустой файл');
      }
      
      return blob;
    } catch (error) {
      console.error('Property occupancy export failed:', error);
      throw new Error(`Ошибка экспорта отчета по загруженности: ${error.message}`);
    }
  },

  exportClientAnalytics: async (startDate, endDate, format = 'xlsx') => {
    try {
      const blob = await reportsAPI.exportClientAnalytics(startDate, endDate, format);
      
      if (!blob || blob.size === 0) {
        throw new Error('Получен пустой файл');
      }
      
      return blob;
    } catch (error) {
      console.error('Client analytics export failed:', error);
      throw new Error(`Ошибка экспорта клиентской аналитики: ${error.message}`);
    }
  },

  exportEmployeePerformance: async (startDate, endDate, role = null, userId = null, format = 'xlsx') => {
    try {
      const blob = await reportsAPI.exportEmployeePerformance(startDate, endDate, role, userId, format);
      
      if (!blob || blob.size === 0) {
        throw new Error('Получен пустой файл');
      }
      
      return blob;
    } catch (error) {
      console.error('Employee performance export failed:', error);
      throw new Error(`Ошибка экспорта отчета по производительности: ${error.message}`);
    }
  }
  };

  // Enhanced organization operations
  const organization = {
    getCurrent: () => withLoading(() => organizationAPI.getCurrentOrganization(), true),
    getLimits: () => withLoading(() => organizationAPI.getLimits(), true),
    getUsage: () => withLoading(() => organizationAPI.getUsageStatistics(), true),
    updateSettings: (settings) => withLoading(() => organizationAPI.updateSettings(settings), false, 'Настройки организации обновлены'),
    
    // User management methods
    getUsers: (params) => withLoading(() => organizationAPI.getUsers(params), true),
    getUser: (userId) => withLoading(() => organizationAPI.getUser(userId)),
    createUser: (userData) => withLoading(() => organizationAPI.createUser(userData), false, 'Пользователь создан'),
    updateUser: (userId, userData) => withLoading(() => organizationAPI.updateUser(userId, userData), false, 'Пользователь обновлен'),
    deleteUser: (userId) => withLoading(() => organizationAPI.deleteUser(userId), false, 'Пользователь удален'),
    
    // Additional methods
    getAvailableRoles: () => withLoading(() => organizationAPI.getAvailableRoles(), true),
    resetUserPassword: (userId) => withLoading(() => organizationAPI.resetUserPassword(userId), false, 'Пароль сброшен'),
    getUserPerformance: (userId, periodDays) => withLoading(() => organizationAPI.getUserPerformance(userId, periodDays)),
    getDashboardStatistics: () => withLoading(() => organizationAPI.getDashboardStatistics(), true),
    getRecentAuditActions: (limit) => withLoading(() => organizationAPI.getRecentAuditActions(limit), true)
  };

  // Utility functions
  const utils = {
    clearError: () => setError(null),
    isLoading: () => loading,
    showSuccess: handleSuccess,
    showError: (message) => handleError(new Error(message), 'Manual', true),
    showWarning: toast.showWarning,
    showInfo: toast.showInfo,
    toast: toast.toasts,
    removeToast: toast.removeToast,
    
    // Helper function for file downloads
    downloadFile: (blob, filename) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    
    // Helper function for error retry
    retry: async (operation, maxRetries = 3, delay = 1000) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await operation();
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
  };

  const value = {
    // State
    loading,
    error,
    
    // Operations
    clients,
    properties,
    rentals,
    tasks,
    orders,
    inventory,
    documents,
    payroll,
    reports,
    organization,
    utils
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};