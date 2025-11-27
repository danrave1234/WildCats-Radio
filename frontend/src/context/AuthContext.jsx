import { createContext, useState, useEffect, useContext } from 'react';
import { authService, broadcastService } from '../services/api/index.js';
import authStorage from '../services/authStorage.js';
import { createLogger } from '../services/logger.js';
import { config } from '../config.js';

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

  // Check authentication status with optimistic restoration
  // PHASE 1: IMMEDIATE OPTIMISTIC RESTORE (prevents logout during page refresh)
  // PHASE 2: BACKGROUND VERIFICATION (non-blocking server check)
  const checkAuthStatus = async () => {
    const logger = createLogger('AuthContext');
    const isLocalhost = window.location.hostname === 'localhost';

    // Check if optimistic authentication is enabled
    if (!config.enableOptimisticAuth) {
      logger.info('AuthContext: Optimistic authentication disabled, using server-only auth');
      await checkServerAuthOnly();
      return;
    }

    // PHASE 1: IMMEDIATE OPTIMISTIC RESTORE
    // Load stored user immediately to prevent UI flicker and logout during refresh
    try {
      const storedUser = await authStorage.getUser();
      const sessionValid = await authStorage.isSessionValid(config.authSessionTimeoutHours * 60 * 60 * 1000); // Configurable hours

      if (storedUser && sessionValid) {
        logger.info('AuthContext: Optimistic restore successful for user:', storedUser.email);
        setCurrentUser(storedUser); // Show logged-in UI immediately
        setLoading(false); // Allow UI to render
      } else if (storedUser && !sessionValid) {
        logger.info('AuthContext: Stored session expired, clearing data');
        await authStorage.clear();
        setCurrentUser(null);
        setLoading(false);
        return null;
      } else {
        // No stored session
        setCurrentUser(null);
        setLoading(false);
      }
    } catch (storageError) {
      logger.warn('AuthContext: Storage access failed, falling back to server check:', storageError);
      setCurrentUser(null);
      setLoading(false);
    }

    // PHASE 2: BACKGROUND VERIFICATION (non-blocking)
    // Verify with server without blocking UI or causing logout
    try {
      const timeoutMs = isLocalhost ? 10000 : 2000; // More generous timeouts
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Auth verification timeout')), timeoutMs);
      });

      const authPromise = authService.getCurrentUser();
      const response = await Promise.race([authPromise, timeoutPromise]);

      const serverUser = response.data;

      // Update with verified server data
      const currentUserId = currentUser?.id;
      if (serverUser.id !== currentUserId) {
        logger.info('AuthContext: Server verification updated user:', serverUser.email);
        setCurrentUser(serverUser);
        await authStorage.setUser(serverUser); // Persist verified user
      }

      setError(null);
      return serverUser;

    } catch (verificationError) {
      // Handle verification failures gracefully
      const isAuthFailure = verificationError.response?.status === 401 ||
                           verificationError.response?.status === 403;

      if (isAuthFailure) {
        logger.warn('AuthContext: Server verification failed - user not authenticated');
        setCurrentUser(null);
        await authStorage.clear();
        return null;
      }

      // For network/server issues, keep optimistic state if we have one
      const hasOptimisticState = !!currentUser;
      if (hasOptimisticState) {
        logger.info('AuthContext: Keeping optimistic state due to network/server issue');
      } else {
        logger.info('AuthContext: No optimistic state available');
      }

      // Only set error for non-timeout, non-network errors
      if (verificationError.response?.status &&
          verificationError.response.status !== 401 &&
          verificationError.response.status !== 403) {
        setError('Unable to verify authentication status. Some features may be limited.');
      }

      return currentUser; // Return current (optimistic) user if available
    }
  };

  // Fallback authentication check when optimistic auth is disabled
  const checkServerAuthOnly = async () => {
    const logger = createLogger('AuthContext');
    const isLocalhost = window.location.hostname === 'localhost';

    try {
      setLoading(true);
      setError(null);

      const timeoutMs = isLocalhost ? 10000 : 2000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Auth verification timeout')), timeoutMs);
      });

      const authPromise = authService.getCurrentUser();
      const response = await Promise.race([authPromise, timeoutPromise]);

      const serverUser = response.data;
      setCurrentUser(serverUser);
      setLoading(false);

      logger.info('AuthContext: Server-only auth successful for user:', serverUser.email);
      return serverUser;

    } catch (verificationError) {
      const isAuthFailure = verificationError.response?.status === 401 ||
                           verificationError.response?.status === 403;

      if (isAuthFailure) {
        logger.warn('AuthContext: Server-only auth failed - user not authenticated');
        setCurrentUser(null);
        await authStorage.clear();
      } else {
        setError('Unable to verify authentication status. Some features may be limited.');
      }

      setLoading(false);
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
      // Persist user for optimistic auth and update state
      await authStorage.setUser(user);
      setCurrentUser(user);

      return user;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handover login function - for account switching during DJ handover (shared PC setup)
  const handoverLogin = async (handoverData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.handoverLogin(handoverData);
      const { user } = response.data;

      // Persist user for optimistic auth and update state
      await authStorage.setUser(user);
      setCurrentUser(user);

      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Account switch failed');
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

  // Logout function - clears all authentication data with proper error handling
  const logout = async () => {
      const logger = createLogger('AuthContext');
      
      try {
          // Pre-check: If user is a DJ, check if they're actively broadcasting
          if (currentUser?.role === 'DJ') {
              try {
                  const res = await broadcastService.getActiveBroadcast();
                  const activeBroadcast = res.data;
                  if (activeBroadcast?.status === 'LIVE' && 
                      (activeBroadcast?.currentActiveDJ?.id === currentUser?.id || 
                       activeBroadcast?.startedBy?.id === currentUser?.id)) {
                      const msg = 'Cannot logout while actively broadcasting. Please hand over the broadcast first.';
                      logger.warn('Logout blocked: Active DJ attempted to logout', {
                          userId: currentUser.id,
                          broadcastId: activeBroadcast.id,
                          broadcastTitle: activeBroadcast.title
                      });
                      setError(msg);
                      throw new Error(msg);
                  }
              } catch (checkErr) {
                  // Re-throw if it's our custom "Cannot logout" error
                  if (checkErr.message && checkErr.message.includes('Cannot logout')) {
                      throw checkErr;
                  }
                  // For network errors during pre-check, log but continue (backend will validate)
                  logger.warn('Pre-check failed during logout, proceeding to backend validation', checkErr);
              }
          }
          
          // Attempt logout via backend
          try {
              const response = await authService.logout();
              
              // Check if backend returned an error response
              if (response.data && response.data.success === false) {
                  const errorMsg = response.data.error || 'Logout failed';
                  const errorCode = response.data.code || 'LOGOUT_FAILED';
                  
                  logger.warn('Logout rejected by backend', {
                      code: errorCode,
                      message: errorMsg,
                      userId: currentUser?.id
                  });
                  
                  // Handle specific error codes
                  if (errorCode === 'LOGOUT_FORBIDDEN_ACTIVE_DJ' || 
                      errorCode === 'UNAUTHORIZED' ||
                      errorCode === 'FORBIDDEN') {
                      setError(errorMsg);
                      throw new Error(errorMsg);
                  }
                  
                  // For other backend errors, still show error but allow cleanup
                  setError(errorMsg);
                  throw new Error(errorMsg);
              }
              
              // Successful logout
              logger.info('Logout successful', { userId: currentUser?.id });
              setCurrentUser(null);
              setError(null);
              await authStorage.clear();
              
          } catch (logoutErr) {
              // Handle HTTP error responses
              if (logoutErr.response) {
                  const status = logoutErr.response.status;
                  const errorData = logoutErr.response.data;
                  
                  // 403 Forbidden - Active DJ cannot logout
                  if (status === 403) {
                      const errorMsg = errorData?.error || 
                                     'Cannot logout while actively broadcasting. Please hand over the broadcast first.';
                      logger.warn('Logout forbidden by backend', {
                          status,
                          code: errorData?.code,
                          userId: currentUser?.id
                      });
                      setError(errorMsg);
                      throw new Error(errorMsg);
                  }
                  
                  // 401 Unauthorized - No active session
                  if (status === 401) {
                      const errorMsg = errorData?.error || 'Unauthorized: No active session found';
                      logger.warn('Logout failed: Unauthorized', { userId: currentUser?.id });
                      // Still allow cleanup for unauthorized (session already invalid)
                      setCurrentUser(null);
                      setError(null);
                      await authStorage.clear();
                      return;
                  }
                  
                  // 404 Not Found - User not found
                  if (status === 404) {
                      const errorMsg = errorData?.error || 'User not found';
                      logger.warn('Logout failed: User not found', { userId: currentUser?.id });
                      // Still allow cleanup
                      setCurrentUser(null);
                      setError(null);
                      await authStorage.clear();
                      return;
                  }
                  
                  // 500 Internal Server Error
                  if (status === 500) {
                      const errorMsg = errorData?.error || 'An unexpected error occurred during logout';
                      logger.error('Logout failed: Server error', {
                          status,
                          userId: currentUser?.id,
                          error: logoutErr
                      });
                      setError(errorMsg);
                      // Force cleanup even on server error
                      setCurrentUser(null);
                      await authStorage.clear();
                      throw new Error(errorMsg);
                  }
                  
                  // Other HTTP errors
                  const errorMsg = errorData?.error || 'Logout failed. Please try again.';
                  logger.warn('Logout failed with HTTP error', {
                      status,
                      code: errorData?.code,
                      userId: currentUser?.id
                  });
                  setError(errorMsg);
                  // Force cleanup
                  setCurrentUser(null);
                  await authStorage.clear();
                  throw new Error(errorMsg);
              }
              
              // Handle non-HTTP errors (network errors, etc.)
              if (logoutErr.message && logoutErr.message.includes('Cannot logout')) {
                  // Re-throw our custom error
                  throw logoutErr;
              }
              
              // Network errors or other issues - log but still attempt cleanup
              logger.warn('Logout encountered error, forcing cleanup', {
                  error: logoutErr.message,
                  userId: currentUser?.id
              });
              
              // Force cleanup even on error (best effort)
              setCurrentUser(null);
              setError(null);
              await authStorage.clear();
              
              // Only throw if it's a critical error we want to surface
              if (logoutErr.message && !logoutErr.message.includes('Network Error')) {
                  throw logoutErr;
              }
          }
      } catch (err) {
          // Final error handling - only throw if it's a "Cannot logout" error
          if (err.message && err.message.includes('Cannot logout')) {
              logger.warn('Logout blocked: Active DJ', { userId: currentUser?.id });
              throw err;
          }
          
          // For other errors, we've already cleaned up, just log
          logger.error('Logout error (after cleanup)', {
              error: err.message,
              userId: currentUser?.id
          });
          
          // Don't throw for non-critical errors (cleanup already done)
          if (!err.message || err.message.includes('Network Error')) {
              return;
          }
          
          throw err;
      }
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    handoverLogin,
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
