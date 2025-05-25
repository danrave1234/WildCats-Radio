import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../endpoints/chatService';
import { SendChatMessageRequest } from '../types';

export const useChat = () => {
  const queryClient = useQueryClient();

  // Get chat messages for a broadcast
  const useBroadcastMessages = (broadcastId: number, enabled = true) => {
    return useQuery({
      queryKey: ['chats', broadcastId],
      queryFn: () => chatService.getBroadcastMessages(broadcastId),
      enabled: !!broadcastId && enabled,
      // Poll for new messages every 5 seconds
      refetchInterval: 5000,
    });
  };

  // Send chat message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ broadcastId, data }: { broadcastId: number; data: SendChatMessageRequest }) => 
      chatService.sendMessage(broadcastId, data),
    onSuccess: (_, variables) => {
      // Invalidate chat messages query to refetch
      queryClient.invalidateQueries({ queryKey: ['chats', variables.broadcastId] });
    },
  });

  return {
    useBroadcastMessages,
    sendMessage: sendMessageMutation,
  };
}; 