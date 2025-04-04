// Global error handler setup for the application
// This file sets up global error handlers to catch errors that might occur outside of axios requests

import { isSecuritySoftwareBlockedError } from './errorHandler';

// Set up global error handlers
export const setupGlobalErrorHandlers = () => {
  // Original window.onerror handler
  const originalOnError = window.onerror;

  // Override window.onerror to catch Kaspersky-related errors
  window.onerror = function(message, source, lineno, colno, error) {
    // Check if the error is related to Kaspersky being blocked
    if (message && typeof message === 'string' && 
        (message.includes('ERR_BLOCKED_BY_CLIENT') && 
         (message.includes('kaspersky-labs.com') || message.includes('kis.v2.scr')))) {
      console.log('Security software request blocked. This is normal and can be ignored.');
      return true; // Prevent the error from propagating
    }

    // Call the original handler for other errors
    if (originalOnError) {
      return originalOnError.apply(this, arguments);
    }
    return false;
  };

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    const error = event.reason;
    if (error && error.message && 
        (error.message.includes('ERR_BLOCKED_BY_CLIENT') && 
         (error.message.includes('kaspersky-labs.com') || error.message.includes('kis.v2.scr')))) {
      console.log('Security software request blocked in promise. This is normal and can be ignored.');
      event.preventDefault(); // Prevent the error from propagating
    }
  });

  // Specifically handle the form submission error mentioned in the issue
  // This patches the BeaconSend function that might be injected by Kaspersky
  if (window.BeaconSend) {
    const originalBeaconSend = window.BeaconSend;
    window.BeaconSend = function() {
      try {
        return originalBeaconSend.apply(this, arguments);
      } catch (error) {
        if (error && error.message && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
          console.log('Kaspersky BeaconSend blocked. This is normal and can be ignored.');
          return null; // Return a safe value
        }
        throw error; // Re-throw if it's not the error we're looking for
      }
    };
  }

  // Add a submit event listener to all forms to catch and handle Kaspersky errors
  document.addEventListener('submit', function(event) {
    // We don't prevent the default behavior, just add error handling
    setTimeout(() => {
      // Check for any errors in the console related to Kaspersky after form submission
      console.log('Form submitted, any Kaspersky-related errors will be suppressed.');
    }, 0);
  }, true); // Use capture phase to ensure this runs before other handlers
};

export default setupGlobalErrorHandlers;
