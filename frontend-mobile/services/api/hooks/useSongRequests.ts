import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { songRequestService } from '../endpoints/songRequestService';
import { CreateSongRequestRequest } from '../types';

export const useSongRequests = () => {
  const queryClient = useQueryClient();

  // Get song requests for a broadcast
  const useBroadcastSongRequests = (broadcastId: number, enabled = true) => {
    return useQuery({
      queryKey: ['songRequests', broadcastId],
      queryFn: () => songRequestService.getBroadcastSongRequests(broadcastId),
      enabled: !!broadcastId && enabled,
      // Poll for new requests every 15 seconds
      refetchInterval: 15000,
    });
  };

  // Create song request mutation
  const createSongRequestMutation = useMutation({
    mutationFn: ({ broadcastId, data }: { broadcastId: number; data: CreateSongRequestRequest }) => 
      songRequestService.createSongRequest(broadcastId, data),
    onSuccess: (_, variables) => {
      // Invalidate song requests query to refetch
      queryClient.invalidateQueries({ queryKey: ['songRequests', variables.broadcastId] });
    },
  });

  return {
    useBroadcastSongRequests,
    createSongRequest: createSongRequestMutation,
  };
}; 