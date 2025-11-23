// Auth Storage Service - Persistent authentication state using IndexedDB
// Provides reliable storage for long broadcast sessions (8+ hours)

class AuthStorage {
  constructor() {
    this.dbName = 'WildCatsRadio_Auth';
    this.storeName = 'auth_sessions';
    this.db = null;
    this.dbPromise = this.initDB();
  }

  // Initialize IndexedDB database
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.warn('IndexedDB not available, falling back to localStorage');
        this.fallbackStorage = true;
        resolve(null);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Create object store for auth sessions
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('lastVerified', 'lastVerified', { unique: false });
        }
      };
    });
  }

  // Wait for DB to be ready
  async ensureDB() {
    if (this.fallbackStorage) return null;
    if (this.db) return this.db;
    return await this.dbPromise;
  }

  // Store user session data
  async setUser(user) {
    const db = await this.ensureDB();

    if (!db || this.fallbackStorage) {
      // Fallback to localStorage
      const sessionData = {
        user,
        lastVerified: Date.now(),
        sessionId: this.generateSessionId()
      };
      localStorage.setItem('auth_session', JSON.stringify(sessionData));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const sessionData = {
        id: 'current_user',
        user,
        userId: user.id,
        lastVerified: Date.now(),
        sessionId: this.generateSessionId(),
        createdAt: Date.now()
      };

      const request = store.put(sessionData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Retrieve stored user session
  async getUser() {
    const db = await this.ensureDB();

    if (!db || this.fallbackStorage) {
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('auth_session');
        if (stored) {
          const sessionData = JSON.parse(stored);
          return sessionData.user;
        }
      } catch (e) {
        console.warn('Error parsing stored auth session:', e);
      }
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get('current_user');

      request.onsuccess = () => {
        const sessionData = request.result;
        resolve(sessionData ? sessionData.user : null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get full session data (including metadata)
  async getSession() {
    const db = await this.ensureDB();

    if (!db || this.fallbackStorage) {
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('auth_session');
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Error parsing stored auth session:', e);
      }
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get('current_user');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear stored authentication data
  async clear() {
    const db = await this.ensureDB();

    if (!db || this.fallbackStorage) {
      localStorage.removeItem('auth_session');
      // Also clear legacy oauth storage
      localStorage.removeItem('oauth_token');
      localStorage.removeItem('oauth_userId');
      localStorage.removeItem('oauth_userRole');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete('current_user');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Check if a stored session is still valid
  async isSessionValid(maxAgeMs) { // Use config value instead of hardcoded default
    const session = await this.getSession();

    if (!session || !session.user || !session.lastVerified) {
      return false;
    }

    const sessionAge = Date.now() - session.lastVerified;
    return sessionAge < maxAgeMs;
  }

  // Generate a unique session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup old sessions (useful for maintenance)
  async cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours
    const db = await this.ensureDB();
    if (!db || this.fallbackStorage) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('lastVerified');

      const range = IDBKeyRange.upperBound(Date.now() - maxAgeMs);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete(); // Delete old session
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Create singleton instance
const authStorage = new AuthStorage();

export default authStorage;
