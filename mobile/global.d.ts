/// <reference types="nativewind/types" /> 

// Lightweight module declarations for SockJS/STOMP to avoid TS errors on mobile
declare module 'sockjs-client' {
  const SockJS: any;
  export default SockJS;
}

declare module '@stomp/stompjs' {
  export const Stomp: any;
  export type StompSubscription = any;
}