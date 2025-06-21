/**
 * Centralized Logger Service
 * 
 * This service provides a unified logging interface for the entire frontend application.
 * It supports different log levels, consistent formatting, and can be easily configured
 * for different environments (development, production, etc.).
 */

import { useLocalBackend } from '../config';

// Log levels with priority values
const LOG_LEVELS = {
  ERROR: { name: 'ERROR', priority: 0, color: '#ff4444' },
  WARN: { name: 'WARN', priority: 1, color: '#ffaa00' },
  INFO: { name: 'INFO', priority: 2, color: '#00aaff' },
  DEBUG: { name: 'DEBUG', priority: 3, color: '#44ff44' },
  TRACE: { name: 'TRACE', priority: 4, color: '#888888' }
};

class Logger {
  constructor() {
    // Set default log level based on environment
    this.currentLogLevel = !useLocalBackend 
      ? LOG_LEVELS.ERROR.priority 
      : LOG_LEVELS.DEBUG.priority;

    // Configuration options
    this.config = {
      enableTimestamp: true,
      enablePrefix: true,
      enableColors: useLocalBackend,
      enableStackTrace: useLocalBackend
    };

    // Context for tracking component/module information
    this.context = null;
  }

  /**
   * Set the minimum log level to display
   * @param {string} level - LOG_LEVELS key (ERROR, WARN, INFO, DEBUG, TRACE)
   */
  setLogLevel(level) {
    if (LOG_LEVELS[level]) {
      this.currentLogLevel = LOG_LEVELS[level].priority;
    }
  }

  /**
   * Set context for subsequent log messages
   * @param {string} context - Context identifier (e.g., component name, module name)
   */
  setContext(context) {
    this.context = context;
    return this;
  }

  /**
   * Clear current context
   */
  clearContext() {
    this.context = null;
    return this;
  }

  /**
   * Format log message with timestamp, level, and context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any} data - Additional data to log
   */
  formatMessage(level, message, data) {
    const parts = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    if (this.config.enablePrefix) {
      parts.push(`[${level}]`);
    }

    if (this.context) {
      parts.push(`[${this.context}]`);
    }

    parts.push(message);

    return {
      formatted: parts.join(' '),
      data: data
    };
  }

  /**
   * Apply color styling for browser console (development only)
   * @param {string} message - Message to style
   * @param {string} color - Color code
   */
  applyStyles(message, color) {
    if (!this.config.enableColors || typeof window === 'undefined') {
      return [message];
    }

    return [
      `%c${message}`,
      `color: ${color}; font-weight: bold;`
    ];
  }

  /**
   * Internal logging method
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any} data - Additional data
   */
  log(level, message, ...data) {
    const logLevel = LOG_LEVELS[level];

    if (!logLevel || logLevel.priority > this.currentLogLevel) {
      return; // Skip if log level is below threshold
    }

    const { formatted } = this.formatMessage(level, message, data);

    // Choose appropriate console method
    let consoleMethod;
    switch (level) {
      case 'ERROR':
        consoleMethod = console.error;
        break;
      case 'WARN':
        consoleMethod = console.warn;
        break;
      case 'DEBUG':
      case 'TRACE':
        consoleMethod = console.debug || console.log;
        break;
      default:
        consoleMethod = console.log;
    }

    // Apply styling and log
    if (this.config.enableColors && useLocalBackend) {
      const [styledMessage, style] = this.applyStyles(formatted, logLevel.color);
      if (data.length > 0) {
        consoleMethod(styledMessage, style, ...data);
      } else {
        consoleMethod(styledMessage, style);
      }
    } else {
      if (data.length > 0) {
        consoleMethod(formatted, ...data);
      } else {
        consoleMethod(formatted);
      }
    }

    // In production, you might want to send logs to a remote service
    if (!useLocalBackend && level === 'ERROR') {
      this.sendToRemoteLoggingService();
    }
  }

