/**
 * Broadcast Error Handler Utility
 * Centralized error message mapping for broadcast operations
 */

/**
 * Handles circuit breaker errors (503 Service Unavailable)
 * @param {any} error - Error object from API call
 * @returns {object | null} Circuit breaker error details or null
 */
export const handleCircuitBreakerError = (error) => {
  // Check by HTTP status first (ideal case)
  if (error?.response?.status === 503 || error?.status === 503) {
    const retryAfter = error?.response?.headers?.['retry-after'] ||
                      error?.response?.headers?.['Retry-After'] ||
                      error?.headers?.['retry-after'] ||
                      error?.headers?.['Retry-After'];
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;

    return {
      isCircuitBreaker: true,
      retryAfter: retrySeconds,
      message: `Service temporarily unavailable. Please try again in ${retrySeconds} seconds.`
    };
  }

  // Fallback: Check by error message content (current backend behavior)
  const errorMessage = error?.response?.data?.message ||
                      error?.data?.message ||
                      error?.message || '';

  if (errorMessage.includes('Service temporarily unavailable') ||
      errorMessage.includes('circuit breaker') ||
      errorMessage.includes('Circuit breaker')) {
    return {
      isCircuitBreaker: true,
      retryAfter: 60, // Default retry time
      message: `Service temporarily unavailable. Please try again in 60 seconds.`
    };
  }

  return null;
};

/**
 * Handles state machine validation errors (409 Conflict)
 * @param {any} error - Error object from API call
 * @returns {object | null} State machine error details or null
 */
export const handleStateMachineError = (error) => {
  // Check by HTTP status first (ideal case)
  if (error?.response?.status === 409 || error?.status === 409) {
    const backendMessage = error?.response?.data?.message ||
                          error?.data?.message ||
                          error?.message || '';

    let userMessage = backendMessage;

    // Map backend messages to user-friendly messages
    if (backendMessage.includes('already LIVE')) {
      userMessage = 'This broadcast is already live. Cannot start again.';
    } else if (backendMessage.includes('Cannot start')) {
      userMessage = `Cannot start broadcast: ${backendMessage}`;
    } else if (backendMessage.includes('already ENDED')) {
      userMessage = 'This broadcast has already ended.';
    } else if (backendMessage.includes('Cannot end')) {
      userMessage = `Cannot end broadcast: ${backendMessage}`;
    } else if (backendMessage.includes('already SCHEDULED')) {
      userMessage = 'This broadcast is already scheduled.';
    } else if (backendMessage.includes('already CANCELLED')) {
      userMessage = 'This broadcast has been cancelled.';
    } else {
      userMessage = `Invalid operation: ${backendMessage}`;
    }

    return {
      isStateMachineError: true,
      message: userMessage
    };
  }

  // Fallback: Check by error message content (current backend behavior)
  const errorMessage = error?.response?.data?.message ||
                      error?.data?.message ||
                      error?.message || '';

  // Look for state machine validation error patterns
  if (errorMessage.includes('Cannot transition') ||
      errorMessage.includes('cannot transition') ||
      errorMessage.includes('Invalid state') ||
      errorMessage.includes('invalid state') ||
      (errorMessage.includes('already') && (
        errorMessage.includes('LIVE') ||
        errorMessage.includes('ENDED') ||
        errorMessage.includes('SCHEDULED') ||
        errorMessage.includes('CANCELLED')
      )) ||
      (errorMessage.includes('Cannot') && (
        errorMessage.includes('start') ||
        errorMessage.includes('end')
      ))) {

    let userMessage = errorMessage;

    // Map backend messages to user-friendly messages
    if (errorMessage.includes('already LIVE')) {
      userMessage = 'This broadcast is already live. Cannot start again.';
    } else if (errorMessage.includes('Cannot start')) {
      userMessage = `Cannot start broadcast: ${errorMessage}`;
    } else if (errorMessage.includes('already ENDED')) {
      userMessage = 'This broadcast has already ended.';
    } else if (errorMessage.includes('Cannot end')) {
      userMessage = `Cannot end broadcast: ${errorMessage}`;
    } else if (errorMessage.includes('already SCHEDULED')) {
      userMessage = 'This broadcast is already scheduled.';
    } else if (errorMessage.includes('already CANCELLED')) {
      userMessage = 'This broadcast has been cancelled.';
    } else {
      userMessage = `Invalid operation: ${errorMessage}`;
    }

    return {
      isStateMachineError: true,
      message: userMessage
    };
  }

  return null;
};

/**
 * Gets user-friendly error message for broadcast operations
 * @param {any} error - Error object from API call
 * @returns {object} Structured error information
 */
export const getBroadcastErrorMessage = (error) => {
  const status = error?.response?.status || error?.status;
  const message = error?.response?.data?.message ||
                  error?.data?.message ||
                  error?.message || 'An error occurred';

  // Check for circuit breaker error first
  const circuitBreakerError = handleCircuitBreakerError(error);
  if (circuitBreakerError) {
    return {
      isCircuitBreaker: true,
      isStateMachineError: false,
      message: circuitBreakerError.message,
      retryAfter: circuitBreakerError.retryAfter,
      userMessage: circuitBreakerError.message
    };
  }

  // Check for state machine validation error
  const stateMachineError = handleStateMachineError(error);
  if (stateMachineError) {
    return {
      isCircuitBreaker: false,
      isStateMachineError: true,
      message: stateMachineError.message,
      userMessage: stateMachineError.message
    };
  }

  // Handle other HTTP status codes
  switch (status) {
    case 400:
      if (message.includes('idempotency')) {
        return {
          isCircuitBreaker: false,
          isStateMachineError: false,
          message: 'Invalid request. Please try again.',
          userMessage: 'Invalid request. Please try again.'
        };
      }
      return {
        isCircuitBreaker: false,
        isStateMachineError: false,
        message: message || 'Invalid request',
        userMessage: message || 'Invalid request'
      };

    case 401:
      return {
        isCircuitBreaker: false,
        isStateMachineError: false,
        message: 'Authentication required. Please log in again.',
        userMessage: 'Authentication required. Please log in again.'
      };

    case 403:
      return {
        isCircuitBreaker: false,
        isStateMachineError: false,
        message: 'You do not have permission to perform this action.',
        userMessage: 'You do not have permission to perform this action.'
      };

    case 404:
      return {
        isCircuitBreaker: false,
        isStateMachineError: false,
        message: 'Broadcast not found.',
        userMessage: 'Broadcast not found.'
      };

    case 429:
      return {
        isCircuitBreaker: false,
        isStateMachineError: false,
        message: 'Too many requests. Please wait a moment and try again.',
        userMessage: 'Too many requests. Please wait a moment and try again.'
      };

    default:
      return {
        isCircuitBreaker: false,
        isStateMachineError: false,
        message: message || 'An error occurred. Please try again.',
        userMessage: message || 'An error occurred. Please try again.'
      };
  }
};

/**
 * Checks if an error is retryable
 * @param {BroadcastError} error - Structured error from getBroadcastErrorMessage
 * @returns {boolean} True if the operation can be retried
 */
export const isRetryableError = (error) => {
  // Circuit breaker errors are retryable after the timeout
  if (error.isCircuitBreaker) {
    return true;
  }

  // State machine errors are generally not retryable
  if (error.isStateMachineError) {
    return false;
  }

  // Network errors, 5xx errors are retryable
  const status = error.status || 0;
  return status >= 500 || status === 0; // 0 usually means network error
};

export default {
  handleCircuitBreakerError,
  handleStateMachineError,
  getBroadcastErrorMessage,
  isRetryableError
};
