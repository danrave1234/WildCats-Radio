import { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/api/index.js';

// Create the context
export const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Cookie helper functions
const setCookie = (name, value, days = 7) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Strict';
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
};

const removeCookie = (name) => {
  document.cookie = name + '=; Max-Age=-99999999; path=/';
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(getCookie('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      const storedToken = getCookie('token');

      if (storedToken) {
        try {
          // Validate token by getting current user profile
          const response = await authService.getCurrentUser();
          setCurrentUser(response.data);
          setToken(storedToken);

          // Update stored user ID and role from the current user data
          setCookie('userId', response.data.id);
          setCookie('userRole', response.data.role);
        } catch (err) {
          // Token is invalid or expired
          removeCookie('token');
          removeCookie('userId');
          removeCookie('userRole');
          setToken(null);
          setCurrentUser(null);
          setError('Session expired. Please log in again.');
        }
      }

      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.login(credentials);
      const { token, user } = response.data;

      setCookie('token', token);
      setCookie('userId', user.id);
      setCookie('userRole', user.role);

      setToken(token);
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

  // Logout function
  const logout = () => {
    removeCookie('token');
    removeCookie('userId');
    removeCookie('userRole');
    removeCookie('isAuthenticated');
    setToken(null);
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    token,
    loading,
    error,
    login,
    register,
    verifyEmail,
    sendVerificationCode,
    updateProfile,
    changePassword,
    logout,
    isAuthenticated: !!token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 
