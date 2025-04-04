import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ListenerDashboard from './pages/ListenerDashboard';
import Schedule from './pages/Schedule';
import Profile from './pages/Profile';
import DJDashboard from './pages/DJDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Settings from './pages/Settings';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import './App.css';

// Test credentials for different roles
const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@wildcats.edu',
    password: 'admin123',
    role: 'ADMIN'
  },
  dj: {
    email: 'dj@wildcats.edu',
    password: 'dj123',
    role: 'DJ'
  },
  listener: {
    email: 'listener@wildcats.edu',
    password: 'listener123',
    role: 'LISTENER'
  }
};

// Separate Logout component to prevent infinite loop
const Logout = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  useEffect(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);
  
  return <div className="flex justify-center items-center h-screen">Logging out...</div>;
};

// Protected route component
const ProtectedRoute = ({ element, allowedRoles }) => {
  const { isAuthenticated, currentUser, loading } = useAuth();
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(currentUser?.role)) {
    // Redirect to appropriate dashboard based on role
    if (currentUser?.role === 'DJ') {
      return <Navigate to="/dj-dashboard" replace />;
    } else if (currentUser?.role === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  return element;
};

// App Routes component
const AppRoutes = () => {
  const { isAuthenticated, currentUser } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? (
          <Navigate to={currentUser?.role === 'DJ' ? '/dj-dashboard' : currentUser?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
        ) : (
          <Login />
        )
      } />
      
      <Route path="/register" element={
        isAuthenticated ? (
          <Navigate to={currentUser?.role === 'DJ' ? '/dj-dashboard' : currentUser?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
        ) : (
          <Register />
        )
      } />
      
      <Route path="/" element={
        <Layout>
          {isAuthenticated ? (
            <Navigate to={currentUser?.role === 'DJ' ? '/dj-dashboard' : currentUser?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
          ) : (
            <Navigate to="/login" replace />
          )}
        </Layout>
      } />
      
      <Route path="/dashboard" element={
        <Layout>
          <ProtectedRoute 
            element={<ListenerDashboard />} 
            allowedRoles={['LISTENER']} 
          />
        </Layout>
      } />
      
      <Route path="/dj-dashboard" element={
        <Layout>
          <ProtectedRoute 
            element={<DJDashboard />} 
            allowedRoles={['DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/admin" element={
        <Layout>
          <ProtectedRoute 
            element={<AdminDashboard />} 
            allowedRoles={['ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/schedule" element={
        <Layout>
          <ProtectedRoute 
            element={<Schedule />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/profile" element={
        <Layout>
          <ProtectedRoute 
            element={<Profile />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/settings" element={
        <Layout>
          <ProtectedRoute 
            element={<Settings />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/logout" element={<Logout />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
