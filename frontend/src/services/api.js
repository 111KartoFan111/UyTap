// services/api.js - Real API integration
const API_BASE_URL = 'http://localhost:8000';

// API Request helper with auth token
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry original request with new token
        config.headers.Authorization = `Bearer ${localStorage.getItem('access_token')}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
        return await handleResponse(retryResponse);
      } else {
        // Redirect to login
        localStorage.clear();
        window.location.href = '/';
        throw new Error('Session expired');
      }
    }
    
    return await handleResponse(response);
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
};

const refreshToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// Auth API
export const authAPI = {
  async login(email, password, organizationSlug) {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        organization_slug: organizationSlug,
        device_info: {
          platform: navigator.platform,
          mobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        }
      })
    });
  },

  async logout(refreshToken) {
    return apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: refreshToken,
        logout_all_devices: false
      })
    });
  },

  async getCurrentUser() {
    return apiRequest('/api/auth/me');
  },

  async checkSystemStatus() {
    return fetch(`${API_BASE_URL}/api/auth/system/status`)
      .then(response => response.json());
  },

  async initializeSystem(initData) {
    return fetch(`${API_BASE_URL}/api/auth/system/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initData)
    }).then(handleResponse);
  }
};

// Organization API
export const organizationAPI = {
  async getCurrentOrganization() {
    return apiRequest('/api/organizations/current');
  },

  async getOrganizationLimits() {
    return apiRequest('/api/organizations/current/limits');
  },

  async getUsageStatistics() {
    return apiRequest('/api/organizations/current/usage');
  },

  async updateSettings(settings) {
    return apiRequest('/api/organizations/current/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  }
};

// Clients API
export const clientsAPI = {
  async getClients(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/clients?${searchParams}`);
  },

  async getClient(id) {
    return apiRequest(`/api/clients/${id}`);
  },

  async createClient(clientData) {
    return apiRequest('/api/clients', {
      method: 'POST',
      body: JSON.stringify(clientData)
    });
  },

  async updateClient(id, clientData) {
    return apiRequest(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData)
    });
  },

  async deleteClient(id) {
    return apiRequest(`/api/clients/${id}`, {
      method: 'DELETE'
    });
  },

  async getClientHistory(id) {
    return apiRequest(`/api/clients/${id}/history`);
  },

  async getClientStatistics(id) {
    return apiRequest(`/api/clients/${id}/statistics`);
  },

  async bulkImport(clientsData) {
    return apiRequest('/api/clients/bulk-import', {
      method: 'POST',
      body: JSON.stringify(clientsData)
    });
  }
};

// Properties API с проверкой лимитов
export const propertiesAPI = {
  async getProperties(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/properties?${searchParams}`);
  },

  async getProperty(id) {
    return apiRequest(`/api/properties/${id}`);
  },

  async createProperty(propertyData) {
    try {
      // Сначала получаем информацию об организации для проверки лимитов
      const organization = await organizationAPI.getCurrentOrganization();
      const currentProperties = await this.getProperties();
      
      if (currentProperties.length >= organization.max_properties) {
        throw new Error(`Достигнут лимит помещений (${organization.max_properties}). Обратитесь к администратору для увеличения лимита.`);
      }
      
      return apiRequest('/api/properties', {
        method: 'POST',
        body: JSON.stringify(propertyData)
      });
    } catch (error) {
      if (error.message.includes('лимит')) {
        throw error;
      }
      // Если ошибка получения лимитов, пробуем создать напрямую
      return apiRequest('/api/properties', {
        method: 'POST',
        body: JSON.stringify(propertyData)
      });
    }
  },

  async updateProperty(id, propertyData) {
    return apiRequest(`/api/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(propertyData)
    });
  },

  async deleteProperty(id) {
    return apiRequest(`/api/properties/${id}`, {
      method: 'DELETE'
    });
  },

  async updatePropertyStatus(id, status) {
    return apiRequest(`/api/properties/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async getPropertyTasks(id, status = null) {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/api/properties/${id}/tasks${params}`);
  },

  async createPropertyTask(id, taskData) {
    return apiRequest(`/api/properties/${id}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async checkAvailability(id, startDate, endDate) {
    return apiRequest(`/api/properties/${id}/availability?start_date=${startDate}&end_date=${endDate}`);
  },

  async getPropertyStatistics(id, periodDays = 30) {
    return apiRequest(`/api/properties/${id}/statistics?period_days=${periodDays}`);
  },

  // Получить помещения с информацией о лимитах
  async getPropertiesWithLimits(params = {}) {
    try {
      const [properties, organization] = await Promise.all([
        this.getProperties(params),
        organizationAPI.getCurrentOrganization().catch(() => null)
      ]);

      return {
        properties,
        limits: organization ? {
          current: properties.length,
          max: organization.max_properties,
          canCreate: properties.length < organization.max_properties
        } : null
      };
    } catch (error) {
      // Если не удалось получить организацию, возвращаем только помещения
      const properties = await this.getProperties(params);
      return { properties, limits: null };
    }
  }
};

// Rentals API
export const rentalsAPI = {
  async getRentals(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/rentals?${searchParams}`);
  },

  async getRental(id) {
    return apiRequest(`/api/rentals/${id}`);
  },

  async createRental(rentalData) {
    return apiRequest('/api/rentals', {
      method: 'POST',
      body: JSON.stringify(rentalData)
    });
  },

  async updateRental(id, rentalData) {
    return apiRequest(`/api/rentals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rentalData)
    });
  },

  async checkIn(id) {
    return apiRequest(`/api/rentals/${id}/check-in`, {
      method: 'POST'
    });
  },

  async checkOut(id) {
    return apiRequest(`/api/rentals/${id}/check-out`, {
      method: 'POST'
    });
  },

  async cancelRental(id, reason) {
    return apiRequest(`/api/rentals/${id}?reason=${encodeURIComponent(reason)}`, {
      method: 'DELETE'
    });
  }
};

// Tasks API
export const tasksAPI = {
  async getTasks(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/tasks?${searchParams}`);
  },

  async getTask(id) {
    return apiRequest(`/api/tasks/${id}`);
  },

  async createTask(taskData) {
    return apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async updateTask(id, taskData) {
    return apiRequest(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  },

  async assignTask(id, assignedTo) {
    return apiRequest(`/api/tasks/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to: assignedTo })
    });
  },

  async startTask(id) {
    return apiRequest(`/api/tasks/${id}/start`, {
      method: 'POST'
    });
  },

  async completeTask(id, completionData = {}) {
    return apiRequest(`/api/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(completionData)
    });
  },

  async cancelTask(id, reason) {
    return apiRequest(`/api/tasks/${id}?reason=${encodeURIComponent(reason)}`, {
      method: 'DELETE'
    });
  },

  async getMyTasks(status = null) {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/api/tasks/my/assigned${params}`);
  },

  async getTaskStatistics(periodDays = 30, userId = null) {
    const params = new URLSearchParams({ period_days: periodDays });
    if (userId) params.append('user_id', userId);
    return apiRequest(`/api/tasks/statistics/overview?${params}`);
  },

  async getEmployeeWorkload(role = null) {
    const params = role ? `?role=${role}` : '';
    return apiRequest(`/api/tasks/workload/employees${params}`);
  },

  async getUrgentTasks() {
    return apiRequest('/api/tasks/urgent');
  },

  async autoAssignTasks(taskIds) {
    return apiRequest('/api/tasks/auto-assign', {
      method: 'POST',
      body: JSON.stringify({ task_ids: taskIds })
    });
  },

  async createRecurringTasks() {
    return apiRequest('/api/tasks/maintenance/create-recurring', {
      method: 'POST'
    });
  }
};

