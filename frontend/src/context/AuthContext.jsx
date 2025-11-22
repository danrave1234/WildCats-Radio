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
    // Check if token exists before making API call
    const getCookie = (name) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
      return null;
    };
    
    const token = getCookie('token') || (window.location.hostname === 'localhost' ? localStorage.getItem('oauth_token') : null);
    
    // If no token, skip API call
    if (!token) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await authService.getCurrentUser();
      setCurrentUser(response.data);
      setError(null);
    } catch (err) {
      // If authentication fails, clear any OAuth tokens from localStorage
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('oauth_token');
        localStorage.removeItem('oauth_userId');
        localStorage.removeItem('oauth_userRole');
      }
      setCurrentUser(null);
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError('Failed to verify authentication status.');
      }
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
