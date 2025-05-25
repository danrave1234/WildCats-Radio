import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollService } from '../endpoints/pollService';
import { VotePollRequest } from '../types';

export const usePolls = () => {
  const queryClient = useQueryClient();

  // Get all polls for a broadcast
  const useBroadcastPolls = (broadcastId: number, enabled = true) => {
    return useQuery({
      queryKey: ['polls', broadcastId],
      queryFn: () => pollService.getBroadcastPolls(broadcastId),
      enabled: !!broadcastId && enabled,
    });
  };

  // Get active polls for a broadcast
  const useActiveBroadcastPolls = (broadcastId: number, enabled = true) => {
    return useQuery({
      queryKey: ['polls', 'active', broadcastId],
      queryFn: () => pollService.getActiveBroadcastPolls(broadcastId),
      enabled: !!broadcastId && enabled,
      // Poll active polls every 10 seconds
      refetchInterval: 10000,
    });
  };

  // Get a specific poll
  const usePoll = (pollId: number) => {
    return useQuery({
      queryKey: ['polls', 'single', pollId],
      queryFn: () => pollService.getPollById(pollId),
      enabled: !!pollId,
    });
  };

  // Vote on a poll
  const votePollMutation = useMutation({
    mutationFn: ({ pollId, data }: { pollId: number; data: VotePollRequest }) => 
      pollService.votePoll(pollId, data),
    onSuccess: (data, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['polls', 'single', variables.pollId] });
      // Find all broadcast poll queries and invalidate them
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey[0] === 'polls' && 
                 (queryKey[1] === 'active' || typeof queryKey[1] === 'number');
        } 
      });
    },
  });

  return {
    useBroadcastPolls,
    useActiveBroadcastPolls,
    usePoll,
    votePoll: votePollMutation,
  };
}; 