// Orders API
export const ordersAPI = {
  async getOrders(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/orders?${searchParams}`);
  },

  async getOrder(id) {
    return apiRequest(`/api/orders/${id}`);
  },

  async createOrder(orderData) {
    return apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  async updateOrder(id, orderData) {
    return apiRequest(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData)
    });
  },

  async assignOrder(id, assignedTo) {
    return apiRequest(`/api/orders/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to: assignedTo })
    });
  },

  async completeOrder(id, completionNotes = null) {
    return apiRequest(`/api/orders/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completion_notes: completionNotes })
    });
  },

  async getOrderStatistics(periodDays = 30) {
    return apiRequest(`/api/orders/statistics/overview?period_days=${periodDays}`);
  }
};

// Inventory API
export const inventoryAPI = {
  async getItems(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/inventory?${searchParams}`);
  },

  async getItem(id) {
    return apiRequest(`/api/inventory/${id}`);
  },

  async createItem(itemData) {
    return apiRequest('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  async updateItem(id, itemData) {
    return apiRequest(`/api/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  },

  async deleteItem(id) {
    return apiRequest(`/api/inventory/${id}`, {
      method: 'DELETE'
    });
  },

  async createMovement(itemId, movementData) {
    return apiRequest(`/api/inventory/${itemId}/movement`, {
      method: 'POST',
      body: JSON.stringify(movementData)
    });
  },

  async getMovements(itemId, params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/inventory/${itemId}/movements?${searchParams}`);
  },

  async getLowStockItems() {
    return apiRequest('/api/inventory/low-stock/alert');
  },

  async getStatistics() {
    return apiRequest('/api/inventory/statistics/overview');
  },

  async bulkUpdateStock(updates) {
    return apiRequest('/api/inventory/bulk-update-stock', {
      method: 'POST',
      body: JSON.stringify(updates)
    });
  },

  async exportData(format, category = null) {
    const params = category ? `?category=${category}` : '';
    const response = await fetch(`${API_BASE_URL}/api/inventory/export/${format}${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }
};

// Documents API
export const documentsAPI = {
  async getDocuments(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/documents?${searchParams}`);
  },

  async getDocument(id) {
    return apiRequest(`/api/documents/${id}`);
  },

  async createDocument(documentData) {
    return apiRequest('/api/documents', {
      method: 'POST',
      body: JSON.stringify(documentData)
    });
  },

  async updateDocument(id, documentData) {
    return apiRequest(`/api/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(documentData)
    });
  },

  async downloadDocument(id) {
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    
    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  },

  async signDocument(id, signatureData) {
    return apiRequest(`/api/documents/${id}/sign`, {
      method: 'POST',
      body: JSON.stringify(signatureData)
    });
  },

  async generateRentalContract(rentalId) {
    return apiRequest(`/api/documents/rental/${rentalId}/generate-contract`, {
      method: 'POST'
    });
  },

  async generateWorkAct(rentalId) {
    return apiRequest(`/api/documents/rental/${rentalId}/generate-act`, {
      method: 'POST'
    });
  },

  async sendESF(id) {
    return apiRequest(`/api/documents/${id}/send-esf`, {
      method: 'POST'
    });
  }
};

// Payroll API
export const payrollAPI = {
  async getPayrolls(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/payroll?${searchParams}`);
  },

  async getPayroll(id) {
    return apiRequest(`/api/payroll/${id}`);
  },

  async createPayroll(payrollData) {
    return apiRequest('/api/payroll', {
      method: 'POST',
      body: JSON.stringify(payrollData)
    });
  },

  async updatePayroll(id, payrollData) {
    return apiRequest(`/api/payroll/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payrollData)
    });
  },

  async markAsPaid(id, paymentMethod) {
    return apiRequest(`/api/payroll/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_method: paymentMethod })
    });
  },

  async calculateMonthly(year, month, userId = null) {
    const params = new URLSearchParams({ year, month });
    if (userId) params.append('user_id', userId);
    return apiRequest(`/api/payroll/calculate-monthly?${params}`, {
      method: 'POST'
    });
  },

  async getStatistics(year, month = null) {
    const params = new URLSearchParams({ year });
    if (month) params.append('month', month);
    return apiRequest(`/api/payroll/statistics/overview?${params}`);
  },

  async exportData(format, year, month = null) {
    const params = new URLSearchParams({ year });
    if (month) params.append('month', month);
    
    const response = await fetch(`${API_BASE_URL}/api/payroll/export/${format}?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }
};

// Reports API
export const reportsAPI = {
  async getFinancialSummary(startDate, endDate) {
    return apiRequest(`/api/reports/financial-summary?start_date=${startDate}&end_date=${endDate}`);
  },

  async getPropertyOccupancy(startDate, endDate, propertyId = null) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (propertyId) params.append('property_id', propertyId);
    return apiRequest(`/api/reports/property-occupancy?${params}`);
  },

  async getEmployeePerformance(startDate, endDate, role = null, userId = null) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (role) params.append('role', role);
    if (userId) params.append('user_id', userId);
    return apiRequest(`/api/reports/employee-performance?${params}`);
  },

  async getClientAnalytics(startDate, endDate) {
    return apiRequest(`/api/reports/client-analytics?start_date=${startDate}&end_date=${endDate}`);
  },

  async getMyPayroll(periodStart = null, periodEnd = null) {
    const params = new URLSearchParams();
    if (periodStart) params.append('period_start', periodStart);
    if (periodEnd) params.append('period_end', periodEnd);
    return apiRequest(`/api/reports/my-payroll?${params}`);
  },

  async exportFinancialSummary(startDate, endDate, format = 'xlsx') {
    const response = await fetch(`${API_BASE_URL}/api/reports/financial-summary/export?start_date=${startDate}&end_date=${endDate}&format=${format}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }
};

