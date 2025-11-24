import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
// Use lazy loading for page components
const ListenerDashboard = lazy(() => import('./pages/ListenerDashboard'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Profile = lazy(() => import('./pages/Profile'));
const DJDashboard = lazy(() => import('./pages/DJDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ModeratorDashboard = lazy(() => import('./pages/ModeratorDashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const BroadcastHistory = lazy(() => import('./pages/BroadcastHistory'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const DJAnalyticsDashboard = lazy(() => import('./pages/DJAnalyticsDashboard'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Contact = lazy(() => import('./pages/Contact'));
const Announcements = lazy(() => import('./pages/Announcements'));
const AnnouncementForm = lazy(() => import('./pages/AnnouncementForm'));
import { AuthProvider, useAuth } from './context/AuthContext';
import { BroadcastHistoryProvider } from './context/BroadcastHistoryContext';
import { AnalyticsProvider } from './context/AnalyticsContext';
import { StreamingProvider } from './context/StreamingContext';
import './styles/custom-scrollbar.css';
import {NotificationProvider} from "./context/NotificationContext.jsx";
import { ThemeProvider } from './context/ThemeContext.jsx';

import { Spinner } from './components/ui/spinner';
import ErrorBoundary from './components/ErrorBoundary';

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

// Analytics Router component - routes to appropriate analytics page based on role
const AnalyticsRouter = () => {
  const { currentUser } = useAuth();
  
  if (currentUser?.role === 'DJ') {
    return (
      <ProtectedRoute 
        element={<DJAnalyticsDashboard />} 
        allowedRoles={['DJ']} 
      />
    );
  }
  
  return (
    <ProtectedRoute 
      element={<AnalyticsDashboard />} 
      allowedRoles={['ADMIN', 'MODERATOR']} 
    />
  );
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
    } else if (currentUser?.role === 'MODERATOR') {
      return <Navigate to="/moderator" replace />;
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

// OAuth Callback Handler component - handles redirect from backend after OAuth login
const OAuthCallback = () => {
  const { checkAuthStatus, currentUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleOAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const oauthStatus = urlParams.get('oauth');
        const oauthError = urlParams.get('oauth_error');
        const errorReason = urlParams.get('reason');
        
        // Handle OAuth errors
        if (oauthError) {
          const errorMessage = errorReason 
            ? `OAuth authentication failed: ${decodeURIComponent(errorReason)}`
            : 'OAuth authentication failed. Please try again.';
          setError(errorMessage);
          setTimeout(() => {
            navigate('/login?oauth_error=' + encodeURIComponent(errorMessage), { replace: true });
          }, 2000);
          return;
        }
        
        if (oauthStatus === 'success') {
          // For localhost: extract token from URL and store it (cookies don't work across ports)
          if (window.location.hostname === 'localhost') {
            const token = urlParams.get('token');
            const userId = urlParams.get('userId');
            const userRole = urlParams.get('userRole');
            
            if (token) {
              localStorage.setItem('oauth_token', token);
              if (userId) localStorage.setItem('oauth_userId', userId);
              if (userRole) localStorage.setItem('oauth_userRole', userRole);
              
              // Clean up URL
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete('token');
              newUrl.searchParams.delete('userId');
              newUrl.searchParams.delete('userRole');
              window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
            }
          }
          
          // Check auth status - this will fetch the user from backend
          // In production: uses HttpOnly cookies automatically
          // In localhost: uses Authorization header from localStorage token
          const user = await checkAuthStatus();
          
          // Navigate based on user role
          const userRole = user?.role || (window.location.hostname === 'localhost' ? localStorage.getItem('oauth_userRole') : null);
          
          if (userRole === 'DJ') {
            navigate('/dj-dashboard', { replace: true });
          } else if (userRole === 'ADMIN') {
            navigate('/admin', { replace: true });
          } else if (userRole === 'MODERATOR') {
            navigate('/moderator', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } else if (oauthStatus === 'error') {
          setError('OAuth authentication failed. Please try again.');
          setTimeout(() => {
            navigate('/login?error=oauth_failed', { replace: true });
          }, 2000);
        } else {
          await checkAuthStatus();
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
        setTimeout(() => {
          navigate('/login?oauth_error=' + encodeURIComponent('An unexpected error occurred'), { replace: true });
        }, 2000);
      }
    };

    handleOAuthCallback();
  }, [navigate, checkAuthStatus, currentUser]);

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <div className="text-red-500 text-lg font-semibold">{error}</div>
        <div className="text-muted-foreground">Redirecting to login...</div>
      </div>
    );
  }

  return <LoadingFallback />;
};

// App Routes component
const AppRoutes = () => {
  const { isAuthenticated, currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/oauth-callback" element={<OAuthCallback />} />
      
      <Route path="/login" element={
        isAuthenticated ? (
          <Navigate to={
            currentUser?.role === 'DJ'
              ? '/dj-dashboard'
              : currentUser?.role === 'ADMIN'
                ? '/admin'
                : currentUser?.role === 'MODERATOR'
                  ? '/moderator'
                  : '/dashboard'
          } replace />
        ) : (
          <Login />
        )
      } />

      <Route path="/register" element={
        isAuthenticated ? (
          <Navigate to={
            currentUser?.role === 'DJ'
              ? '/dj-dashboard'
              : currentUser?.role === 'ADMIN'
                ? '/admin'
                : currentUser?.role === 'MODERATOR'
                  ? '/moderator'
                  : '/dashboard'
          } replace />
        ) : (
          <Register />
        )
      } />

      <Route path="/" element={
        <Layout>
          {isAuthenticated ? (
            <Navigate to={
              currentUser?.role === 'DJ'
                ? '/dj-dashboard'
                : currentUser?.role === 'ADMIN'
                  ? '/admin'
                  : currentUser?.role === 'MODERATOR'
                    ? '/moderator'
                    : '/dashboard'
            } replace />
          ) : (
            (() => {
              // Check for OAuth callback
              const urlParams = new URLSearchParams(window.location.search);
              if (urlParams.get('oauth')) {
                return <OAuthCallback />;
              }
              return (
                <Suspense fallback={<LoadingFallback />}>
                  <ListenerDashboard />
                </Suspense>
              );
            })()
          )}
        </Layout>
      } />

      <Route path="/dashboard" element={
        <Layout>
          <ProtectedRoute 
            element={<ListenerDashboard />}
            allowedRoles={['LISTENER','MODERATOR','ADMIN','DJ']} 
          />
        </Layout>
      } />

      <Route path="/dj-dashboard" element={
        <Layout>
          <ProtectedRoute 
            element={
              <ErrorBoundary>
                <DJDashboard />
              </ErrorBoundary>
            } 
            allowedRoles={['DJ', 'ADMIN', 'MODERATOR']} 
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

      <Route path="/moderator" element={
        <Layout>
          <ProtectedRoute 
            element={<ModeratorDashboard />} 
            allowedRoles={['MODERATOR','ADMIN']} 
          />
        </Layout>
      } />

      <Route path="/schedule" element={
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <Schedule />
          </Suspense>
        </Layout>
      } />

      <Route path="/profile" element={
        <Layout>
          <ProtectedRoute 
            element={<Profile />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN', 'MODERATOR']} 
          />
        </Layout>
      } />

      <Route path="/settings" element={
        <Layout>
          <ProtectedRoute 
            element={<Settings />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN', 'MODERATOR']} 
          />
        </Layout>
      } />

      <Route path="/notifications" element={
        <Layout>
          <ProtectedRoute 
            element={<Notifications />} 
            allowedRoles={['LISTENER', 'DJ', 'ADMIN', 'MODERATOR']} 
          />
        </Layout>
      } />

      <Route path="/broadcast-history" element={
        <Layout>
          <ProtectedRoute 
            element={<BroadcastHistory />} 
            allowedRoles={['DJ', 'ADMIN', 'MODERATOR']} 
          />
        </Layout>
      } />

      <Route path="/analytics" element={
        <Layout>
          <AnalyticsRouter />
        </Layout>
      } />

      {/* Public policy/contact pages */}
      <Route path="/privacy-policy" element={
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <PrivacyPolicy />
          </Suspense>
        </Layout>
      } />

      <Route path="/announcements" element={
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <Announcements />
          </Suspense>
        </Layout>
      } />

      <Route path="/terms-of-service" element={
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <TermsOfService />
          </Suspense>
        </Layout>
      } />

      <Route path="/contact" element={
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <Contact />
          </Suspense>
        </Layout>
      } />

      <Route path="/announcements/create" element={
        <Layout>
          <ProtectedRoute 
            element={<AnnouncementForm />} 
            allowedRoles={['DJ', 'MODERATOR', 'ADMIN']} 
          />
        </Layout>
      } />

      <Route path="/announcements/edit/:id" element={
        <Layout>
          <ProtectedRoute 
            element={<AnnouncementForm />} 
            allowedRoles={['DJ', 'MODERATOR', 'ADMIN']} 
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
          <ThemeProvider>
            <StreamingProvider>
              <BroadcastHistoryProvider>
                <AnalyticsProvider>
                  <AppRoutes />
                </AnalyticsProvider>
              </BroadcastHistoryProvider>
            </StreamingProvider>
          </ThemeProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
