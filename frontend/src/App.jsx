// frontend/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { LanguageProvider } from './contexts/LanguageContext'; 
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/Auth/LoginPage.jsx';
import SystemOwner from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';
import SystemInitializer from './components/SystemInitializer/SystemInitializer.jsx';
import { useAuth } from './contexts/AuthContext';

// Import Manager pages
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import FloorPlan from './pages/Manager/Floor/FloorPlan.jsx';
import Rentals from './pages/Manager/Rentals.jsx';
import Clients from './pages/Manager/Client/Clients.jsx';
import Reports from './pages/Manager/Reports.jsx';
import Settings from './pages/Manager/Settings.jsx';
import Staff from './pages/Manager/Staff.jsx';

// Import Admin pages
import AdminDashboard from './pages/Manager/AdminDashboard.jsx';
import InventoryCheck from './pages/Manager/InventoryCheck.jsx';
import CreateOrders from './pages/Manager/Orders/CreateOrders.jsx'; // Import Inventory Check component
import OrderHistory from './pages/Manager/Orders/OrderHistory.jsx'; // Import Order History component
import TaskHistory from './pages/Manager/Tasks/TaskAll.jsx'; // Import Task History component

// Import other role pages
import CleanerDashboard from './pages/Cleaner/CleanerDashboard.jsx';
import TechnicalStaffDashboard from './pages/TechnicalStaff/TechnicalStaffDashboard.jsx';
import AccountantDashboard from './pages/Accountant/AccountantDashboard.jsx';
import Payroll from './pages/Accountant/Payroll.jsx';
import StorekeeperDashboard from './pages/Storekeeper/StorekeeperDashboard.jsx';

// Import shared components
import Dashboard from './components/Dashboard/Dashboard.jsx';
import Conversations from './components/Conversations/Conversations.jsx';
import Guests from './components/Guests/Guests.jsx';
import Tasks from './pages/TechnicalStaff/Tasks/Tasks.jsx';
import Rooms from './components/Rooms/Rooms.jsx';
import Employees from './components/Employees/Employees.jsx';
import MyPayroll from './components/MyPayroll/MyPayroll.jsx';

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
      return <Navigate to="/owner" replace />;
    case 'admin':
      return <Navigate to="/admin" replace />;
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
        path="/owner/*" 
        element={
          <AdminRoute>
            <Routes>
              <Route index element={<SystemOwner />} />
            </Routes>
          </AdminRoute>
        } 
      />
      
      {/* Manager routes */}
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Routes>
                <Route index element={<AdminDashboard />} />
                <Route path="floor-plan" element={<FloorPlan />} />
                <Route path="payroll" element={<Payroll />} />
                <Route path="rentals" element={<Rentals />} />
                <Route path="clients" element={<Clients />} />
                <Route path="reports" element={<Reports />} />
                <Route path="orders" element={<CreateOrders />} />
                <Route path="settings" element={<Settings />} />
                <Route path="staff" element={<Staff />} />
                <Route path="inventory" element={<InventoryCheck />} />
                <Route path="orders/history" element={<OrderHistory />} />
                <Route path="tasks/history" element={<TaskHistory />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/manager/*" 
        element={
          <ProtectedRoute allowedRoles={['manager']}>
            <Layout>
              <Routes>
                <Route index element={<ManagerDashboard />} />
                <Route path="floor-plan" element={<FloorPlan />} />
                <Route path="rentals" element={<Rentals />} />
                <Route path="clients" element={<Clients />} />
                <Route path="settings" element={<Settings />} />
                <Route path="staff" element={<Staff />} />
                <Route path="mypayroll" element={<MyPayroll />} />
                <Route path="orders/history" element={<OrderHistory />} />
                <Route path="tasks/history" element={<TaskHistory />} />
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
                <Route path="mypayroll" element={<MyPayroll />} />
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
                <Route path="mypayroll" element={<MyPayroll />} />
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
                <Route path="payroll" element={<Payroll />} />
                <Route path="clients" element={<Clients />} />
                <Route path="reports" element={<Reports />} />
                <Route path="staff" element={<Staff />} />
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
                <Route path="mypayroll" element={<MyPayroll />} />
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