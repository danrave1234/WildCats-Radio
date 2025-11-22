/**
 * Idempotency Key Utilities
 * Generates unique keys to prevent duplicate API operations
 */

/**
 * Generates a unique idempotency key for API operations
 * @returns {string} Unique UUID v4 idempotency key
 */
export const generateIdempotencyKey = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Generates an idempotency key with a prefix for better organization
 * @param {string} operation - Operation type (e.g., 'broadcast-start', 'broadcast-end')
 * @returns {string} Prefixed idempotency key
 */
export const generatePrefixedIdempotencyKey = (operation) => {
  const key = generateIdempotencyKey();
  return `${operation}-${key}`;
};

/**
 * Validates if a string looks like a valid idempotency key
 * @param {string} key - The key to validate
 * @returns {boolean} True if valid
 */
export const isValidIdempotencyKey = (key) => {
  return typeof key === 'string' && key.trim().length > 0;
};
