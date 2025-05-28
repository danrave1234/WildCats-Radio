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
  // Base URLs are derived from the useLocalBackend setting
  // These are used internally by the application and should not be modified directly
  apiBaseUrl: useLocalBackend 
    ? 'localhost:8080/api' 
    : 'wildcat-radio-f05d362144e6.autoidleapp.com',
  
  wsBaseUrl: useLocalBackend 
    ? 'localhost:8080' 
    : 'wildcat-radio-f05d362144e6.autoidleapp.com',
  
  // Icecast URL is always the same regardless of local/deployed backend
  icecastUrl: 'wildcat-radio-f05d362144e6.autoidleapp.com:8000/live.ogg',
  
  // Default volume settings
  defaultVolume: 80,
  
  // WebSocket reconnection settings
  wsReconnectDelay: 3000,
  wsReconnectJitter: 1000,
};