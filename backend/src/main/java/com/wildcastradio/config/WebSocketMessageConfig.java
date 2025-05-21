package com.wildcastradio.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.support.AbstractSubscribableChannel;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.ExecutorSubscribableChannel;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Configuration for WebSocket messaging to ensure that SimpMessagingTemplate 
 * is properly initialized and available for injection.
 */
@Configuration
public class WebSocketMessageConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(WebSocketMessageConfig.class);

    /**
     * Creates a robust channel that can recover from exceptions during message handling
     */
    @Bean
    public AbstractSubscribableChannel clientOutboundChannel() {
        ExecutorSubscribableChannel channel = new ExecutorSubscribableChannel(clientOutboundChannelExecutor());
        
        // Add interceptor for error handling instead of using setErrorHandler
        channel.addInterceptor(new ChannelInterceptor() {
            @Override
            public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent, Exception ex) {
                if (ex != null) {
                    if (ex instanceof MessageDeliveryException) {
                        // Expected when clients disconnect, just log at debug level
                        logger.debug("Message delivery failed (client likely disconnected): {}", ex.getMessage());
                    } else {
                        // Unexpected errors logged at warning level
                        logger.warn("Error in client outbound channel: {}", ex.getMessage());
                        
                        // Only log full stack trace at debug level
                        if (logger.isDebugEnabled()) {
                            logger.debug("Full exception: ", ex);
                        }
                    }
                }
            }
        });
        
        return channel;
    }
    
    /**
     * Dedicated thread pool for outbound messages
     */
    @Bean
    public ThreadPoolTaskExecutor clientOutboundChannelExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("ws-outbound-");
        executor.setAllowCoreThreadTimeOut(true);
        executor.setKeepAliveSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * Creates a messaging template bean to be used for broadcasting messages.
     * This ensures SimpMessagingTemplate is available even before WebSocketConfig is initialized.
     * Now uses the robust channel with error handling for disconnection resilience.
     */
    @Bean
    @Primary
    public SimpMessageSendingOperations messagingTemplate() {
        SimpMessagingTemplate template = new SimpMessagingTemplate(clientOutboundChannel());
        
        // Custom behavior for handling headers to avoid issues with Spring Cloud Sleuth
        template.setHeaderInitializer(headerAccessor -> {
            // Clean any trace headers that might cause problems with closed connections
            if (headerAccessor instanceof MessageHeaderAccessor) {
                try {
                    MessageHeaderAccessor accessor = (MessageHeaderAccessor) headerAccessor;
                    // Remove potentially problematic headers
                    accessor.setHeader("spanTraceId", null);
                    accessor.setHeader("spanId", null);
                    accessor.setHeader("spanSampled", null);
                } catch (Exception e) {
                    // Ignore - these are non-critical headers
                    logger.trace("Could not clean trace headers: {}", e.getMessage());
                }
            }
        });
        
        return template;
    }
} 
