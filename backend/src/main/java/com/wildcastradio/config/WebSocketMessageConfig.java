package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
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

    @Autowired
    private CorsConfig corsConfig;

    @Autowired
    private WebSocketAuthInterceptor webSocketAuthInterceptor;

    @Autowired
    private WebSocketHandshakeAuthInterceptor handshakeAuthInterceptor;

    @Autowired
    private com.wildcastradio.ratelimit.WebSocketRateLimitHandshakeInterceptor rateLimitHandshakeInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-radio")
               .addInterceptors(handshakeAuthInterceptor, rateLimitHandshakeInterceptor)
               .setAllowedOrigins(corsConfig.getAllowedOrigins().toArray(new String[0]))
               .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketAuthInterceptor);
    }
} 