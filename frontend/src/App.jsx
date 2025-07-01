import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { LanguageProvider } from './contexts/LanguageContext'; 
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';
import RoleBasedRouter from './utils/RoleBasedRouter';
import { useAuth } from './contexts/AuthContext';
import './App.css';

// Простая обертка для админского роута
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
              
              {/* Основные роуты с ролевым роутингом */}
              <Route path="/*" element={
                <Layout>
                  <RoleBasedRouter />
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