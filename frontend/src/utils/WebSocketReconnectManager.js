import { createLogger } from '../services/logger';

const logger = createLogger('WebSocketReconnectManager');

/**
 * WebSocket reconnection manager with exponential backoff and jitter.
 * Prevents thundering herd problem and provides resilient reconnection.
 */
class WebSocketReconnectManager {
  constructor(options = {}) {
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.maxAttempts = options.maxAttempts || 10;
    this.attempts = 0;
    this.jitterPercent = options.jitterPercent || 0.25; // ±25% jitter
    this.onMaxAttemptsReached = options.onMaxAttemptsReached || null;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * @returns {number} Delay in milliseconds
   */
  getDelay() {
    // Exponential backoff: baseDelay * 2^attempts
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, this.attempts),
      this.maxDelay
    );
    
    // Add jitter (±jitterPercent) to prevent thundering herd
    const jitterRange = exponentialDelay * this.jitterPercent;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // Random value between -jitterRange and +jitterRange
    
    const finalDelay = Math.max(100, exponentialDelay + jitter); // Minimum 100ms
    
    logger.debug(`Reconnection delay calculated: base=${exponentialDelay}ms, jitter=${jitter.toFixed(0)}ms, final=${finalDelay.toFixed(0)}ms`);
    
    return Math.round(finalDelay);
  }

  /**
   * Attempt to reconnect with exponential backoff
   * @param {Function} connectFn - Function that returns a Promise resolving when connection succeeds
   * @returns {Promise} Resolves when connection succeeds, rejects if max attempts reached
   */
  async reconnect(connectFn) {
    if (this.attempts >= this.maxAttempts) {
      const error = new Error(`Max reconnection attempts (${this.maxAttempts}) reached`);
      logger.error(error.message);
      
      if (this.onMaxAttemptsReached) {
        this.onMaxAttemptsReached(error);
      }
      
      throw error;
    }
    
    this.attempts++;
    const delay = this.getDelay();
    
    logger.info(`Reconnection attempt ${this.attempts}/${this.maxAttempts} - waiting ${delay}ms before retry`);
    
    // Wait for calculated delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await connectFn();
      // Reset attempts on successful connection
      logger.info(`Reconnection successful after ${this.attempts} attempt(s)`);
      this.attempts = 0;
    } catch (error) {
      logger.warn(`Reconnection attempt ${this.attempts} failed:`, error.message);
      // Recursively retry with increased delay
      return this.reconnect(connectFn);
    }
  }

  /**
   * Reset the reconnection attempts counter
   */
  reset() {
    logger.debug('Resetting reconnection attempts counter');
    this.attempts = 0;
  }

  /**
   * Get current attempt count
   * @returns {number} Current number of attempts
   */
  getAttempts() {
    return this.attempts;
  }

  /**
   * Check if max attempts have been reached
   * @returns {boolean} True if max attempts reached
   */
  hasReachedMaxAttempts() {
    return this.attempts >= this.maxAttempts;
  }
}

export default WebSocketReconnectManager;

