/**
 * Central configuration file for the WildCats Radio application
 * 
 * This file contains configuration settings that can be changed in one place
 * and will affect the entire application.
 */

// Set this to true to use the local backend (localhost:8080)
// Set this to false to use the deployed backend (wildcat-radio-f05d362144e6.autoidleapp.com)
export const useLocalBackend = true;

// Export other configuration settings as needed
export const config = {
  // Base URLs with explicit protocols based on the useLocalBackend setting
  apiBaseUrl: useLocalBackend 
    ? 'http://localhost:8080'
    : 'https://wildcat-radio-f05d362144e6.autoidleapp.com',
  
  // WebSocket URLs with explicit protocols
  wsBaseUrl: useLocalBackend 
    ? 'ws://localhost:8080' 
    : 'wss://wildcat-radio-f05d362144e6.autoidleapp.com',
    
  // SockJS URLs (uses HTTP/HTTPS, not WS/WSS)
  sockJsBaseUrl: useLocalBackend 
    ? 'http://localhost:8080' 
    : 'https://wildcat-radio-f05d362144e6.autoidleapp.com',
  
  // Icecast URL is always the same regardless of local/deployed backend
  icecastUrl: 'https://icecast.software/live.ogg',
  
  // Default volume settings
  defaultVolume: 80,
  
  // WebSocket reconnection settings
  wsReconnectDelay: 3000,
  wsReconnectJitter: 1000,
};