// Main API service with all HTTP endpoints
export * from './apiService';

// Specialized services that follow frontend pattern
export { chatService } from './chatService';
export { songRequestService } from './songRequestService';
export { pollService } from './pollService';
export { notificationService } from './notificationService';

// WebSocket services
export { websocketService } from './websocketService';
export { useWebSocket } from './websocketHook';

// Service instances for direct import
export { default as chatServiceInstance } from './chatService';
export { default as songRequestServiceInstance } from './songRequestService';
export { default as pollServiceInstance } from './pollService'; 