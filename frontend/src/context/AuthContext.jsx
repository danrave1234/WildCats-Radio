import { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/api/index.js';

// Create the context
export const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Note: Tokens are now stored in secure HttpOnly cookies set by the backend
// We can no longer access them via JavaScript for security reasons
// The browser will automatically send these cookies with requests

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in by validating with the server
  const checkAuthStatus = async () => {
    // For localhost: Check localStorage immediately for instant initial state
    // This gives instant feedback before API call completes
    const isLocalhost = window.location.hostname === 'localhost';
    let optimisticUser = null;
    
    if (isLocalhost) {
      const localToken = localStorage.getItem('oauth_token');
      if (localToken) {
        // Create optimistic user object from localStorage
        // This allows UI to show logged-in state immediately
        const userId = localStorage.getItem('oauth_userId');
        const userRole = localStorage.getItem('oauth_userRole');
        optimisticUser = {
          id: userId ? parseInt(userId) : null,
          role: userRole || 'LISTENER',
          // Minimal user object - will be replaced by API response
        };
        setCurrentUser(optimisticUser);
        setLoading(false); // Show logged-in UI immediately
      } else {
        // No token, definitely not logged in
        setCurrentUser(null);
        setLoading(false); // Show logged-out UI immediately
        return null;
      }
    }

    try {
      // Make API call to verify authentication (runs in background for localhost)
      // In production, HttpOnly cookies are sent automatically by the browser
      // In localhost, localStorage token will be sent via Authorization header (see apiBase.js)
      // Use very short timeout to prevent blocking UI
      // For production, use aggressive timeout to show UI quickly
      const timeoutMs = isLocalhost ? 3000 : 1000; // 3s local, 1s prod (very fast - fail fast)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Auth check timeout')), timeoutMs);
      });
      
      const authPromise = authService.getCurrentUser();
      const response = await Promise.race([authPromise, timeoutPromise]);
      
      // Update with real user data from API
      const user = response.data;
      setCurrentUser(user);
      setError(null);
      setLoading(false);
      return user;
    } catch (err) {
      // If authentication fails, clear state
      if (err.response?.status === 401 || err.response?.status === 403 || err.message === 'Auth check timeout') {
        if (isLocalhost) {
          localStorage.removeItem('oauth_token');
          localStorage.removeItem('oauth_userId');
          localStorage.removeItem('oauth_userRole');
        }
        setCurrentUser(null);
        setLoading(false);
      } else {
        // Network or other errors - for localhost, keep optimistic state
        // For production with timeout, assume not authenticated (show login buttons)
        if (!isLocalhost || err.message === 'Auth check timeout') {
          setCurrentUser(null);
        }
        setLoading(false);
        if (err.response?.status !== 401 && err.response?.status !== 403 && err.message !== 'Auth check timeout') {
          setError('Failed to verify authentication status.');
        }
      }
      return null;
    }
  };

  useEffect(() => {
    // Initial check - start immediately
    checkAuthStatus();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const normalized = {
        ...credentials,
        email: credentials?.email ? credentials.email.trim().toLowerCase() : ''
      };

      const response = await authService.login(normalized);
      const { user } = response.data;
      
      // The secure HttpOnly cookies are now set by the backend
      // We only need to update the user state
      setCurrentUser(user);

      return user;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.register(userData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Verify email function
  const verifyEmail = async (email, code) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.verify(email, code);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Send verification code function
  const sendVerificationCode = async (email) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.sendCode(email);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification code. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update profile function
  const updateProfile = async (id, data) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.updateProfile(id, data);
      setCurrentUser(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Change password function
  const changePassword = async (id, passwordData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.changePassword(id, passwordData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function - clears all authentication data
  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      // Ignore logout errors - clear state anyway
    } finally {
      setCurrentUser(null);
      setError(null);
      localStorage.removeItem('oauth_token');
      localStorage.removeItem('oauth_userId');
      localStorage.removeItem('oauth_userRole');
    }
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    register,
    verifyEmail,
    sendVerificationCode,
    updateProfile,
    changePassword,
    logout,
    checkAuthStatus,
    isAuthenticated: !!currentUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 
