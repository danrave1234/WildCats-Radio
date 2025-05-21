package com.wildcastradio.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.messaging.MessageSecurityMetadataSourceRegistry;
import org.springframework.security.config.annotation.web.socket.AbstractSecurityWebSocketMessageBrokerConfigurer;

/**
 * WebSocket security configuration
 */
@Configuration
public class WebSocketSecurityConfig extends AbstractSecurityWebSocketMessageBrokerConfigurer {

    @Override
    protected void configureInbound(MessageSecurityMetadataSourceRegistry messages) {
        messages
            // Anyone can subscribe to public topics
            .simpSubscribeDestMatchers("/topic/**").permitAll()
            // Only authenticated users can send messages
            .simpDestMatchers("/app/**").authenticated()
            // Deny any other inbound messages by default
            .anyMessage().denyAll();
    }

    @Override
    protected boolean sameOriginDisabled() {
        // Disable CSRF for WebSocket connections
        // In production, you should use a more restrictive policy
        return true;
    }
} 