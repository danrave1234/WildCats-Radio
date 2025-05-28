// Error handler service for the application
// This service handles specific errors that might occur due to browser extensions or security software

import { createLogger } from './logger';

const logger = createLogger('ErrorHandler');

// Function to check if an error is related to Kaspersky or other security software being blocked
export const isSecuritySoftwareBlockedError = (error) => {
  // Check if the error is related to Kaspersky being blocked
  if (error && error.message && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
    // Check if the URL contains kaspersky-labs.com or similar domains
    if (error.config && error.config.url && 
        (error.config.url.includes('kaspersky-labs.com') || 
         error.config.url.includes('kis.v2.scr'))) {
      return true;
    }
  }
  return false;
};

// Global error handler for security software related errors
export const handleSecuritySoftwareErrors = (error) => {
  if (isSecuritySoftwareBlockedError(error)) {
    // Log the error but don't propagate it to the user
    logger.info('Security software request blocked. This is normal and can be ignored.');
    // Return a resolved promise to prevent the error from propagating
    return Promise.resolve({ data: null });
  }
  // For other errors, rethrow them
  return Promise.reject(error);
};

export default {
  handleSecuritySoftwareErrors
};
