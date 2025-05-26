package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.security.config.annotation.web.messaging.MessageSecurityMetadataSourceRegistry;
import org.springframework.security.config.annotation.web.socket.AbstractSecurityWebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

@Configuration
@EnableWebSocketMessageBroker
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketSecurityConfig extends AbstractSecurityWebSocketMessageBrokerConfigurer implements WebSocketMessageBrokerConfigurer {

    @Autowired
    private WebSocketAuthHandshakeInterceptor webSocketAuthHandshakeInterceptor;

    /**
     * Configure how the STOMP messages should be secured
     * This configuration ensures all WebSocket endpoints can be accessed with minimal security restrictions
     */
    @Override
    protected void configureInbound(MessageSecurityMetadataSourceRegistry messages) {
        messages
            // Allow anyone to connect to our application
            .nullDestMatcher().permitAll()
            // Allow any subscription
            .simpSubscribeDestMatchers("/topic/**").permitAll()
            .simpSubscribeDestMatchers("/queue/**").permitAll()
            // Allow any message
            .simpDestMatchers("/app/**").permitAll()
            // All other messages require authentication
            .anyMessage().authenticated();
    }

    /**
     * Disable CSRF for WebSockets - this is necessary for SockJS to work with various transports
     * Without this, you'll get Access Denied exceptions when using non-WebSocket transports
     */
    @Override
    protected boolean sameOriginDisabled() {
        return true;
    }
    
    /**
     * Configure the WebSocket endpoints with STOMP
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/live", "/ws/listener", "/ws-radio")
                .setAllowedOriginPatterns("*")
                .addInterceptors(webSocketAuthHandshakeInterceptor)
                .withSockJS()
                .setHeartbeatTime(25000) // Increase heartbeat interval
                .setDisconnectDelay(5000) // Reduce disconnect delay for faster recovery
                .setStreamBytesLimit(512 * 1024) // 512KB
                .setHttpMessageCacheSize(1000)
                .setWebSocketEnabled(true) // Ensure WebSocket transport is preferred
                .setSessionCookieNeeded(false); // Don't require JSESSIONID cookies
    }
    
    /**
     * Configure message broker settings
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{10000, 10000}) // 10 seconds heartbeat
                .setTaskScheduler(new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler() {{
                    setPoolSize(1);
                    setThreadNamePrefix("ws-heartbeat-");
                    initialize();
                }});
    }
} 