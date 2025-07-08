// frontend/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { LanguageProvider } from './contexts/LanguageContext'; 
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/Auth/LoginPage.jsx';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';
import SystemInitializer from './components/SystemInitializer/SystemInitializer.jsx';
import { useAuth } from './contexts/AuthContext';

// Import Manager pages
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import FloorPlan from './pages/Manager/Floor/FloorPlan.jsx';
import Rentals from './pages/Manager/Rentals.jsx';
import Clients from './pages/Manager/Clients.jsx';
import Reports from './pages/Manager/Reports.jsx';
import Settings from './pages/Manager/Settings.jsx';

// Import other role pages
import CleanerDashboard from './pages/Cleaner/CleanerDashboard.jsx';
import TechnicalStaffDashboard from './pages/TechnicalStaff/TechnicalStaffDashboard.jsx';
import AccountantDashboard from './pages/Accountant/AccountantDashboard.jsx';
import StorekeeperDashboard from './pages/Storekeeper/StorekeeperDashboard.jsx';

// Import shared components
import Dashboard from './components/Dashboard/Dashboard.jsx';
import Conversations from './components/Conversations/Conversations.jsx';
import Guests from './components/Guests/Guests.jsx';
import Tasks from './components/Tasks/Tasks.jsx';
import Rooms from './components/Rooms/Rooms.jsx';
import Employees from './components/Employees/Employees.jsx';

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
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
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
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Role-based home redirect
const RoleBasedHome = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'system_owner':
      return <Navigate to="/admin" replace />;
    case 'admin':
    case 'manager':
      return <Navigate to="/manager" replace />;
    case 'cleaner':
      return <Navigate to="/cleaner" replace />;
    case 'technical_staff':
      return <Navigate to="/technical" replace />;
    case 'accountant':
      return <Navigate to="/accountant" replace />;
    case 'storekeeper':
      return <Navigate to="/storekeeper" replace />;
    default:
      return <Dashboard />;
  }
};

// Main app routing component
const AppRoutes = () => {
  const { user } = useAuth();
  
  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" replace /> : <LoginPage />} 
      />
      
      {/* Admin routes */}
      <Route 
        path="/admin/*" 
        element={
          <AdminRoute>
            <Routes>
              <Route index element={<AdminDashboard />} />
            </Routes>
          </AdminRoute>
        } 
      />
      
      {/* Manager routes */}
      <Route 
        path="/manager/*" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Layout>
              <Routes>
                <Route index element={<ManagerDashboard />} />
                <Route path="floor-plan" element={<FloorPlan />} />
                <Route path="rentals" element={<Rentals />} />
                <Route path="clients" element={<Clients />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } 
      />

      {/* Cleaner routes */}
      <Route 
        path="/cleaner/*" 
        element={
          <ProtectedRoute allowedRoles={['cleaner']}>
            <Layout>
              <Routes>
                <Route index element={<CleanerDashboard />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } 
      />

      {/* Technical Staff routes */}
      <Route 
        path="/technical/*" 
        element={
          <ProtectedRoute allowedRoles={['technical_staff']}>
            <Layout>
              <Routes>
                <Route index element={<TechnicalStaffDashboard />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } 
      />

      {/* Accountant routes */}
      <Route 
        path="/accountant/*" 
        element={
          <ProtectedRoute allowedRoles={['accountant']}>
            <Layout>
              <Routes>
                <Route index element={<AccountantDashboard />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } 
      />

      {/* Storekeeper routes */}
      <Route 
        path="/storekeeper/*" 
        element={
          <ProtectedRoute allowedRoles={['storekeeper']}>
            <Layout>
              <Routes>
                <Route index element={<StorekeeperDashboard />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      {/* Shared protected routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/conversations" 
        element={
          <ProtectedRoute>
            <Layout>
              <Conversations />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/guests" 
        element={
          <ProtectedRoute>
            <Layout>
              <Guests />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/tasks" 
        element={
          <ProtectedRoute>
            <Layout>
              <Tasks />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/rooms" 
        element={
          <ProtectedRoute>
            <Layout>
              <Rooms />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/employees" 
        element={
          <ProtectedRoute>
            <Layout>
              <Employees />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      {/* Home route with role-based redirect */}
      <Route path="/" element={<RoleBasedHome />} />
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
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