  /**
   * Send error logs to remote logging service (placeholder for production)
   * This is a placeholder method for future implementation
   */
  sendToRemoteLoggingService() {
    // Placeholder for remote logging service integration
    // This could integrate with services like Sentry, LogRocket, DataDog, etc.
    try {
      // Example: Send to your backend logging endpoint
      // fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     level: 'ERROR', // Since this is only called for ERROR level
      //     message: 'Error message', // Would need to capture this from the log method
      //     data: [], // Would need to capture this from the log method
      //     timestamp: new Date().toISOString(),
      //     context: this.context,
      //     userAgent: navigator.userAgent,
      //     url: window.location.href
      //   })
      // });
    } catch (error) {
      // Fallback to console if remote logging fails
      console.error('Failed to send log to remote service:', error);
    }
  }

  // Public logging methods

  /**
   * Log error messages - always shown in production
   * @param {string} message - Error message
   * @param {any} data - Additional error data
   */
  error(message, ...data) {
    this.log('ERROR', message, ...data);
  }

  /**
   * Log warning messages
   * @param {string} message - Warning message
   * @param {any} data - Additional warning data
   */
  warn(message, ...data) {
    this.log('WARN', message, ...data);
  }

  /**
   * Log informational messages
   * @param {string} message - Info message
   * @param {any} data - Additional info data
   */
  info(message, ...data) {
    this.log('INFO', message, ...data);
  }

  /**
   * Log debug messages - shown only in development
   * @param {string} message - Debug message
   * @param {any} data - Additional debug data
   */
  debug(message, ...data) {
    this.log('DEBUG', message, ...data);
  }

  /**
   * Log trace messages - most verbose, shown only in development
   * @param {string} message - Trace message
   * @param {any} data - Additional trace data
   */
  trace(message, ...data) {
    this.log('TRACE', message, ...data);
  }

  /**
   * Create a contextual logger for a specific component/module
   * @param {string} context - Context name
   */
  createContextualLogger(context) {
    return {
      error: (message, ...data) => this.setContext(context).error(message, ...data),
      warn: (message, ...data) => this.setContext(context).warn(message, ...data),
      info: (message, ...data) => this.setContext(context).info(message, ...data),
      debug: (message, ...data) => this.setContext(context).debug(message, ...data),
      trace: (message, ...data) => this.setContext(context).trace(message, ...data)
    };
  }

  /**
   * Group related log messages
   * @param {string} groupName - Name of the log group
   * @param {Function} callback - Function containing grouped logs
   */
  group(groupName, callback) {
    if (console.group && this.currentLogLevel >= LOG_LEVELS.DEBUG.priority) {
      console.group(groupName);
      try {
        callback();
      } finally {
        console.groupEnd();
      }
    } else {
      callback();
    }
  }

  /**
   * Measure and log execution time
   * @param {string} label - Timer label
   * @param {Function} callback - Function to measure
   */
  time(label, callback) {
    if (this.currentLogLevel >= LOG_LEVELS.DEBUG.priority) {
      console.time(label);
      try {
        const result = callback();
        if (result && typeof result.then === 'function') {
          // Handle promises
          return result.finally(() => console.timeEnd(label));
        }
        console.timeEnd(label);
        return result;
      } catch (error) {
        console.timeEnd(label);
        throw error;
      }
    }
    return callback();
  }

  /**
   * Log table data in a formatted way
   * @param {any} data - Data to display in table format
   * @param {string} label - Optional label for the table
   */
  table(data, label = '') {
    if (this.currentLogLevel >= LOG_LEVELS.DEBUG.priority) {
      if (label) {
        this.debug(label);
      }
      console.table(data);
    }
  }
}

// Create and export singleton instance
const logger = new Logger();

// Export both the logger instance and the class for advanced usage
export default logger;
export { Logger, LOG_LEVELS };

// For backward compatibility and easy migration, provide console-like methods
export const log = (...args) => logger.info(...args);
export const error = (...args) => logger.error(...args);
export const warn = (...args) => logger.warn(...args);
export const debug = (...args) => logger.debug(...args);
export const info = (...args) => logger.info(...args);

// Utility function to create contextual loggers for components
export const createLogger = (context) => logger.createContextualLogger(context); 
