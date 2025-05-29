package com.wildcastradio.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket STOMP messaging configuration
 * This is separate from the WebSocket streaming configuration and handles notifications
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketMessageConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-radio")
               .setAllowedOrigins(
                   "http://localhost:3000",   // React development server
                   "http://localhost:5173",   // Vite development server  
                   "http://127.0.0.1:3000",
                   "http://127.0.0.1:5173",
                   "https://wildcat-radio-f05d362144e6.herokuapp.com",
                   "https://wildcat-radio.vercel.app",
                   "https://wildcat-radio-f05d362144e6.autoidleapp.com",
                   "https://wildcat-radio.live"  // New production domain
               )
               .withSockJS();
    }
} 