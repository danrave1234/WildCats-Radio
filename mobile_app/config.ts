/**
 * Environment Configuration for Mobile App
 * Automatically switches between development and production based on __DEV__ flag
 */

// Check if we're in development mode
// TEMPORARY: Use deployed backend to bypass network issues
const isDevelopment = false; // Set to __DEV__ for local backend
// const isDevelopment = __DEV__; // Automatically detects dev/prod mode

// Your local machine's IP address (update this to match your network)
// For Android Emulator, use '10.0.2.2' to access host machine
// For iOS Simulator, use 'localhost'
// For physical devices, use your machine's LAN IP (e.g., 192.168.1.x)
const LOCAL_IP = '10.0.2.2';
const LOCAL_PORT = '8080';

// Alternative: Use localhost for tunnel mode
// const LOCAL_IP = 'localhost';
// const LOCAL_PORT = '8080';

// Production URLs
const PRODUCTION_API_URL = 'https://api.wildcat-radio.live';

export const config = {
  // Development mode flag
  isLocal: isDevelopment,
  
  // API Base URL (with /api suffix)
  apiBaseUrl: isDevelopment
    ? `http://${LOCAL_IP}:${LOCAL_PORT}/api`
    : `${PRODUCTION_API_URL}/api`,
  
  // Backend Base URL (without /api suffix)
  backendBaseUrl: isDevelopment
    ? `http://${LOCAL_IP}:${LOCAL_PORT}`
    : PRODUCTION_API_URL,
  
  // Network configuration
  networkTimeout: 30000, // 30 seconds
  maxRetries: 3,
  
  // Debug logging
  enableLogs: isDevelopment,
};

// Helper function to get current environment info
export const getEnvironmentInfo = () => ({
  mode: config.isLocal ? 'Development' : 'Production',
  apiUrl: config.apiBaseUrl,
  backendUrl: config.backendBaseUrl,
  logsEnabled: config.enableLogs,
});

// Log environment on app start (development only)
if (config.isLocal && config.enableLogs) {
  console.log('🌍 Environment Configuration:', getEnvironmentInfo());
}

