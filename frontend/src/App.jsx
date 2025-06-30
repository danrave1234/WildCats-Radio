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
const Notifications = lazy(() => import('./pages/Notifications'));
const BroadcastHistory = lazy(() => import('./pages/BroadcastHistory'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
import { AuthProvider, useAuth } from './context/AuthContext';
import { BroadcastHistoryProvider } from './context/BroadcastHistoryContext';
import { AnalyticsProvider } from './context/AnalyticsContext';
import { StreamingProvider } from './context/StreamingContext';
import './App.css';
import './styles/custom-scrollbar.css';
import {NotificationProvider} from "./context/NotificationContext.jsx";

import { Spinner } from './components/ui/spinner';

// Loading component
const LoadingFallback = () => (
  <div className="flex flex-col justify-center items-center h-[calc(100vh-64px)] gap-4">
    <Spinner variant="primary" size="lg" />
    <span className="text-maroon-700 dark:text-maroon-300 font-medium">Loading dashboard...</span>
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

      <Route path="/notifications" element={
        <Layout>
          <ProtectedRoute 
            element={<Notifications />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/broadcast-history" element={
        <Layout>
          <ProtectedRoute 
            element={<BroadcastHistory />} 
            allowedRoles={['DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/analytics" element={
        <Layout>
          <ProtectedRoute 
            element={<AnalyticsDashboard />} 
            allowedRoles={['DJ', 'ADMIN']} 
          />
        </Layout>
      } />
      
      <Route path="/broadcast/:id" element={
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <ListenerDashboard />
          </Suspense>
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
          <StreamingProvider>
            <BroadcastHistoryProvider>
              <AnalyticsProvider>
                <AppRoutes />
              </AnalyticsProvider>
            </BroadcastHistoryProvider>
          </StreamingProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
