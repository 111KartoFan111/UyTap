import { useAuth } from '../contexts/AuthContext';
import SystemOwner from '../components/Admin/AdminDashboard';
import ManagerDashboard from '../pages/Manager/ManagerDashboard';
import AdminDashboard from '../pages/Manager/AdminDashboard';
import CleanerDashboard from '../pages/Cleaner/CleanerDashboard';
import TechnicalStaffDashboard from '../pages/TechnicalStaff/TechnicalStaffDashboard';
import AccountantDashboard from '../pages/Accountant/AccountantDashboard';
import StorekeeperDashboard from '../pages/Storekeeper/StorekeeperDashboard';

const RoleBasedRouter = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  switch (user.role) {
    case 'system_owner':
      return <SystemOwner />;
    case 'admin':
      return <AdminDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'cleaner':
      return <CleanerDashboard />;
    case 'technical_staff':
      return <TechnicalStaffDashboard />;
    case 'accountant':
      return <AccountantDashboard />;
    case 'storekeeper':
      return <StorekeeperDashboard />;
    default:
      return <ManagerDashboard />; // fallback
  }
};

export default RoleBasedRouter;