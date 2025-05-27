import apiClient from '../apiClient';

interface ServerStatusResponse {
  accessible: boolean;
  status: string;
}

interface StreamInfo {
  serverUrl: string;
  port: number;
  mountPoint: string;
  streamUrl: string; // Computed url from the other fields
}

export const shoutcastService = {
  /**
   * Check if the ShoutCast server is accessible
   */
  getServerStatus: async (): Promise<ServerStatusResponse> => {
    const response = await apiClient.get<ServerStatusResponse>('/shoutcast/status');
    return response.data;
  },

  /**
   * Get stream info for listeners (public data only)
   */
  getStreamInfo: async (): Promise<StreamInfo> => {
    // Temporarily return mock data instead of calling the API
    // const response = await apiClient.get<any>('/config/streaming/public');

    // Mock data
    const mockData = {
      serverUrl: 'stream.example.com',
      port: 443,
      mountPoint: '/wildcats',
    };

    // Compute the full stream URL from the parts
    const streamUrl = `https://${mockData.serverUrl}:${mockData.port}${mockData.mountPoint}`;

    return {
      ...mockData,
      streamUrl
    };
  }
}; 
