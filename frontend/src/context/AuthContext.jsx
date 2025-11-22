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
    try {
      setLoading(true);
      
      // Always call the API to verify authentication
      // In production, HttpOnly cookies are sent automatically by the browser
      // In localhost, localStorage token will be sent via Authorization header (see apiBase.js)
      // We can't check for HttpOnly cookies via JavaScript (that's the security feature)
      const response = await authService.getCurrentUser();
      const user = response.data;
      setCurrentUser(user);
      setError(null);
      return user; // Return user so callers can use it immediately
    } catch (err) {
      // If authentication fails, clear any localStorage tokens (for localhost only)
      if (err.response?.status === 401 || err.response?.status === 403) {
        if (window.location.hostname === 'localhost') {
          localStorage.removeItem('oauth_token');
          localStorage.removeItem('oauth_userId');
          localStorage.removeItem('oauth_userRole');
        }
        setCurrentUser(null);
      } else {
        // Network or other errors - don't clear state, might be temporary
        if (err.response?.status !== 401 && err.response?.status !== 403) {
          setError('Failed to verify authentication status.');
        }
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
