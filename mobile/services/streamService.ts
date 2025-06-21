import { StreamConfig } from './audioStreamingService';
import { createLogger } from './logger';
import { Platform } from 'react-native';

const logger = createLogger('StreamService');

// Base URLs from the roadmap
const BACKEND_BASE_URL = 'https://wildcat-radio-f05d362144e6.autoidleapp.com';
//const BACKEND_BASE_URL = 'http://10.0.2.2:8080/api'; // Android emulator to access local server
//const BACKEND_BASE_URL = 'http://192.168.5.60:8080'; // Local development URL
const ICECAST_SERVER_URL = 'https://icecast.software';
const STREAM_URL = 'https://icecast.software/live.mp3'; // Mobile-exclusive MP3 stream

interface StreamStatusResponse {
  live: boolean;
  server: 'UP' | 'DOWN';
  streamUrl: string;
  listenerCount: number;
  icecastReachable: boolean;
}

interface WebSocketUrlResponse {
  djUrl: string;
  listenerUrl: string;
  chatUrl: string;
  broadcastUrl: string;
}

class StreamService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BACKEND_BASE_URL;
  }

  /**
   * Get stream configuration from the backend
   * Endpoint: GET /api/stream/config
   */
  public async getStreamConfig(): Promise<StreamConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stream/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stream config: ${response.status}`);
      }

      const data = await response.json();
      
      // Map the response to our StreamConfig interface with MP3 focus
      const config: StreamConfig = {
        streamUrl: 'https://icecast.software/live.mp3', // Force MP3 for mobile
        serverIp: data.serverIp || 'icecast.software',
        icecastPort: data.icecastPort || 443,
        listenerCount: data.listenerCount || 0,
        isLive: data.isLive || false,
        server: data.server || 'UP',
        icecastReachable: data.icecastReachable || true,
      };

      logger.debug('Stream config fetched successfully (MP3 focused):', config);
      return config;
    } catch (error: unknown) {
      logger.error('Failed to fetch stream config:', error);
      
      // Return fallback configuration with MP3
      return {
        streamUrl: 'https://icecast.software/live.mp3',
        serverIp: 'icecast.software',
        icecastPort: 443,
        listenerCount: 0,
        isLive: false,
        server: 'UP',
        icecastReachable: true,
      };
    }
  }

  /**
   * Get current stream status
   * Endpoint: GET /api/stream/status
   */
  public async getStreamStatus(): Promise<StreamStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stream/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stream status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle nested response structure if needed
      const statusData = data.data || data;
      
      const status: StreamStatusResponse = {
        live: statusData.live || false,
        server: statusData.server || 'UP',
        streamUrl: statusData.streamUrl || STREAM_URL,
        listenerCount: statusData.listenerCount || 0,
        icecastReachable: statusData.icecastReachable !== false,
      };

      logger.debug('Stream status fetched successfully:', status);
      return status;
    } catch (error: unknown) {
      logger.error('Failed to fetch stream status:', error);
      
      // Return fallback status
      return {
        live: false,
        server: 'DOWN',
        streamUrl: STREAM_URL,
        listenerCount: 0,
        icecastReachable: false,
      };
    }
  }

  /**
   * Get WebSocket URLs for different connections
   * Endpoint: GET /api/stream/websocket-url
   */
  public async getWebSocketUrls(): Promise<WebSocketUrlResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stream/websocket-url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch WebSocket URLs: ${response.status}`);
      }

      const data = await response.json();
      
      const urls: WebSocketUrlResponse = {
        djUrl: data.djUrl || `${this.baseUrl}/ws/live`,
        listenerUrl: data.listenerUrl || `${this.baseUrl}/ws/listener`,
        chatUrl: data.chatUrl || `${this.baseUrl}/ws-radio`,
        broadcastUrl: data.broadcastUrl || `${this.baseUrl}/ws-radio`,
      };

      logger.debug('WebSocket URLs fetched successfully:', urls);
      return urls;
    } catch (error: unknown) {
      logger.error('Failed to fetch WebSocket URLs:', error);
      
      // Return fallback URLs
      return {
        djUrl: `${this.baseUrl}/ws/live`,
        listenerUrl: `${this.baseUrl}/ws/listener`,
        chatUrl: `${this.baseUrl}/ws-radio`,
        broadcastUrl: `${this.baseUrl}/ws-radio`,
      };
    }
  }

  /**
   * Health check for the streaming service
   * Endpoint: GET /api/stream/health
   */
  public async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stream/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { 
          healthy: false, 
          message: `Health check failed: ${response.status}` 
        };
      }

      const data = await response.json();
      
      return {
        healthy: data.healthy !== false,
        message: data.message || 'Service is healthy',
      };
    } catch (error: unknown) {
      logger.error('Health check failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        healthy: false, 
        message: `Health check error: ${errorMessage}` 
      };
    }
  }

  /**
   * Test direct Icecast server connectivity
   */
  public async testIcecastConnectivity(): Promise<{ reachable: boolean; message?: string }> {
    try {
      // Test the Icecast server directly with a HEAD request
      const response = await fetch(ICECAST_SERVER_URL, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'WildCats-Radio-Mobile/1.0',
        },
      });

      return {
        reachable: response.ok,
        message: response.ok ? 'Icecast server is reachable' : `Icecast server returned ${response.status}`,
      };
    } catch (error: unknown) {
      logger.error('Icecast connectivity test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        reachable: false,
        message: `Icecast server not reachable: ${errorMessage}`,
      };
    }
  }

  /**
   * Get the primary MP3 stream URL (mobile-exclusive)
   */
  public getPrimaryStreamUrl(): string {
    return 'https://icecast.software/live.mp3';
  }

  /**
   * Get fallback stream URLs - simplified for mobile MP3 only
   */
  public getFallbackStreamUrls(): string[] {
    // Mobile-first: Only MP3 streams, no OGG/other formats
    return [
      'https://icecast.software/live.mp3',  // Primary MP3 stream
      'https://icecast.software/live',      // MP3 without extension
    ];
  }

  /**
   * Test stream URL accessibility and format
   */
  public async testStreamUrl(url: string): Promise<{ accessible: boolean; error?: string; contentType?: string }> {
    try {
      logger.debug('Testing stream URL:', url);
      
      // Use a short GET request with range header to test stream availability
      // This is more reliable for streaming servers than HEAD requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'WildCats-Radio-Mobile/1.0',
          'Accept': 'audio/*',
          'Range': 'bytes=0-1023', // Request only first 1KB to test availability
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      const contentType = response.headers.get('content-type');
      logger.debug('Stream test response:', {
        status: response.status,
        contentType,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // For streaming servers, we accept 200 (OK) or 206 (Partial Content)
      if (response.ok || response.status === 206) {
        // Try to read a small amount of data to confirm it's actually streaming
        try {
          const reader = response.body?.getReader();
          if (reader) {
            const { done } = await reader.read();
            reader.releaseLock();
            
            // If we can read data, the stream is accessible
            return {
              accessible: true,
              contentType: contentType || undefined,
            };
          }
        } catch (readError) {
          // If we can't read but got a good response, still consider it accessible
          logger.debug('Could not read stream data but response was OK:', readError);
        }
        
        return {
          accessible: true,
          contentType: contentType || undefined,
        };
      } else {
        return {
          accessible: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Don't treat AbortError as a real error - it just means timeout
      if (errorMessage.includes('AbortError') || errorMessage.includes('aborted')) {
        logger.debug('Stream test timed out (this may be normal for live streams):', url);
        return {
          accessible: false,
          error: 'Connection timeout - stream may not be active',
        };
      }
      
      logger.error('Stream URL test failed:', errorMessage);
      return {
        accessible: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Test MP3 stream availability (mobile-exclusive)
   */
  public async testMp3StreamAvailability(): Promise<{ available: boolean; error?: string; contentType?: string }> {
    const mp3Url = 'https://icecast.software/live.mp3';
    
    try {
      logger.debug('Testing MP3 stream availability:', mp3Url);
      
      // Use a more reliable method for testing live streams
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout for MP3 test
      
      const response = await fetch(mp3Url, {
        method: 'GET',
        headers: {
          'User-Agent': 'WildCats-Radio-Mobile/1.0',
          'Accept': 'audio/mpeg, audio/*',
          'Range': 'bytes=0-2047', // Request first 2KB to test MP3 stream
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      const contentType = response.headers.get('content-type');
      logger.debug('MP3 stream test response:', {
        status: response.status,
        contentType,
        url: mp3Url,
      });

      // Accept 200 (OK) or 206 (Partial Content) for streaming
      if (response.ok || response.status === 206) {
        // Try to read some data to confirm it's actually streaming
        try {
          const reader = response.body?.getReader();
          if (reader) {
            const { value, done } = await reader.read();
            reader.releaseLock();
            
            // Check if we got actual data
            if (value && value.length > 0) {
              logger.debug('✅ MP3 stream is actively streaming data');
              return {
                available: true,
                contentType: contentType || undefined,
              };
            }
          }
        } catch (readError) {
          logger.debug('Could not read MP3 stream data but response was OK:', readError);
        }
        
        // Even if we can't read data, a good response means stream is likely available
        return {
          available: true,
          contentType: contentType || undefined,
        };
      } else {
        return {
          available: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle timeout gracefully
      if (errorMessage.includes('AbortError') || errorMessage.includes('aborted')) {
        logger.debug('MP3 stream test timed out - may indicate stream is not active');
        return {
          available: false,
          error: 'Stream connection timeout - broadcast may not be active',
        };
      }
      
      logger.error('MP3 stream test failed:', errorMessage);
      return {
        available: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Find working MP3 stream URL (simplified for mobile)
   */
  public async findWorkingMp3Stream(): Promise<{ url: string; contentType?: string } | null> {
    const mp3Urls = this.getFallbackStreamUrls();
    
    logger.debug('Testing MP3 stream URLs:', mp3Urls);

    for (const url of mp3Urls) {
      const result = await this.testStreamUrl(url);
      if (result.accessible) {
        logger.debug('Found working MP3 stream URL:', { url, contentType: result.contentType });
        return { url, contentType: result.contentType };
      } else {
        logger.debug('MP3 stream URL failed:', { url, error: result.error });
      }
    }

    logger.error('No working MP3 stream URLs found');
    return null;
  }

  /**
   * Update the base URL (useful for development/testing)
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url;
    logger.debug('Base URL updated to:', url);
  }

  /**
   * Check if MP3 stream is available (mobile-exclusive)
   */
  public async isMp3StreamAvailable(): Promise<boolean> {
    // iOS has known issues with Icecast stream detection (duplicate connections, failed tests)
    // Reference: https://github.com/doublesymmetry/react-native-track-player/issues/2096
    if (Platform.OS === 'ios') {
      logger.debug('🍎 iOS detected - bypassing Icecast stream tests due to known iOS/Icecast compatibility issues');
      return true; // Assume stream is available on iOS to avoid duplicate connection issues
    }
    
    const result = await this.testMp3StreamAvailability();
    return result.available;
  }

  /**
   * Simple MP3 stream availability check - assumes stream is available if server is reachable
   * This is a fallback method for when detailed testing is too strict
   */
  public async isMp3StreamAvailableSimple(): Promise<boolean> {
    // iOS has known issues with Icecast, so skip testing
    if (Platform.OS === 'ios') {
      logger.debug('🍎 iOS detected - assuming MP3 stream is available (bypassing Icecast connectivity test)');
      return true;
    }
    
    try {
      // Just check if the Icecast server is reachable
      const icecastTest = await this.testIcecastConnectivity();
      
      if (icecastTest.reachable) {
        logger.debug('✅ Icecast server is reachable, assuming MP3 stream is available');
        return true;
      } else {
        logger.debug('❌ Icecast server not reachable');
        return false;
      }
    } catch (error) {
      logger.error('Simple MP3 availability check failed:', error);
      return false;
    }
  }

  /**
   * Force assume MP3 stream is available (for when we know it should work)
   */
  public assumeMp3StreamAvailable(): boolean {
    logger.debug('🎵 Assuming MP3 stream is available (bypassing tests)');
    return true;
  }
}

// Create and export singleton instance
const streamService = new StreamService();
export default streamService; 