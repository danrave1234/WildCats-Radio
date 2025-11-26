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

export const ENV = {
  // Development mode flag
  IS_DEV: isDevelopment,
  
  // API Base URL (with /api suffix)
  API_BASE_URL: isDevelopment
    ? `http://${LOCAL_IP}:${LOCAL_PORT}/api`
    : `${PRODUCTION_API_URL}/api`,
  
  // Backend Base URL (without /api suffix)
  BACKEND_BASE_URL: isDevelopment
    ? `http://${LOCAL_IP}:${LOCAL_PORT}`
    : PRODUCTION_API_URL,
  
  // Icecast streaming server
  ICECAST_SERVER_URL: 'https://icecast.software',
  STREAM_URL: 'https://icecast.software/live.mp3',
  
  // Network configuration
  NETWORK_TIMEOUT: 30000, // 30 seconds (increased for slow backend)
  MAX_RETRIES: 3,
  
  // Debug logging
  ENABLE_LOGS: isDevelopment,
};

// Helper function to get current environment info
export const getEnvironmentInfo = () => ({
  mode: ENV.IS_DEV ? 'Development' : 'Production',
  apiUrl: ENV.API_BASE_URL,
  backendUrl: ENV.BACKEND_BASE_URL,
  logsEnabled: ENV.ENABLE_LOGS,
});

// Log environment on app start (development only)
if (ENV.IS_DEV && ENV.ENABLE_LOGS) {
  console.log('🌍 Environment Configuration:', getEnvironmentInfo());
}

export default ENV;

