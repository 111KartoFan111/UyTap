import { createContext, useContext, useState, useCallback } from 'react';
import { 
  clientsAPI, 
  propertiesAPI, 
  rentalsAPI, 
  tasksAPI, 
  ordersAPI, 
  inventoryAPI,
  documentsAPI,
  payrollAPI,
  reportsAPI
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

  // Generic error handler
  const handleError = useCallback((error, operation) => {
    console.error(`${operation} failed:`, error);
    setError(error.message);
    setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
  }, []);

  // Generic loading wrapper
  const withLoading = useCallback(async (operation, suppressLoading = false) => {
    try {
      if (!suppressLoading) setLoading(true);
      setError(null);
      const result = await operation();
      return result;
    } catch (error) {
      handleError(error, 'Operation');
      throw error;
    } finally {
      if (!suppressLoading) setLoading(false);
    }
  }, [handleError]);

  // Clients operations
  const clients = {
    getAll: (params) => withLoading(() => clientsAPI.getClients(params)),
    getById: (id) => withLoading(() => clientsAPI.getClient(id)),
    create: (data) => withLoading(() => clientsAPI.createClient(data)),
    update: (id, data) => withLoading(() => clientsAPI.updateClient(id, data)),
    delete: (id) => withLoading(() => clientsAPI.deleteClient(id)),
    getHistory: (id) => withLoading(() => clientsAPI.getClientHistory(id)),
    getStatistics: (id) => withLoading(() => clientsAPI.getClientStatistics(id)),
    bulkImport: (data) => withLoading(() => clientsAPI.bulkImport(data))
  };

  // Properties operations
  const properties = {
    getAll: (params) => withLoading(() => propertiesAPI.getProperties(params)),
    getById: (id) => withLoading(() => propertiesAPI.getProperty(id)),
    create: (data) => withLoading(() => propertiesAPI.createProperty(data)),
    update: (id, data) => withLoading(() => propertiesAPI.updateProperty(id, data)),
    delete: (id) => withLoading(() => propertiesAPI.deleteProperty(id)),
    updateStatus: (id, status) => withLoading(() => propertiesAPI.updatePropertyStatus(id, status)),
    getTasks: (id, status) => withLoading(() => propertiesAPI.getPropertyTasks(id, status)),
    createTask: (id, data) => withLoading(() => propertiesAPI.createPropertyTask(id, data)),
    checkAvailability: (id, startDate, endDate) => withLoading(() => propertiesAPI.checkAvailability(id, startDate, endDate)),
    getStatistics: (id, periodDays) => withLoading(() => propertiesAPI.getPropertyStatistics(id, periodDays))
  };

  // Rentals operations
  const rentals = {
    getAll: (params) => withLoading(() => rentalsAPI.getRentals(params)),
    getById: (id) => withLoading(() => rentalsAPI.getRental(id)),
    create: (data) => withLoading(() => rentalsAPI.createRental(data)),
    update: (id, data) => withLoading(() => rentalsAPI.updateRental(id, data)),
    checkIn: (id) => withLoading(() => rentalsAPI.checkIn(id)),
    checkOut: (id) => withLoading(() => rentalsAPI.checkOut(id)),
    cancel: (id, reason) => withLoading(() => rentalsAPI.cancelRental(id, reason))
  };

  // Tasks operations
  const tasks = {
    getAll: (params) => withLoading(() => tasksAPI.getTasks(params)),
    getById: (id) => withLoading(() => tasksAPI.getTask(id)),
    create: (data) => withLoading(() => tasksAPI.createTask(data)),
    update: (id, data) => withLoading(() => tasksAPI.updateTask(id, data)),
    assign: (id, assignedTo) => withLoading(() => tasksAPI.assignTask(id, assignedTo)),
    start: (id) => withLoading(() => tasksAPI.startTask(id)),
    complete: (id, data) => withLoading(() => tasksAPI.completeTask(id, data)),
    cancel: (id, reason) => withLoading(() => tasksAPI.cancelTask(id, reason)),
    getMy: (status) => withLoading(() => tasksAPI.getMyTasks(status)),
    getStatistics: (periodDays, userId) => withLoading(() => tasksAPI.getTaskStatistics(periodDays, userId)),
    getEmployeeWorkload: (role) => withLoading(() => tasksAPI.getEmployeeWorkload(role)),
    getUrgent: () => withLoading(() => tasksAPI.getUrgentTasks()),
    autoAssign: (taskIds) => withLoading(() => tasksAPI.autoAssignTasks(taskIds)),
    createRecurring: () => withLoading(() => tasksAPI.createRecurringTasks())
  };

  // Orders operations
  const orders = {
    getAll: (params) => withLoading(() => ordersAPI.getOrders(params)),
    getById: (id) => withLoading(() => ordersAPI.getOrder(id)),
    create: (data) => withLoading(() => ordersAPI.createOrder(data)),
    update: (id, data) => withLoading(() => ordersAPI.updateOrder(id, data)),
    assign: (id, assignedTo) => withLoading(() => ordersAPI.assignOrder(id, assignedTo)),
    complete: (id, notes) => withLoading(() => ordersAPI.completeOrder(id, notes)),
    getStatistics: (periodDays) => withLoading(() => ordersAPI.getOrderStatistics(periodDays))
  };

  // Inventory operations
  const inventory = {
    getAll: (params) => withLoading(() => inventoryAPI.getItems(params)),
    getById: (id) => withLoading(() => inventoryAPI.getItem(id)),
    create: (data) => withLoading(() => inventoryAPI.createItem(data)),
    update: (id, data) => withLoading(() => inventoryAPI.updateItem(id, data)),
    delete: (id) => withLoading(() => inventoryAPI.deleteItem(id)),
    createMovement: (itemId, data) => withLoading(() => inventoryAPI.createMovement(itemId, data)),
    getMovements: (itemId, params) => withLoading(() => inventoryAPI.getMovements(itemId, params)),
    getLowStock: () => withLoading(() => inventoryAPI.getLowStockItems()),
    getStatistics: () => withLoading(() => inventoryAPI.getStatistics()),
    bulkUpdateStock: (updates) => withLoading(() => inventoryAPI.bulkUpdateStock(updates)),
    export: (format, category) => withLoading(() => inventoryAPI.exportData(format, category))
  };

  // Documents operations
  const documents = {
    getAll: (params) => withLoading(() => documentsAPI.getDocuments(params)),
    getById: (id) => withLoading(() => documentsAPI.getDocument(id)),
    create: (data) => withLoading(() => documentsAPI.createDocument(data)),
    update: (id, data) => withLoading(() => documentsAPI.updateDocument(id, data)),
    download: (id) => withLoading(() => documentsAPI.downloadDocument(id)),
    sign: (id, signatureData) => withLoading(() => documentsAPI.signDocument(id, signatureData)),
    generateContract: (rentalId) => withLoading(() => documentsAPI.generateRentalContract(rentalId)),
    generateAct: (rentalId) => withLoading(() => documentsAPI.generateWorkAct(rentalId)),
    sendESF: (id) => withLoading(() => documentsAPI.sendESF(id))
  };

  // Payroll operations
  const payroll = {
    getAll: (params) => withLoading(() => payrollAPI.getPayrolls(params)),
    getById: (id) => withLoading(() => payrollAPI.getPayroll(id)),
    create: (data) => withLoading(() => payrollAPI.createPayroll(data)),
    update: (id, data) => withLoading(() => payrollAPI.updatePayroll(id, data)),
    markAsPaid: (id, paymentMethod) => withLoading(() => payrollAPI.markAsPaid(id, paymentMethod)),
    calculateMonthly: (year, month, userId) => withLoading(() => payrollAPI.calculateMonthly(year, month, userId)),
    getStatistics: (year, month) => withLoading(() => payrollAPI.getStatistics(year, month)),
    export: (format, year, month) => withLoading(() => payrollAPI.exportData(format, year, month))
  };

  // Reports operations
  const reports = {
    getFinancialSummary: (startDate, endDate) => withLoading(() => reportsAPI.getFinancialSummary(startDate, endDate)),
    getPropertyOccupancy: (startDate, endDate, propertyId) => withLoading(() => reportsAPI.getPropertyOccupancy(startDate, endDate, propertyId)),
    getEmployeePerformance: (startDate, endDate, role, userId) => withLoading(() => reportsAPI.getEmployeePerformance(startDate, endDate, role, userId)),
    getClientAnalytics: (startDate, endDate) => withLoading(() => reportsAPI.getClientAnalytics(startDate, endDate)),
    getMyPayroll: (periodStart, periodEnd) => withLoading(() => reportsAPI.getMyPayroll(periodStart, periodEnd)),
    exportFinancialSummary: (startDate, endDate, format) => withLoading(() => reportsAPI.exportFinancialSummary(startDate, endDate, format))
  };

  // Utility functions
  const utils = {
    clearError: () => setError(null),
    isLoading: () => loading
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
    utils
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};