package com.wildcastradio.config;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;

/**
 * Configuration to improve WebSocket session handling
 */
@Configuration
public class WebSocketCustomConfigurator {
    
    private static final Logger logger = LoggerFactory.getLogger(WebSocketCustomConfigurator.class);
    
    /**
     * Create a channel interceptor that adds synthetic session IDs for broadcast messages
     * This is a simpler approach than trying to override the SubProtocolWebSocketHandler
     */
    @Bean
    @Primary
    public ChannelInterceptor sessionIdInterceptor() {
        return new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                MessageHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, MessageHeaderAccessor.class);
                
                if (accessor != null) {
                    // Check if this is a message to a topic but missing session ID
                    if (accessor.getMessageHeaders().containsKey("simpDestination") && 
                        !accessor.getMessageHeaders().containsKey("simpSessionId")) {
                        
                        String destination = accessor.getMessageHeaders().get("simpDestination", String.class);
                        if (destination != null && 
                            (destination.startsWith("/topic/") || destination.startsWith("/queue/"))) {
                            
                            // This is a broadcast message - add a synthetic session ID
                            SimpMessageHeaderAccessor newAccessor = SimpMessageHeaderAccessor.wrap(message);
                            newAccessor.setLeaveMutable(true);
                            newAccessor.setSessionId("broadcast-" + UUID.randomUUID().toString());
                            
                            message = MessageBuilder.createMessage(message.getPayload(), newAccessor.getMessageHeaders());
                            logger.debug("Added synthetic session ID to broadcast message to {}", destination);
                        }
                    }
                }
                
                return message;
            }
        };
    }
} 