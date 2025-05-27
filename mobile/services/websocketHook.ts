import { useEffect, useCallback } from 'react';
import { websocketService, WebSocketMessage } from './websocketService';
import { ChatMessageDTO, PollDTO } from './apiService';

interface UseWebSocketProps {
  broadcastId: number | null;
  authToken: string | null;
  onNewMessage?: (message: ChatMessageDTO) => void;
  onPollUpdate?: (poll: PollDTO) => void;
  onBroadcastUpdate?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export const useWebSocket = ({
  broadcastId,
  authToken,
  onNewMessage,
  onPollUpdate,
  onBroadcastUpdate,
  onConnect,
  onDisconnect,
  onError,
}: UseWebSocketProps) => {
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'chat':
        if (onNewMessage && message.data) {
          onNewMessage(message.data as ChatMessageDTO);
        }
        break;
      case 'poll':
        if (onPollUpdate && message.data) {
          onPollUpdate(message.data as PollDTO);
        }
        break;
      case 'broadcast_update':
        if (onBroadcastUpdate && message.data) {
          onBroadcastUpdate(message.data);
        }
        break;
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, [onNewMessage, onPollUpdate, onBroadcastUpdate]);

  const sendChatMessage = useCallback((content: string) => {
    // Send message in the format expected by the backend
    websocketService.sendMessage({
      content: content,
    });
  }, []);

  useEffect(() => {
    if (!broadcastId || !authToken) return;

    // Set up WebSocket handlers
    websocketService.onMessage(handleMessage);
    if (onConnect) websocketService.onConnect(onConnect);
    if (onDisconnect) websocketService.onDisconnect(onDisconnect);
    if (onError) websocketService.onError(onError);

    // Connect to WebSocket
    websocketService.connect(broadcastId, authToken);

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
      websocketService.removeHandlers();
    };
  }, [broadcastId, authToken, handleMessage, onConnect, onDisconnect, onError]);

  return {
    sendChatMessage,
    isConnected: websocketService !== null, // Note: This just checks if service exists, actual connection status is handled by callbacks
  };
}; 