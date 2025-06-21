/**
 * Central configuration file for the WildCats Radio application
 * 
 * This file contains configuration settings that can be changed in one place
 * and will affect the entire application.
 * 
 * Environment Detection:
 * - Automatically detects if running locally (localhost/127.0.0.1) or deployed
 * - Can be overridden by setting REACT_APP_FORCE_LOCAL=true or REACT_APP_FORCE_DEPLOYED=true
 */

/**
 * Helper function to safely access environment variables
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if env var is not found
 * @returns {string} - Environment variable value or default
 */
const getEnvVar = (key, defaultValue = '') => {
  // eslint-disable-next-line no-undef
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    // eslint-disable-next-line no-undef
    return process.env[key];
  }
  return defaultValue;
};

/**
 * Environment Detection Logic
 * Automatically determines if we're running locally or in production
 */
const detectEnvironment = () => {
  // Check for environment variable overrides first
  if (getEnvVar('REACT_APP_FORCE_LOCAL') === 'true') {
    return 'local';
  }
  if (getEnvVar('REACT_APP_FORCE_DEPLOYED') === 'true') {
    return 'deployed';
  }

  // Auto-detect based on hostname
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || 
                  hostname === '127.0.0.1' || 
                  hostname.startsWith('192.168.') ||
                  hostname.startsWith('10.') ||
                  hostname.includes('local');

  return isLocal ? 'local' : 'deployed';
};

// Environment detection
const environment = detectEnvironment();
export const isLocalEnvironment = environment === 'local';
export const isDeployedEnvironment = environment === 'deployed';

// Legacy export for backward compatibility
export const useLocalBackend = isLocalEnvironment;

/**
 * Environment-specific configuration
 * Centralized place to change all backend URLs
 */
const environments = {
  local: {
    apiBaseUrl: 'http://localhost:8080',
    wsBaseUrl: 'ws://localhost:8080',
    sockJsBaseUrl: 'http://localhost:8080',
  },
  deployed: {
    apiBaseUrl: 'https://api.wildcat-radio.live',
    wsBaseUrl: 'wss://api.wildcat-radio.live',
    sockJsBaseUrl: 'https://api.wildcat-radio.live',
  }
};

// Get current environment configuration
const currentEnvConfig = environments[environment];

// Export comprehensive configuration
export const config = {
  // Environment info
  environment,
  isLocal: isLocalEnvironment,
  isDeployed: isDeployedEnvironment,

  // Base URLs with automatic environment detection
  apiBaseUrl: getEnvVar('REACT_APP_API_BASE_URL') || currentEnvConfig.apiBaseUrl,
  wsBaseUrl: getEnvVar('REACT_APP_WS_BASE_URL') || currentEnvConfig.wsBaseUrl,
  sockJsBaseUrl: getEnvVar('REACT_APP_SOCKJS_BASE_URL') || currentEnvConfig.sockJsBaseUrl,

  // Icecast URL (external service, same for all environments)
  icecastUrl: getEnvVar('REACT_APP_ICECAST_URL') || 'https://icecast.software/live.ogg',

  // API Configuration
  apiTimeout: isLocalEnvironment ? 10000 : 30000, // 10s local, 30s deployed
  maxRetries: isLocalEnvironment ? 2 : 5, // Fewer retries locally
  retryDelay: isLocalEnvironment ? 1000 : 2000, // 1s local, 2s deployed

  // WebSocket Configuration
  wsReconnectDelay: isLocalEnvironment ? 3000 : 5000,
  wsReconnectJitter: isLocalEnvironment ? 1000 : 2000,
  wsHeartbeatInterval: isLocalEnvironment ? 10000 : 25000,
  wsMaxReconnectAttempts: isLocalEnvironment ? 5 : 10,

  // Audio/Media Configuration
  defaultVolume: 80,
  audioBufferSize: isLocalEnvironment ? 1024 : 2048,

  // UI Configuration
  notificationTimeout: 5000,
  loadingTimeout: isLocalEnvironment ? 5000 : 15000,

  // Debug Configuration
  enableDebugLogs: isLocalEnvironment || getEnvVar('REACT_APP_DEBUG') === 'true',
  enableVerboseLogs: getEnvVar('REACT_APP_VERBOSE') === 'true',
};

/**
 * Utility functions for configuration management
 */
export const configUtils = {
  /**
   * Get the full API URL for an endpoint
   * @param {string} endpoint - The API endpoint (e.g., '/api/auth/login')
   * @returns {string} - Full URL
   */
  getApiUrl: (endpoint) => {
    const baseUrl = config.apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  },

  /**
   * Get the WebSocket URL for an endpoint
   * @param {string} endpoint - The WebSocket endpoint (e.g., '/ws-radio')
   * @returns {string} - Full WebSocket URL
   */
  getWsUrl: (endpoint) => {
    const baseUrl = config.wsBaseUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  },

  /**
   * Get the SockJS URL for an endpoint
   * @param {string} endpoint - The SockJS endpoint (e.g., '/ws-radio')
   * @returns {string} - Full SockJS URL
   */
  getSockJsUrl: (endpoint) => {
    const baseUrl = config.sockJsBaseUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  },

  /**
   * Log current configuration (useful for debugging)
   */
  logConfig: () => {
    console.group('🔧 WildCats Radio Configuration');
    console.log('Environment:', config.environment);
    console.log('API Base URL:', config.apiBaseUrl);
    console.log('WebSocket Base URL:', config.wsBaseUrl);
    console.log('SockJS Base URL:', config.sockJsBaseUrl);
    console.log('Icecast URL:', config.icecastUrl);
    console.log('Debug Logs Enabled:', config.enableDebugLogs);
    console.groupEnd();
  }
};

// Log configuration on load (only in development)
if (config.enableDebugLogs) {
  configUtils.logConfig();
}
