// frontend/src/services/api.js - Исправленная версия
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
        window.location.href = '/login';
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
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => err.msg || err).join(', ');
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (jsonError) {
      // Если ответ не JSON, используем статус
      console.warn('Could not parse error response as JSON:', jsonError);
    }
    
    throw new Error(errorMessage);
  }
  
  // Для файловых загрузок возвращаем blob
  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    return response.blob();
  }
  
  // Проверяем, есть ли контент для парсинга
  const text = await response.text();
  if (!text) {
    return null;
  }
  
  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.warn('Could not parse response as JSON:', parseError);
    return text;
  }
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
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/system/status`);
      const data = await response.json();
      return { initialized: data.initialized || false };
    } catch (error) {
      console.error('System status check failed:', error);
      return { initialized: false };
    }
  },

  async initializeSystem(initData) {
    return fetch(`${API_BASE_URL}/api/auth/system/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initData)
    }).then(handleResponse);
  }
};

export const organizationAPI = {
  async getCurrentOrganization() {
    return apiRequest('/api/organization/info');
  },

  async getLimits() {
    try {
      const dashboardStats = await this.getDashboardStatistics();
      
      if (dashboardStats?.admin_specific?.organization_health) {
        const health = dashboardStats.admin_specific.organization_health;
        
        const parseLimitUsage = (limitString) => {
          if (!limitString || typeof limitString !== 'string') return { current: 0, max: 0 };
          const [current, max] = limitString.split('/').map(num => parseInt(num) || 0);
          return { current, max };
        };

        const userLimits = parseLimitUsage(health.user_limit_usage);
        const propertyLimits = parseLimitUsage(health.property_limit_usage);

        return {
          max_users: userLimits.max,
          max_properties: propertyLimits.max,
          current_users: userLimits.current,
          current_properties: propertyLimits.current
        };
      }
      
      return {
        max_users: 10,
        max_properties: 50,
        current_users: 0,
        current_properties: 0
      };
    } catch (error) {
      console.warn('Failed to get org limits, using defaults:', error);
      return {
        max_users: 10,
        max_properties: 50,
        current_users: 0,
        current_properties: 0
      };
    }
  },

  async getUsageStatistics() {
    try {
      const dashboardStats = await this.getDashboardStatistics();
      
      return {
        properties_count: dashboardStats?.organization_stats?.total_properties || 0,
        active_rentals: dashboardStats?.organization_stats?.active_rentals || 0,
        monthly_tasks: dashboardStats?.today_stats?.completed_tasks || 0,
        revenue_this_month: dashboardStats?.month_stats?.revenue || 0,
        total_clients: dashboardStats?.organization_stats?.total_clients || 0,
        total_staff: dashboardStats?.organization_stats?.total_staff || 0,
        occupancy_rate: dashboardStats?.month_stats?.occupancy_rate || 0,
        new_clients: dashboardStats?.month_stats?.new_clients || 0
      };
    } catch (error) {
      console.warn('Failed to get usage stats, using defaults:', error);
      return {
        properties_count: 0,
        active_rentals: 0,
        monthly_tasks: 0,
        revenue_this_month: 0,
        total_clients: 0,
        total_staff: 0,
        occupancy_rate: 0,
        new_clients: 0
      };
    }
  },

  async updateSettings(settings) {
    return apiRequest('/api/organization/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  },

  // User management methods
  async getUsers(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    return apiRequest(`/api/organization/users?${searchParams}`);
  },

  async getUser(userId) {
    return apiRequest(`/api/organization/users/${userId}`);
  },

  async createUser(userData) {
    return apiRequest('/api/organization/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUser(userId, userData) {
    return apiRequest(`/api/organization/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  },

  async deleteUser(userId) {
    return apiRequest(`/api/organization/users/${userId}`, {
      method: 'DELETE'
    });
  },

  async getAvailableRoles() {
    try {
      return await apiRequest('/api/organization/users/roles/available');
    } catch (error) {
      // Fallback роли если API не доступен
      return [
        { code: 'admin', name: 'Администратор' },
        { code: 'manager', name: 'Менеджер' },
        { code: 'technical_staff', name: 'Технический персонал' },
        { code: 'accountant', name: 'Бухгалтер' },
        { code: 'cleaner', name: 'Уборщик' },
        { code: 'storekeeper', name: 'Кладовщик' }
      ];
    }
  },

  async resetUserPassword(userId) {
    return apiRequest(`/api/organization/users/${userId}/reset-password`, {
      method: 'POST'
    });
  },

  async getUserPerformance(userId, periodDays = 30) {
    return apiRequest(`/api/organization/users/${userId}/performance?period_days=${periodDays}`);
  },

  async getDashboardStatistics() {
    return apiRequest('/api/organization/dashboard/statistics');
  },

  async getRecentAuditActions(limit = 50) {
    return apiRequest(`/api/organization/audit/recent-actions?limit=${limit}`);
  }
};

// Properties API
export const propertiesAPI = {
  async getProperties(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    return apiRequest(`/api/properties?${searchParams}`);
  },

  async getPropertiesWithLimits(params = {}) {
    const [properties, limits] = await Promise.all([
      this.getProperties(params),
      organizationAPI.getLimits()
    ]);
    
    return {
      properties,
      limits: {
        ...limits,
        current_properties: properties.length
      }
    };
  },

  async getProperty(id) {
    return apiRequest(`/api/properties/${id}`);
  },

  async createProperty(propertyData) {
    return apiRequest('/api/properties', {
      method: 'POST',
      body: JSON.stringify(propertyData)
    });
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
    return apiRequest(`/api/properties/${id}/status?new_status=${status}`, {
      method: 'PATCH'
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
  }
};

// Rentals API
export const rentalsAPI = {
  async getRentals(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
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

  async cancel(id, reason) {
    return apiRequest(`/api/rentals/${id}?reason=${encodeURIComponent(reason)}`, {
      method: 'DELETE'
    });
  }
};

// Clients API
export const clientsAPI = {
  async getClients(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
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

// Tasks API
export const tasksAPI = {
  async getTasks(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
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
    return apiRequest(`/api/tasks/${id}/assign?assigned_to=${assignedTo}`, {
      method: 'POST'
    });
  },

  async startTask(id) {
    return apiRequest(`/api/tasks/${id}/start`, {
      method: 'POST'
    });
  },

  async completeTask(id, completionData = {}) {
    const params = new URLSearchParams();
    if (completionData.completion_notes) {
      params.append('completion_notes', completionData.completion_notes);
    }
    if (completionData.quality_rating) {
      params.append('quality_rating', completionData.quality_rating);
    }
    if (completionData.actual_duration) {
      params.append('actual_duration', completionData.actual_duration);
    }
    
    return apiRequest(`/api/tasks/${id}/complete?${params}`, {
      method: 'POST'
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
    
    try {
      return await apiRequest(`/api/tasks/statistics/overview?${params}`);
    } catch (error) {
      console.warn('Task statistics not available, using defaults:', error);
      return {
        completed_tasks: 0,
        active_tasks: 0,
        urgent_tasks: 0,
        total_hours: 0,
        avg_completion_time: 0
      };
    }
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
      body: JSON.stringify(taskIds)
    });
  },

  async createRecurringTasks() {
    return apiRequest('/api/tasks/maintenance/create-recurring', {
      method: 'POST'
    });
  }
};

// В файле frontend/src/services/api.js найдите и замените существующий export reportsAPI на:

// Reports API (обновленная версия)
export const reportsAPI = {
  async getFinancialSummary(startDate, endDate) {
    return apiRequest(`/api/reports/financial-summary?start_date=${startDate}&end_date=${endDate}`);
  },

  async getPropertyOccupancy(startDate, endDate, propertyId = null) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate
    });
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

  // ИСПРАВЛЕННЫЙ метод экспорта финансового отчета
  async exportFinancialSummary(startDate, endDate, format = 'xlsx') {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/reports/financial-summary/export?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&format=${format}`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, application/octet-stream'
          }
        }
      );
      
      if (!response.ok) {
        let errorMessage = `Ошибка ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Если не удается распарсить JSON, используем статус ответа
        }
        
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      
      // Проверяем, что получили файл
      if (blob.size === 0) {
        throw new Error('Получен пустой файл');
      }
      
      return blob;
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  },

  // Добавляем методы экспорта для других отчетов
  async exportPropertyOccupancy(startDate, endDate, propertyId = null, format = 'xlsx') {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: format
      });
      
      if (propertyId) {
        params.append('property_id', propertyId);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/reports/property-occupancy/export?${params}`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Ошибка экспорта: ${response.status} ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Property occupancy export failed:', error);
      throw error;
    }
  },

  async exportClientAnalytics(startDate, endDate, format = 'xlsx') {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: format
      });

      const response = await fetch(
        `${API_BASE_URL}/api/reports/client-analytics/export?${params}`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Ошибка экспорта: ${response.status} ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Client analytics export failed:', error);
      throw error;
    }
  },

  async exportEmployeePerformance(startDate, endDate, role = null, userId = null, format = 'xlsx') {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: format
      });
      
      if (role) params.append('role', role);
      if (userId) params.append('user_id', userId);

      const response = await fetch(
        `${API_BASE_URL}/api/reports/employee-performance/export?${params}`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Ошибка экспорта: ${response.status} ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Employee performance export failed:', error);
      throw error;
    }
  },

  // НОВЫЕ методы экспорта
  async exportGeneralStatistics(startDate, endDate, format = 'xlsx') {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: format
      });

      const response = await fetch(
        `${API_BASE_URL}/api/reports/general-statistics/export?${params}`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Ошибка экспорта: ${response.status} ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('General statistics export failed:', error);
      throw error;
    }
  },

  async exportComparativeAnalysis(startDate, endDate, format = 'xlsx') {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: format
      });

      const response = await fetch(
        `${API_BASE_URL}/api/reports/comparative-analysis/export?${params}`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Ошибка экспорта: ${response.status} ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Comparative analysis export failed:', error);
      throw error;
    }
  },

  // Методы отладки
  async debugDataSources(startDate, endDate) {
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('Токен авторизации не найден');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/reports/debug/data-sources?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Debug API failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  },

  async debugEmployeeEarnings(userId, startDate, endDate) {
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('Токен авторизации не найден');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/reports/debug/employee-earnings/${userId}?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Employee debug API failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
};

