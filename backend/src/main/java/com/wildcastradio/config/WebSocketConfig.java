package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

import com.wildcastradio.ShoutCast.AudioStreamHandler;

/**
 * WebSocket configuration for the application.
 * This handles both STOMP messaging for regular app communication and 
 * raw binary WebSocket for audio streaming.
 */
@Configuration
@EnableWebSocketMessageBroker
@EnableWebSocket
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer, WebSocketConfigurer {

    @Autowired
    private AudioStreamHandler audioStreamHandler;

    /**
     * Configure STOMP messaging endpoints
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    /**
     * Register STOMP endpoints
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-radio")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
    
    /**
     * Register raw WebSocket handlers for binary audio streaming
     */
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(audioStreamHandler, "/stream")
                .setAllowedOrigins("*");
    }
} 