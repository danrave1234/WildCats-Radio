import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
// Use lazy loading for page components
const ListenerDashboard = lazy(() => import('./pages/ListenerDashboard'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Profile = lazy(() => import('./pages/Profile'));
const DJDashboard = lazy(() => import('./pages/DJDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Settings = lazy(() => import('./pages/Settings'));
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import './App.css';

// Loading component
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-[calc(100vh-64px)]">
    <div className="animate-pulse flex flex-col items-center">
      <div className="h-12 w-12 rounded-full bg-maroon-600"></div>
      <div className="mt-4 text-maroon-600">Loading...</div>
    </div>
  </div>
);

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
    return <LoadingFallback />;
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
  
  // Wrap the element in Suspense to handle lazy loading
  return (
    <Suspense fallback={<LoadingFallback />}>
      {element}
    </Suspense>
  );
};

// App Routes component
const AppRoutes = () => {
  const { isAuthenticated, currentUser } = useAuth();
  
  // Create key from route path to force unmounting/remounting when routes change
  const getRoutePath = () => {
    return window.location.pathname;
  };
  
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
            key={getRoutePath()}
            element={<ListenerDashboard key="dashboard" />}
            allowedRoles={['LISTENER']} 
          />
        </Layout>
      } />
      
      <Route path="/dj-dashboard" element={
        <Layout>
          <ProtectedRoute 
            key={getRoutePath()}
            element={<DJDashboard key="dj-dashboard" />} 
            allowedRoles={['DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/admin" element={
        <Layout>
          <ProtectedRoute 
            key={getRoutePath()}
            element={<AdminDashboard key="admin" />} 
            allowedRoles={['ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/schedule" element={
        <Layout>
          <ProtectedRoute 
            key={getRoutePath()}
            element={<Schedule key="schedule" />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/profile" element={
        <Layout>
          <ProtectedRoute 
            key={getRoutePath()}
            element={<Profile key="profile" />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/settings" element={
        <Layout>
          <ProtectedRoute 
            key={getRoutePath()}
            element={<Settings key="settings" />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
          />
        </Layout>
      } />

      <Route path="/notifications" element={
        <Layout>
          <ProtectedRoute 
            key={getRoutePath()}
            element={
              <Suspense fallback={<LoadingFallback />}>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <h1 className="text-2xl font-bold mb-6">Notifications</h1>
                  <div className="space-y-4">
                    {/* Notifications will be rendered here */}
                    <p className="text-gray-600 dark:text-gray-400">Your notifications will appear here.</p>
                  </div>
                </div>
              </Suspense>
            } 
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