// Admin API
export const adminAPI = {
  async getOrganizations(params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/admin/organizations?${searchParams}`);
  },

  async getOrganization(id) {
    return apiRequest(`/api/admin/organizations/${id}`);
  },

  async createOrganization(orgData) {
    return apiRequest('/api/admin/organizations', {
      method: 'POST',
      body: JSON.stringify(orgData)
    });
  },

  async updateOrganization(id, orgData) {
    return apiRequest(`/api/admin/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orgData)
    });
  },

  async deleteOrganization(id) {
    return apiRequest(`/api/admin/organizations/${id}`, {
      method: 'DELETE'
    });
  },

  async getOrganizationUsers(orgId, params = {}) {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/api/admin/organizations/${orgId}/users?${searchParams}`);
  },

  async createOrganizationUser(orgId, userData) {
    return apiRequest(`/api/admin/organizations/${orgId}/users`, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async deleteUser(userId) {
    return apiRequest(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });
  },

  async getSystemStats() {
    return apiRequest('/api/admin/stats');
  }
};

export default {
  authAPI,
  organizationAPI,
  clientsAPI,
  propertiesAPI,
  rentalsAPI,
  tasksAPI,
  ordersAPI,
  inventoryAPI,
  documentsAPI,
  payrollAPI,
  reportsAPI,
  adminAPI
};