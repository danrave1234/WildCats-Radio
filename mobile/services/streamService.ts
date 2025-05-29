import { StreamConfig } from './audioStreamingService';
import { createLogger } from './logger';

const logger = createLogger('StreamService');

// Base URLs from the roadmap
//const BACKEND_BASE_URL = 'https://wildcat-radio-f05d362144e6.autoidleapp.com';
//const BACKEND_BASE_URL = 'http://10.0.2.2:8080/api'; // Android emulator to access local server
const BACKEND_BASE_URL = 'http://192.168.34.212:8080'; // Local development URL
const ICECAST_SERVER_URL = 'http://34.142.131.206:8000';
const STREAM_URL = 'http://34.142.131.206:8000/live.ogg';

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
      
      // Map the response to our StreamConfig interface
      const config: StreamConfig = {
        streamUrl: data.streamUrl || STREAM_URL,
        serverIp: data.serverIp || '34.142.131.206',
        icecastPort: data.icecastPort || 8000,
        listenerCount: data.listenerCount || 0,
        isLive: data.isLive || false,
        server: data.server || 'UP',
        icecastReachable: data.icecastReachable || true,
      };

      logger.debug('Stream config fetched successfully:', config);
      return config;
    } catch (error: unknown) {
      logger.error('Failed to fetch stream config:', error);
      
      // Return fallback configuration
      return {
        streamUrl: STREAM_URL,
        serverIp: '34.142.131.206',
        icecastPort: 8000,
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
   * Get fallback stream URLs for different formats
   */
  public getFallbackStreamUrls(): string[] {
    const baseUrl = 'http://34.142.131.206:8000';
    return [
      `${baseUrl}/live.ogg`,  // Primary OGG stream
      `${baseUrl}/live`,      // Without extension
      `${baseUrl}/live.mp3`,  // MP3 fallback
      `${baseUrl}/live.aac`,  // AAC fallback
    ];
  }

  /**
   * Update the base URL (useful for development/testing)
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url;
    logger.debug('Base URL updated to:', url);
  }
}

// Create and export singleton instance
const streamService = new StreamService();
export default streamService; 