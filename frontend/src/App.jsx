// frontend/src/App.jsx
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { LanguageProvider } from './contexts/LanguageContext'; 
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/LoginModal.jsx';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';
import SystemInitializer from './components/SystemInitializer/SystemInitializer.jsx';
import RoleBasedRouter from './utils/RoleBasedRouter';
import { useAuth } from './contexts/AuthContext';
import './App.css';

// Component for system status checking
const SystemChecker = ({ children }) => {
  const { systemInitialized, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="system-loading">
        <div className="loading-spinner"></div>
        <p>Проверка системы...</p>
      </div>
    );
  }
  
  if (systemInitialized === false) {
    return <SystemInitializer />;
  }
  
  return children;
};

// Admin route wrapper
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  
  if (user && user.role === 'system_owner') {
    return children;
  }
  
  return <AdminLogin />;
};

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }
  
  if (!user) {
    return <Login />;
  }
  
  return children;
};

// Main app routing component
const AppRoutes = () => {
  const { user } = useAuth();
  
  return (
    <Routes>
      {/* Admin route */}
      <Route 
        path="/admin/*" 
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        } 
      />
      
      {/* Public login route */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" replace /> : <Login />} 
      />
      
      {/* Protected app routes */}
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <Layout>
              <RoleBasedRouter />
            </Layout>
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

function App() {
  return (
    <LanguageProvider> 
      <AuthProvider>
        <SystemChecker>
          <DataProvider>
            <Router>
              <div className="app">
                <AppRoutes />
              </div>
            </Router>
          </DataProvider>
        </SystemChecker>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;