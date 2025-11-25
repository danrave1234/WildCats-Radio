import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheConfig {
  maxSize: number; // Maximum number of items to cache
  ttl?: number; // Time to live in milliseconds (optional)
}

class CacheService {
  private static readonly CHAT_CACHE_PREFIX = 'chat_cache_';
  private static readonly POLL_CACHE_PREFIX = 'poll_cache_';
  private static readonly DEFAULT_MAX_SIZE = 50; // Cache last 50 items
  private static readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Cache chat messages for a broadcast (queue-like behavior)
   */
  static async cacheChatMessages(
    broadcastId: number,
    messages: any[],
    maxSize: number = this.DEFAULT_MAX_SIZE
  ): Promise<void> {
    try {
      const key = `${this.CHAT_CACHE_PREFIX}${broadcastId}`;
      
      // Keep only the most recent messages (queue behavior)
      const messagesToCache = messages.slice(-maxSize);
      
      const cacheData = {
        messages: messagesToCache,
        timestamp: Date.now(),
        broadcastId,
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`💾 Cached ${messagesToCache.length} chat messages for broadcast ${broadcastId}`);
    } catch (error) {
      console.error('Error caching chat messages:', error);
    }
  }

  /**
   * Retrieve cached chat messages for a broadcast
   */
  static async getCachedChatMessages(broadcastId: number): Promise<any[] | null> {
    try {
      const key = `${this.CHAT_CACHE_PREFIX}${broadcastId}`;
      const cached = await AsyncStorage.getItem(key);
      
      if (!cached) {
        return null;
      }
      
      const cacheData = JSON.parse(cached);
      
      // Check if cache is expired (optional TTL check)
      const age = Date.now() - cacheData.timestamp;
      if (age > this.DEFAULT_TTL) {
        console.log(`🗑️ Chat cache expired for broadcast ${broadcastId}`);
        await AsyncStorage.removeItem(key);
        return null;
      }
      
      console.log(`📦 Retrieved ${cacheData.messages.length} cached chat messages for broadcast ${broadcastId}`);
      return cacheData.messages || null;
    } catch (error) {
      console.error('Error retrieving cached chat messages:', error);
      return null;
    }
  }

  /**
   * Cache polls for a broadcast (queue-like behavior)
   */
  static async cachePolls(
    broadcastId: number,
    polls: any[],
    maxSize: number = this.DEFAULT_MAX_SIZE
  ): Promise<void> {
    try {
      const key = `${this.POLL_CACHE_PREFIX}${broadcastId}`;
      
      // Keep only the most recent polls (queue behavior)
      const pollsToCache = polls.slice(-maxSize);
      
      const cacheData = {
        polls: pollsToCache,
        timestamp: Date.now(),
        broadcastId,
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`💾 Cached ${pollsToCache.length} polls for broadcast ${broadcastId}`);
    } catch (error) {
      console.error('Error caching polls:', error);
    }
  }

  /**
   * Retrieve cached polls for a broadcast
   */
  static async getCachedPolls(broadcastId: number): Promise<any[] | null> {
    try {
      const key = `${this.POLL_CACHE_PREFIX}${broadcastId}`;
      const cached = await AsyncStorage.getItem(key);
      
      if (!cached) {
        return null;
      }
      
      const cacheData = JSON.parse(cached);
      
      // Check if cache is expired (optional TTL check)
      const age = Date.now() - cacheData.timestamp;
      if (age > this.DEFAULT_TTL) {
        console.log(`🗑️ Poll cache expired for broadcast ${broadcastId}`);
        await AsyncStorage.removeItem(key);
        return null;
      }
      
      console.log(`📦 Retrieved ${cacheData.polls.length} cached polls for broadcast ${broadcastId}`);
      return cacheData.polls || null;
    } catch (error) {
      console.error('Error retrieving cached polls:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific broadcast
   */
  static async clearBroadcastCache(broadcastId: number): Promise<void> {
    try {
      const chatKey = `${this.CHAT_CACHE_PREFIX}${broadcastId}`;
      const pollKey = `${this.POLL_CACHE_PREFIX}${broadcastId}`;
      
      await Promise.all([
        AsyncStorage.removeItem(chatKey),
        AsyncStorage.removeItem(pollKey),
      ]);
      
      console.log(`🧹 Cleared cache for broadcast ${broadcastId}`);
    } catch (error) {
      console.error('Error clearing broadcast cache:', error);
    }
  }

  /**
   * Clear all caches (useful for logout or cleanup)
   */
  static async clearAllCaches(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        key => key.startsWith(this.CHAT_CACHE_PREFIX) || key.startsWith(this.POLL_CACHE_PREFIX)
      );
      
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`🧹 Cleared ${cacheKeys.length} cache entries`);
    } catch (error) {
      console.error('Error clearing all caches:', error);
    }
  }
}

export default CacheService;

