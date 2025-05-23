import { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../services/api';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    bookings: [],
    satisfactionRate: {},
    newGuests: {}
  });
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [
        guestsData,
        roomsData,
        tasksData,
        conversationsData,
        activitiesData,
        bookingsData,
        stats
      ] = await Promise.all([
        api.guestAPI.getGuests(),
        api.roomAPI.getRooms(),
        api.taskAPI.getTasks(),
        api.conversationAPI.getConversations(),
        api.activityAPI.getActivities(),
        api.bookingAPI.getBookings(),
        api.bookingAPI.getDashboardStats()
      ]);

      setGuests(guestsData);
      setRooms(roomsData);
      setTasks(tasksData);
      setConversations(conversationsData);
      setActivities(activitiesData);
      setDashboardStats({
        bookings: bookingsData,
        ...stats
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Guest operations
  const addGuest = async (guestData) => {
    const newGuest = await api.guestAPI.createGuest(guestData);
    setGuests([...guests, newGuest]);
    return newGuest;
  };

  const updateGuest = async (id, guestData) => {
    const updatedGuest = await api.guestAPI.updateGuest(id, guestData);
    setGuests(guests.map(g => g.id === id ? updatedGuest : g));
    return updatedGuest;
  };

  const deleteGuest = async (id) => {
    await api.guestAPI.deleteGuest(id);
    setGuests(guests.filter(g => g.id !== id));
  };

  // Room operations
  const updateRoomStatus = async (id, status) => {
    const result = await api.roomAPI.updateRoomStatus(id, status);
    setRooms(rooms.map(r => r.id === id ? { ...r, status } : r));
    return result;
  };

  const checkInGuest = async (roomId, guestId, checkInDate, checkOutDate) => {
    const result = await api.roomAPI.checkInGuest(roomId, guestId, checkInDate, checkOutDate);
    const guest = guests.find(g => g.id === guestId);
    setRooms(rooms.map(r => 
      r.id === roomId 
        ? { ...r, status: 'occupied', currentGuests: [guest.firstName + ' ' + guest.lastName], checkInDate, checkOutDate }
        : r
    ));
    return result;
  };

  const checkOutGuest = async (roomId) => {
    const result = await api.roomAPI.checkOutGuest(roomId);
    setRooms(rooms.map(r => 
      r.id === roomId 
        ? { ...r, status: 'available', currentGuests: [], checkInDate: null, checkOutDate: null }
        : r
    ));
    return result;
  };

  // Task operations
  const addTask = async (taskData) => {
    const newTask = await api.taskAPI.createTask(taskData);
    setTasks([...tasks, newTask]);
    logActivity({
      action: `Task created: ${newTask.title}`,
      room: newTask.room
    });
    return newTask;
  };

  const updateTask = async (id, taskData) => {
    const updatedTask = await api.taskAPI.updateTask(id, taskData);
    setTasks(tasks.map(t => t.id === id ? updatedTask : t));
    return updatedTask;
  };

  const updateTaskStatus = async (id, status) => {
    const result = await api.taskAPI.updateTaskStatus(id, status);
    setTasks(tasks.map(t => t.id === id ? { ...t, status } : t));
    const task = tasks.find(t => t.id === id);
    logActivity({
      action: `Task "${task.title}" moved to ${status}`,
      room: task.room
    });
    return result;
  };

  const assignTask = async (id, assigneeId) => {
    const result = await api.taskAPI.assignTask(id, assigneeId);
    const assignee = guests.find(g => g.id === assigneeId);
    setTasks(tasks.map(t => 
      t.id === id 
        ? { ...t, assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : null }
        : t
    ));
    return result;
  };

  // Conversation operations
  const sendMessage = async (conversationId, message) => {
    const newMessage = await api.conversationAPI.sendMessage(conversationId, message);
    setConversations(conversations.map(c => 
      c.id === conversationId 
        ? { 
            ...c, 
            messages: [...(c.messages || []), newMessage],
            lastMessage: message,
            unread: false
          }
        : c
    ));
    return newMessage;
  };

  const markConversationAsRead = async (conversationId) => {
    await api.conversationAPI.markAsRead(conversationId);
    setConversations(conversations.map(c => 
      c.id === conversationId ? { ...c, unread: false } : c
    ));
  };

  // Activity operations
  const logActivity = async (activityData) => {
    const newActivity = await api.activityAPI.logActivity(activityData);
    setActivities([newActivity, ...activities.slice(0, 9)]); // Keep last 10
    return newActivity;
  };

  const value = {
    // Data
    guests,
    rooms,
    tasks,
    conversations,
    activities,
    dashboardStats,
    loading,

    // Operations
    addGuest,
    updateGuest,
    deleteGuest,
    updateRoomStatus,
    checkInGuest,
    checkOutGuest,
    addTask,
    updateTask,
    updateTaskStatus,
    assignTask,
    sendMessage,
    markConversationAsRead,
    logActivity,
    refreshData: loadAllData
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};