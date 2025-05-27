import { useEffect, useCallback, useRef, useState } from 'react';
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
  
  const [isConnected, setIsConnected] = useState(false);
  const callbacksRef = useRef({
    onNewMessage,
    onPollUpdate,
    onBroadcastUpdate,
    onConnect,
    onDisconnect,
    onError,
  });

  // Update callbacks ref without triggering reconnection
  useEffect(() => {
    callbacksRef.current = {
      onNewMessage,
      onPollUpdate,
      onBroadcastUpdate,
      onConnect,
      onDisconnect,
      onError,
    };
  }, [onNewMessage, onPollUpdate, onBroadcastUpdate, onConnect, onDisconnect, onError]);
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    const callbacks = callbacksRef.current;
    switch (message.type) {
      case 'chat':
        if (callbacks.onNewMessage && message.data) {
          callbacks.onNewMessage(message.data as ChatMessageDTO);
        }
        break;
      case 'poll':
        if (callbacks.onPollUpdate && message.data) {
          callbacks.onPollUpdate(message.data as PollDTO);
        }
        break;
      case 'broadcast_update':
        if (callbacks.onBroadcastUpdate && message.data) {
          callbacks.onBroadcastUpdate(message.data);
        }
        break;
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, []);

  const handleConnect = useCallback(() => {
    console.log('🟢 WebSocket connected successfully');
    setIsConnected(true);
    const callbacks = callbacksRef.current;
    if (callbacks.onConnect) {
      callbacks.onConnect();
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('🔴 WebSocket disconnected');
    setIsConnected(false);
    const callbacks = callbacksRef.current;
    if (callbacks.onDisconnect) {
      callbacks.onDisconnect();
    }
  }, []);

  const handleError = useCallback((error: Event) => {
    console.error('❌ WebSocket error:', error);
    setIsConnected(false);
    const callbacks = callbacksRef.current;
    if (callbacks.onError) {
      callbacks.onError(error);
    }
  }, []);

  const sendChatMessage = useCallback((content: string) => {
    try {
      // Send message in the format expected by the backend
      websocketService.sendMessage({
        content: content,
      });
      console.log('✅ Chat message sent via WebSocket:', content);
      return true;
    } catch (error) {
      console.error('❌ Failed to send chat message via WebSocket:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!broadcastId || !authToken) {
      // Clean up if no broadcast or auth
      websocketService.disconnect();
      websocketService.removeHandlers();
      setIsConnected(false);
      return;
    }

    console.log('🔄 Setting up WebSocket connection for broadcast:', broadcastId);

    // Set up WebSocket handlers (only once per connection)
    websocketService.onMessage(handleMessage);
    websocketService.onConnect(handleConnect);
    websocketService.onDisconnect(handleDisconnect);
    websocketService.onError(handleError);

    // Connect to WebSocket
    websocketService.connect(broadcastId, authToken);

    // Cleanup on unmount or when dependencies change
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      websocketService.disconnect();
      websocketService.removeHandlers();
      setIsConnected(false);
    };
  }, [broadcastId, authToken]); // Only reconnect when broadcastId or authToken changes

  return {
    sendChatMessage,
    isConnected,
  };
}; 