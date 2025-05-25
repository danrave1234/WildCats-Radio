import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { broadcastService } from '../endpoints/broadcastService';
import { CreateBroadcastRequest } from '../types';

export const useBroadcasts = () => {
  const queryClient = useQueryClient();

  // Get all broadcasts query
  const useAllBroadcasts = () => {
    return useQuery({
      queryKey: ['broadcasts'],
      queryFn: () => broadcastService.getAllBroadcasts(),
    });
  };

  // Get a specific broadcast by ID
  const useBroadcast = (id: number) => {
    return useQuery({
      queryKey: ['broadcasts', id],
      queryFn: () => broadcastService.getBroadcastById(id),
      enabled: !!id, // Only run when we have an ID
    });
  };

  // Get the currently active broadcast
  const useActiveBroadcast = (enabled = true) => {
    return useQuery({
      queryKey: ['broadcasts', 'active'],
      queryFn: () => broadcastService.getActiveBroadcast(),
      // Poll for active broadcast every 30 seconds
      refetchInterval: 30000,
      // Only run the query if enabled is true
      enabled,
      // Don't retry on error for this specific query
      retry: false,
    });
  };

  // Get live broadcasts
  const useLiveBroadcasts = () => {
    return useQuery({
      queryKey: ['broadcasts', 'live'],
      queryFn: () => broadcastService.getLiveBroadcasts(),
      // Poll for live broadcasts every 30 seconds
      refetchInterval: 30000,
    });
  };

  // Get upcoming broadcasts
  const useUpcomingBroadcasts = () => {
    return useQuery({
      queryKey: ['broadcasts', 'upcoming'],
      queryFn: () => broadcastService.getUpcomingBroadcasts(),
      // Poll less frequently for upcoming broadcasts
      refetchInterval: 60000,
    });
  };

  // Create broadcast mutation
  const createBroadcastMutation = useMutation({
    mutationFn: (data: CreateBroadcastRequest) => broadcastService.createBroadcast(data),
    onSuccess: () => {
      // Invalidate broadcasts queries to refetch
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });

  // Update broadcast mutation
  const updateBroadcastMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateBroadcastRequest> }) => 
      broadcastService.updateBroadcast(id, data),
    onSuccess: (data) => {
      // Update the specific broadcast in cache
      queryClient.invalidateQueries({ queryKey: ['broadcasts', data.id] });
      // Update the list of broadcasts
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });

  // Start broadcast mutation
  const startBroadcastMutation = useMutation({
    mutationFn: (id: number) => broadcastService.startBroadcast(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', data.id] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'live'] });
    },
  });

  // End broadcast mutation
  const endBroadcastMutation = useMutation({
    mutationFn: (id: number) => broadcastService.endBroadcast(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', data.id] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'live'] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'upcoming'] });
    },
  });

  return {
    useAllBroadcasts,
    useBroadcast,
    useActiveBroadcast,
    useLiveBroadcasts,
    useUpcomingBroadcasts,
    createBroadcast: createBroadcastMutation,
    updateBroadcast: updateBroadcastMutation,
    startBroadcast: startBroadcastMutation,
    endBroadcast: endBroadcastMutation,
  };
}; 