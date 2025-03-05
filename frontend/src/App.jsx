import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import ListenerDashboard from './pages/ListenerDashboard';
import Schedule from './pages/Schedule';
import Profile from './pages/Profile';
import DJDashboard from './pages/DJDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Settings from './pages/Settings';
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
const Logout = ({ onLogout }) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    onLogout();
    navigate('/login', { replace: true });
  }, [onLogout, navigate]);
  
  return <div className="flex justify-center items-center h-screen">Logging out...</div>;
};

function App() {
  // In a real app, this would come from your authentication system
  const [userRole, setUserRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate authentication check
  useEffect(() => {
    // This simulates checking if the user is logged in
    const checkAuth = async () => {
      // In a real app, you would check localStorage, cookies, or make an API call
      const storedRole = localStorage.getItem('userRole');
      const storedAuth = localStorage.getItem('isAuthenticated') === 'true';
      
      // For demo purposes, set a default role if none exists
      if (!storedRole && !storedAuth) {
        // Comment out the random role assignment for more predictable testing
        // const roles = ['LISTENER', 'DJ', 'ADMIN'];
        // const randomRole = roles[Math.floor(Math.random() * roles.length)];
        
        // localStorage.setItem('userRole', randomRole);
        // localStorage.setItem('isAuthenticated', 'true');
        
        // setUserRole(randomRole);
        // setIsAuthenticated(true);
        
        // Use no default role for more predictable login
        setUserRole(null);
        setIsAuthenticated(false);
      } else {
        setUserRole(storedRole);
        setIsAuthenticated(storedAuth);
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('isAuthenticated');
    setUserRole(null);
    setIsAuthenticated(false);
  };

  // Protected route component
  const ProtectedRoute = ({ element, allowedRoles }) => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }
    
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      // Redirect to appropriate dashboard based on role
      if (userRole === 'DJ') {
        return <Navigate to="/dj-dashboard" replace />;
      } else if (userRole === 'ADMIN') {
        return <Navigate to="/admin" replace />;
      } else {
        return <Navigate to="/dashboard" replace />;
      }
    }
    
    return element;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? (
            <Navigate to={userRole === 'DJ' ? '/dj-dashboard' : userRole === 'ADMIN' ? '/admin' : '/dashboard'} replace />
          ) : (
            <Login 
              onLogin={(role) => {
                setUserRole(role);
                setIsAuthenticated(true);
                localStorage.setItem('userRole', role);
                localStorage.setItem('isAuthenticated', 'true');
              }}
              testCredentials={TEST_CREDENTIALS}
            />
          )
        } />
        
        <Route path="/" element={
          <Layout userRole={userRole}>
            {isAuthenticated ? (
              <Navigate to={userRole === 'DJ' ? '/dj-dashboard' : userRole === 'ADMIN' ? '/admin' : '/dashboard'} replace />
            ) : (
              <Navigate to="/login" replace />
            )}
          </Layout>
        } />
        
        <Route path="/dashboard" element={
          <Layout userRole={userRole}>
            <ProtectedRoute 
              element={<ListenerDashboard />} 
              allowedRoles={['LISTENER']} 
            />
          </Layout>
        } />
        
        <Route path="/dj-dashboard" element={
          <Layout userRole={userRole}>
            <ProtectedRoute 
              element={<DJDashboard />} 
              allowedRoles={['DJ', 'ADMIN']} 
            />
          </Layout>
        } />
        
        <Route path="/admin" element={
          <Layout userRole={userRole}>
            <ProtectedRoute 
              element={<AdminDashboard />} 
              allowedRoles={['ADMIN']} 
            />
          </Layout>
        } />
        
        <Route path="/schedule" element={
          <Layout userRole={userRole}>
            <ProtectedRoute 
              element={<Schedule />} 
              allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
            />
          </Layout>
        } />
        
        <Route path="/profile" element={
          <Layout userRole={userRole}>
            <ProtectedRoute 
              element={<Profile onLogout={handleLogout} />} 
              allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
            />
          </Layout>
        } />
        
        <Route path="/settings" element={
          <Layout userRole={userRole}>
            <ProtectedRoute 
              element={<Settings />} 
              allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
            />
          </Layout>
        } />
        
        <Route path="/logout" element={<Logout onLogout={handleLogout} />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
