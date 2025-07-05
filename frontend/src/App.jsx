import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { LanguageProvider } from './contexts/LanguageContext'; 
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
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

function App() {
  return (
    <LanguageProvider> 
      <AuthProvider>
        <SystemChecker>
          <DataProvider>
            <Router>
              <Routes>
                {/* Admin route */}
                <Route 
                  path="/admin" 
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  } 
                />
                
                {/* Main routes with role-based routing */}
                <Route path="/*" element={
                  <Layout>
                    <RoleBasedRouter />
                  </Layout>
                } />
              </Routes>
            </Router>
          </DataProvider>
        </SystemChecker>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;