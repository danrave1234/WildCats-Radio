/**
 * Idempotency Key Utilities
 * Generates unique keys to prevent duplicate API operations
 */

/**
 * Generates a unique idempotency key for API operations
 * Uses a combination of timestamp and random values
 *
 * @returns {string} Unique idempotency key
 */
export const generateIdempotencyKey = () => {
  // Use timestamp and random values to create a UUID-like string
  const timestamp = Date.now().toString(36);
  const randomPart1 = Math.random().toString(36).substring(2, 11);
  const randomPart2 = Math.random().toString(36).substring(2, 11);
  const randomPart3 = Math.random().toString(36).substring(2, 11);

  return `${timestamp}-${randomPart1}-${randomPart2}-${randomPart3}`;
};

/**
 * Generates an idempotency key with a prefix for better organization
 *
 * @param {string} operation - Operation type (e.g., 'broadcast-start', 'broadcast-end')
 * @returns {string} Prefixed idempotency key
 */
export const generatePrefixedIdempotencyKey = (operation) => {
  const key = generateIdempotencyKey();
  return `${operation}-${key}`;
};

/**
 * Validates if a string looks like a valid idempotency key
 * Basic validation - checks if it's a non-empty string
 *
 * @param {string} key - The key to validate
 * @returns {boolean} True if valid
 */
export const isValidIdempotencyKey = (key) => {
  return typeof key === 'string' && key.trim().length > 0;
};

export default {
  generateIdempotencyKey,
  generatePrefixedIdempotencyKey,
  isValidIdempotencyKey,
};