// Orders API
export const ordersAPI = {
  async getOrders(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
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
    return apiRequest(`/api/orders/${id}/assign?assigned_to=${assignedTo}`, {
      method: 'POST'
    });
  },

  async completeOrder(id, completionNotes = null) {
    const params = completionNotes ? `?completion_notes=${encodeURIComponent(completionNotes)}` : '';
    return apiRequest(`/api/orders/${id}/complete${params}`, {
      method: 'POST'
    });
  },

  async getOrderStatistics(periodDays = 30) {
    return apiRequest(`/api/orders/statistics/overview?period_days=${periodDays}`);
  }
};

// Documents API
export const documentsAPI = {
  async getDocuments(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
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

// Inventory API
export const inventoryAPI = {
  async getItems(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
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
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    return apiRequest(`/api/inventory/${itemId}/movements?${searchParams}`);
  },

  async getLowStockItems() {
    try {
      return await apiRequest('/api/inventory/low-stock/alert');
    } catch (error) {
      console.warn('Low stock API not available:', error);
      return [];
    }
  },

  async getStatistics() {
    try {
      return await apiRequest('/api/inventory/statistics/overview');
    } catch (error) {
      console.warn('Inventory statistics not available, using defaults:', error);
      return {
        total_items: 0,
        low_stock_count: 0,
        total_value: 0,
        recent_movements: 0
      };
    }
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

// Payroll API
export const payrollAPI = {
  // Основные методы зарплат
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.skip) query.append('skip', params.skip);
    if (params.limit) query.append('limit', params.limit);
    if (params.user_id) query.append('user_id', params.user_id);
    if (params.period_start) query.append('period_start', params.period_start);
    if (params.period_end) query.append('period_end', params.period_end);
    if (params.is_paid !== undefined) query.append('is_paid', params.is_paid);
    if (params.year) query.append('year', params.year);
    if (params.month) query.append('month', params.month);
    
    return apiRequest(`/api/payroll?${query.toString()}`);
  },

  getById: async (payrollId) => {
    return apiRequest(`/api/payroll/payID/${payrollId}`);
  },

  create: async (data) => {
    return apiRequest('/api/payroll', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  update: async (payrollId, data) => {
    return apiRequest(`/api/payroll/${payrollId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  markAsPaid: async (payrollId, paymentMethod = 'bank_transfer') => {
    const params = new URLSearchParams({
      payment_method: paymentMethod
    });
    
    return apiRequest(`/api/payroll/${payrollId}/pay?${params.toString()}`, {
      method: 'POST'
    });
  },

  calculateMonthly: async (year, month, userId = null) => {
    const params = new URLSearchParams({
      year: year,
      month: month
    });
    
    if (userId) {
      params.append('user_id', userId);
    }
    
    return apiRequest(`/api/payroll/calculate-monthly?${params.toString()}`, {
      method: 'POST'
    });
  },

  getStatistics: async (year, month = null) => {
    const params = new URLSearchParams({
      year: year
    });
    
    if (month) {
      params.append('month', month);
    }
    
    return apiRequest(`/api/payroll/statistics/overview?${params.toString()}`);
  },

  exportData: async (format, year, month = null) => {
    const params = new URLSearchParams({
      year: year
    });
    
    if (month) {
      params.append('month', month);
    }
    
    const response = await fetch(`${API_BASE_URL}/api/payroll/export/${format}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      }
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }
    
    return response.blob();
  },

  autoGenerate: async (year, month, forceRecreate = false) => {
    const params = new URLSearchParams({
      year: year,
      month: month,
      force_recreate: forceRecreate
    });
    
    return apiRequest(`/api/payroll/auto-generate?${params.toString()}`, {
      method: 'POST'
    });
  },

  recalculate: async (payrollId) => {
    return apiRequest(`/api/payroll/recalculate/${payrollId}`, {
      method: 'POST'
    });
  },

  getUserSummary: async (userId, months = 6) => {
    const params = new URLSearchParams({
      months: months
    });
    
    return apiRequest(`/api/payroll/summary/${userId}?${params.toString()}`);
  },

  // Методы для шаблонов
  getTemplates: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.user_id) query.append('user_id', params.user_id);
    if (params.status) query.append('status', params.status);
    
    return apiRequest(`/api/payroll/templates?${query.toString()}`);
  },

  createTemplate: async (data) => {
    return apiRequest('/api/payroll/templates', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateTemplate: async (templateId, data) => {
    return apiRequest(`/api/payroll/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deactivateTemplate: async (templateId) => {
    return apiRequest(`/api/payroll/templates/${templateId}`, {
      method: 'DELETE'
    });
  },

  // Методы для операций
  getOperations: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.user_id) query.append('user_id', params.user_id);
    if (params.operation_type) query.append('operation_type', params.operation_type);
    if (params.is_applied !== undefined) query.append('is_applied', params.is_applied);
    if (params.skip) query.append('skip', params.skip);
    if (params.limit) query.append('limit', params.limit);
    if (params.year) query.append('year', params.year);
    if (params.month) query.append('month', params.month);
    
    return apiRequest(`/api/payroll/operations?${query.toString()}`);
  },

  addOperation: async (data) => {
    return apiRequest('/api/payroll/operations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  cancelOperation: async (operationId, reason) => {
    const params = new URLSearchParams({
      reason: reason
    });
    
    return apiRequest(`/api/payroll/operations/${operationId}?${params.toString()}`, {
      method: 'DELETE'
    });
  },

  addQuickBonus: async (userId, data) => {
    // API ожидает параметры в query string согласно OpenAPI спецификации
    const params = new URLSearchParams({
      amount: data.amount,
      reason: data.reason
    });
    
    const body = {
      apply_to_current_month: data.apply_to_current_month !== undefined ? data.apply_to_current_month : true
    };
    
    return apiRequest(`/api/payroll/users/${userId}/bonus?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  addQuickPenalty: async (userId, data) => {
    const params = new URLSearchParams({
      amount: data.amount,
      reason: data.reason
    });
    
    const body = {
      apply_to_current_month: data.apply_to_current_month !== undefined ? data.apply_to_current_month : true
    };
    
    return apiRequest(`/api/payroll/users/${userId}/penalty?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  addOvertimePayment: async (userId, data) => {
    const params = new URLSearchParams({
      hours: data.hours,
      description: data.description || 'Сверхурочная работа'
    });
    
    if (data.hourly_rate) {
      params.append('hourly_rate', data.hourly_rate);
    }
    
    // ИСПРАВЛЕНО: body должен быть пустым или содержать только необходимые поля
    return apiRequest(`/api/payroll/users/${userId}/overtime?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({}) // Пустое тело, так как все параметры в query string
    });
  },

  addAllowance: async (userId, data) => {
    const params = new URLSearchParams({
      amount: data.amount,
      title: data.title || 'Надбавка'
    });
    
    if (data.description) {
      params.append('description', data.description);
    }
    
    const body = {
      is_recurring: data.is_recurring || false
    };
    
    return apiRequest(`/api/payroll/users/${userId}/allowance?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  addDeduction: async (userId, data) => {
    const params = new URLSearchParams({
      amount: data.amount,
      title: data.title || 'Удержание',
      reason: data.reason
    });
    
    // ИСПРАВЛЕНО: body должен быть пустым или содержать только необходимые поля
    return apiRequest(`/api/payroll/users/${userId}/deduction?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({}) // Пустое тело, так как все параметры в query string
    });
  },

  // Админские методы
  admin: {
    quickSetupTemplates: async (baseRates = {}) => {
      return apiRequest('/api/admin/payroll/templates/quick-setup', {
        method: 'POST',
        body: JSON.stringify(baseRates)
      });
    },

    bulkUpdateTemplates: async (updates) => {
      return apiRequest('/api/admin/payroll/templates/bulk-update', {
        method: 'POST',
        body: JSON.stringify(updates)
      });
    },

    createBulkOperations: async (data) => {
      return apiRequest('/api/admin/payroll/operations/bulk', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    createSeasonalBonus: async (amount, title = 'Сезонная премия', roles = [], excludeUsers = []) => {
      const params = new URLSearchParams({
        bonus_amount: amount,
        bonus_title: title
      });
      
      if (roles.length > 0) {
        roles.forEach(role => params.append('target_roles', role));
      }
      
      if (excludeUsers.length > 0) {
        excludeUsers.forEach(userId => params.append('exclude_users', userId));
      }
      
      return apiRequest(`/api/admin/payroll/operations/seasonal-bonus?${params.toString()}`, {
        method: 'POST'
      });
    },

    getOrganizationSummary: async (year, month = null) => {
      const params = new URLSearchParams({
        year: year
      });
      
      if (month) {
        params.append('month', month);
      }
      
      return apiRequest(`/api/admin/payroll/analytics/organization-summary?${params.toString()}`);
    },

    getForecast: async (months = 3) => {
      const params = new URLSearchParams({
        months: months
      });
      
      return apiRequest(`/api/admin/payroll/forecast?${params.toString()}`);
    },

    autoGenerateMonthly: async (year, month, forceRecreate = false) => {
      const params = new URLSearchParams({
        force_recreate: forceRecreate
      });
      
      return apiRequest(`/api/admin/payroll/auto-generate/${year}/${month}?${params.toString()}`, {
        method: 'POST'
      });
    },

    getSettings: async () => {
      return apiRequest('/api/admin/payroll/settings');
    },

    updateSettings: async (settings) => {
      return apiRequest('/api/admin/payroll/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
    },

    exportDetailedReport: async (year, month = null, format = 'excel') => {
      const params = new URLSearchParams({
        year: year,
        format: format
      });
      
      if (month) {
        params.append('month', month);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/admin/payroll/export/detailed-report?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        }
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      return response.blob();
    },

    notifyPayrollReady: async (year, month, userIds = null) => {
      const params = new URLSearchParams({
        year: year,
        month: month
      });
      
      return apiRequest(`/api/admin/payroll/notify/payroll-ready?${params.toString()}`, {
        method: 'POST',
        body: JSON.stringify(userIds)
      });
    },

    archiveOldPayrolls: async (monthsOld = 24) => {
      const params = new URLSearchParams({
        months_old: monthsOld
      });
      
      return apiRequest(`/api/admin/payroll/archive/old-payrolls?${params.toString()}`, {
        method: 'POST'
      });
    }
  }
};

// Admin Payroll API for admin-specific operations

// Универсальные методы для всех API
const createCRUDAPI = (basePath) => ({
  async getAll(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    return apiRequest(`${basePath}?${searchParams}`);
  },

  async getById(id) {
    return apiRequest(`${basePath}/${id}`);
  },

  async create(data) {
    return apiRequest(basePath, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async update(id, data) {
    return apiRequest(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async delete(id) {
    return apiRequest(`${basePath}/${id}`, {
      method: 'DELETE'
    });
  }
});

// Добавляем алиасы для обратной совместимости
export const inventory = {
  ...inventoryAPI,
  getAll: inventoryAPI.getItems,
  getById: inventoryAPI.getItem,
  create: inventoryAPI.createItem
};

export const tasks = {
  ...tasksAPI,
  getAll: tasksAPI.getTasks,
  getById: tasksAPI.getTask,
  create: tasksAPI.createTask,
  getMy: tasksAPI.getMyTasks,
  start: tasksAPI.startTask,
  complete: tasksAPI.completeTask,
  assign: tasksAPI.assignTask,
  cancel: tasksAPI.cancelTask,
  getStatistics: tasksAPI.getTaskStatistics
};

export const properties = {
  ...propertiesAPI,
  getAll: propertiesAPI.getProperties,
  getById: propertiesAPI.getProperty,
  create: propertiesAPI.createProperty
};

export const clients = {
  ...clientsAPI,
  getAll: clientsAPI.getClients,
  getById: clientsAPI.getClient,
  create: clientsAPI.createClient
};

// Export all APIs
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
  inventory,
  tasks,
  properties,
  clients
};