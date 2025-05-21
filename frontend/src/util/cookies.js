/**
 * Get the value of a cookie by name
 * 
 * @param {string} name - The name of the cookie to retrieve
 * @returns {string|null} The cookie value or null if not found
 */
export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  
  return null;
}

/**
 * Set a cookie with the given name, value and options
 * 
 * @param {string} name - The name of the cookie
 * @param {string} value - The value of the cookie
 * @param {object} options - Cookie options (expires, path, etc.)
 */
export function setCookie(name, value, options = {}) {
  const opts = { path: '/', ...options };
  
  if (opts.expires instanceof Date) {
    opts.expires = opts.expires.toUTCString();
  }
  
  let updatedCookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  
  for (const key in opts) {
    updatedCookie += `; ${key}`;
    
    const optValue = opts[key];
    if (optValue !== true) {
      updatedCookie += `=${optValue}`;
    }
  }
  
  document.cookie = updatedCookie;
}

/**
 * Delete a cookie by name
 * 
 * @param {string} name - The name of the cookie to delete
 */
export function deleteCookie(name) {
  setCookie(name, '', {
    'max-age': -1
  });
} 