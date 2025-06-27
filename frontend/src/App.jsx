import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { LanguageProvider } from './contexts/LanguageContext'; 
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';
import Dashboard from './components/Dashboard/Dashboard';
import Conversations from './components/Conversations/Conversations';
import Guests from './components/Guests/Guests';
import Tasks from './components/Tasks/Tasks';
import Rooms from './components/Rooms/Rooms';
import Employees from './components/Employees/Employees';
import { useAuth } from './contexts/AuthContext';
import './App.css';

// Простая обертка для админского роута
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  
  // Если пользователь залогинен и это system_owner - показываем админку
  if (user && user.role === 'system_owner') {
    return children;
  }
  
  // Иначе показываем форму входа
  return <AdminLogin />;
};

function App() {
  return (
    <LanguageProvider> 
      <AuthProvider>
        <DataProvider>
          <Router>
            <Routes>
              {/* Админский роут */}
              <Route 
                path="/admin" 
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                } 
              />
              
              {/* Обычные роуты с Layout */}
              <Route path="/*" element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/conversations" element={<Conversations />} />
                    <Route path="/guests" element={<Guests />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/rooms" element={<Rooms />} />
                    <Route path="/employees" element={<Employees />} />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </Router>
        </DataProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;