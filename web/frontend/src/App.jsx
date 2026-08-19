import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/Auth/AdminLogin';
import ForgotPassword from './pages/Auth/ForgotPassword';
import OTP from './pages/Auth/OTP';
import ChangePassword from './pages/Auth/ChangePassword';

// Registrar Staff Pages
import Dashboard from './pages/Dashboard/Dashboard';
import Requests from './pages/Requests/Requests';
import RequestDetails from './pages/Requests/RequestDetails';
import Transactions from './pages/Transactions/Transactions';
import TransactionDetails from './pages/Transactions/TransactionDetails';
import Notifications from './pages/Notifications/Notifications';
import Profile from './pages/Profile/Profile'; // This is the Edit Page
import ProfileInfo from './pages/Profile/ProfileInfo'; // This is the View Page

// Super Admin Pages
import ManageRegistrar from './pages/SuperAdmin/ManageRegistrar';
import AddRegistrar from './pages/SuperAdmin/AddRegistrar';
import RegistrarInformation from './pages/SuperAdmin/RegistrarInformation';
import ActivityLogs from './pages/SuperAdmin/ActivityLogs';

import ValidationLanding from './pages/Validation/Landing';
import ValidationResults from './pages/Validation/Validation';

import StudentManagement from './pages/Users/StudentManagement';

// Blockchain Pages
import Blockchain from './pages/Blockchain/Blockchain';
import MyTransactions from './pages/Blockchain/MyTransactions';
import VerifyTransactions from './pages/Blockchain/VerifyTransactions';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  if (userRole !== 'super admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes (public) */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/otp" element={<OTP />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Main Dashboard - Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        
        {/* Requests Management - Protected */}
        <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/requests/:id" element={<ProtectedRoute><RequestDetails /></ProtectedRoute>} />

        
        {/* Transaction History - Protected */}
        <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        <Route path="/transactions/:id" element={<ProtectedRoute><TransactionDetails /></ProtectedRoute>} />
        
        {/* Notifications - Protected */}
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

        {/* Blockchain - Protected */}
        <Route path="/blockchain" element={<ProtectedRoute><Blockchain /></ProtectedRoute>} />
        <Route path="/blockchain/my-transactions" element={<ProtectedRoute><MyTransactions /></ProtectedRoute>} />
        <Route path="/blockchain/verify" element={<ProtectedRoute><VerifyTransactions /></ProtectedRoute>} />

        {/* Profile Management - Protected */}
        <Route path="/profile/info" element={<ProtectedRoute><ProfileInfo /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Super Admin / Registrar Management - Protected */}
        <Route path="/manage-registrar" element={<SuperAdminRoute><ManageRegistrar /></SuperAdminRoute>} />
        <Route path="/manage-registrar/add" element={<SuperAdminRoute><AddRegistrar /></SuperAdminRoute>} />
        <Route path="/manage-registrar/details/:id" element={<SuperAdminRoute><RegistrarInformation /></SuperAdminRoute>} />
        <Route path="/manage-users" element={<SuperAdminRoute><StudentManagement /></SuperAdminRoute>} />
        
        <Route path="/activity-logs" element={<SuperAdminRoute><ActivityLogs /></SuperAdminRoute>} />

        {/* Public Validation Page (QR Scans go straight to /verify/results) */}
        <Route path="/verify" element={<Navigate to="/" replace />} />
        <Route path="/verify/results" element={<ValidationResults />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

