package com.wildcastradio.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * WebSocket configuration for real-time communication.
 * Configures STOMP messaging and SockJS fallback support.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable a simple in-memory message broker for broadcasting to clients
        // Messages with these prefixes will be routed to the broker
        config.enableSimpleBroker("/topic", "/queue", "/user");
        
        // Messages with this prefix will be routed to @MessageMapping methods
        config.setApplicationDestinationPrefixes("/app");
        
        // Configure user destination prefix for user-specific messages
        config.setUserDestinationPrefix("/user");
        
        // Note: Heartbeat is handled by SockJS configuration in the endpoint registry
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Register STOMP endpoints with SockJS fallback
        registry.addEndpoint("/ws/live")
                .setAllowedOriginPatterns("*") 
                .withSockJS()
                .setHeartbeatTime(25000)  // Heartbeat every 25 seconds
                .setDisconnectDelay(5000) // Wait 5 seconds before considering session closed
                .setClientLibraryUrl("https://cdn.jsdelivr.net/npm/sockjs-client@1.5.1/dist/sockjs.min.js");
        
        registry.addEndpoint("/ws-radio")
                .setAllowedOriginPatterns("*")
                .withSockJS()
                .setHeartbeatTime(25000)
                .setDisconnectDelay(5000)
                .setClientLibraryUrl("https://cdn.jsdelivr.net/npm/sockjs-client@1.5.1/dist/sockjs.min.js");
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // Configure message size limits
        registration.setMessageSizeLimit(128 * 1024);       // 128KB
        registration.setSendBufferSizeLimit(512 * 1024);    // 512KB
        registration.setSendTimeLimit(20 * 1000);           // 20 seconds
    }
    
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        // Set buffer sizes and timeouts for better performance
        container.setMaxTextMessageBufferSize(8192);
        container.setMaxBinaryMessageBufferSize(8192);
        container.setMaxSessionIdleTimeout(60000L); // 1 minute
        container.setAsyncSendTimeout(5000L);       // 5 seconds
        return container;
    }
}