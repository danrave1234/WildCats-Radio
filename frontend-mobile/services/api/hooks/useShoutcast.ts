import { useQuery } from '@tanstack/react-query';
import { shoutcastService } from '../endpoints/shoutcastService';

export const useShoutcast = () => {
  // Get server status
  const useServerStatus = () => {
    return useQuery({
      queryKey: ['shoutcast', 'status'],
      queryFn: () => shoutcastService.getServerStatus(),
      // Poll server status every 30 seconds
      refetchInterval: 30000,
    });
  };

  // Get stream info
  const useStreamInfo = () => {
    return useQuery({
      queryKey: ['shoutcast', 'streamInfo'],
      queryFn: () => shoutcastService.getStreamInfo(),
      // Cache for 10 minutes since this rarely changes
      staleTime: 10 * 60 * 1000,
    });
  };

  return {
    useServerStatus,
    useStreamInfo,
  };
}; 