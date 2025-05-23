// API Service with mock implementations
// These functions will be replaced with real API calls when backend is ready

// Guest API
export const guestAPI = {
  // Get all guests
  async getGuests() {
    const data = await import('../mockData/guests.json');
    return data.guests;
  },

  // Get single guest
  async getGuest(id) {
    const data = await import('../mockData/guests.json');
    return data.guests.find(g => g.id === id);
  },

  // Create new guest
  async createGuest(guestData) {
    // Mock implementation - will be replaced with real API call
    console.log('Creating guest:', guestData);
    return { ...guestData, id: Date.now() };
  },

  // Update guest
  async updateGuest(id, guestData) {
    console.log('Updating guest:', id, guestData);
    return { ...guestData, id };
  },

  // Delete guest
  async deleteGuest(id) {
    console.log('Deleting guest:', id);
    return { success: true };
  }
};

// Room API
export const roomAPI = {
  // Get all rooms
  async getRooms() {
    const data = await import('../mockData/rooms.json');
    return data.rooms;
  },

  // Get single room
  async getRoom(id) {
    const data = await import('../mockData/rooms.json');
    return data.rooms.find(r => r.id === id);
  },

  // Update room status
  async updateRoomStatus(id, status) {
    console.log('Updating room status:', id, status);
    return { id, status };
  },

  // Check in guest
  async checkInGuest(roomId, guestId, checkInDate, checkOutDate) {
    console.log('Check in:', { roomId, guestId, checkInDate, checkOutDate });
    return { success: true };
  },

  // Check out guest
  async checkOutGuest(roomId) {
    console.log('Check out:', roomId);
    return { success: true };
  }
};

// Task API
export const taskAPI = {
  // Get all tasks
  async getTasks() {
    const data = await import('../mockData/tasks.json');
    return data.tasks;
  },

  // Get single task
  async getTask(id) {
    const data = await import('../mockData/tasks.json');
    return data.tasks.find(t => t.id === id);
  },

  // Create task
  async createTask(taskData) {
    console.log('Creating task:', taskData);
    return { ...taskData, id: Date.now(), createdAt: new Date().toISOString() };
  },

  // Update task
  async updateTask(id, taskData) {
    console.log('Updating task:', id, taskData);
    return { ...taskData, id };
  },

  // Update task status
  async updateTaskStatus(id, status) {
    console.log('Updating task status:', id, status);
    return { id, status };
  },

  // Assign task
  async assignTask(id, assigneeId) {
    console.log('Assigning task:', id, assigneeId);
    return { id, assigneeId };
  }
};

// Booking API
export const bookingAPI = {
  // Get bookings data
  async getBookings() {
    const data = await import('../mockData/bookings.json');
    return data.bookings;
  },

  // Get dashboard stats
  async getDashboardStats() {
    const data = await import('../mockData/bookings.json');
    return {
      satisfactionRate: data.satisfactionRate,
      newGuests: data.newGuests
    };
  },

  // Create booking
  async createBooking(bookingData) {
    console.log('Creating booking:', bookingData);
    return { ...bookingData, id: Date.now(), createdAt: new Date().toISOString() };
  },

  // Cancel booking
  async cancelBooking(id) {
    console.log('Cancelling booking:', id);
    return { success: true };
  }
};

// Conversation API
export const conversationAPI = {
  // Get all conversations
  async getConversations() {
    const data = await import('../mockData/conversations.json');
    return data.conversations;
  },

  // Get single conversation
  async getConversation(id) {
    const data = await import('../mockData/conversations.json');
    return data.conversations.find(c => c.id === id);
  },

  // Send message
  async sendMessage(conversationId, message) {
    console.log('Sending message:', conversationId, message);
    return {
      id: Date.now(),
      conversationId,
      text: message,
      sender: 'hotel',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  },

  // Mark as read
  async markAsRead(conversationId) {
    console.log('Marking as read:', conversationId);
    return { success: true };
  }
};

// Activity API
export const activityAPI = {
  // Get recent activities
  async getActivities() {
    const data = await import('../mockData/activities.json');
    return data.activities;
  },

  // Log activity
  async logActivity(activityData) {
    console.log('Logging activity:', activityData);
    return { ...activityData, id: Date.now(), time: 'just now' };
  }
};

// Auth API (for future use)
export const authAPI = {
  // Login
  async login(email, password) {
    console.log('Login:', email);
    // Mock successful login
    return {
      user: {
        id: 1,
        name: 'Ann Tsibuiski',
        email: email,
        role: 'manager'
      },
      token: 'mock-jwt-token'
    };
  },

  // Logout
  async logout() {
    console.log('Logout');
    return { success: true };
  },

  // Get current user
  async getCurrentUser() {
    return {
      id: 1,
      name: 'Ann Tsibuiski',
      email: 'ann.tsibuiski@hotel.com',
      role: 'manager'
    };
  }
};