package com.wildcastradio.config;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.converter.DefaultContentTypeResolver;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.MessageConverter;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.handler.ExceptionWebSocketHandlerDecorator;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import com.wildcastradio.ShoutCast.AudioStreamHandler;

/**
 * Configuration for WebSocket communication.
 * Sets up both raw WebSocket handlers and STOMP messaging endpoints.
 */
@Configuration
@EnableWebSocket
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketConfigurer, WebSocketMessageBrokerConfigurer {

    private final AudioStreamHandler audioStreamHandler;
    private static final Logger logger = LoggerFactory.getLogger(WebSocketConfig.class);
    
    // Inject the sessionIdInterceptor
    private final ChannelInterceptor sessionIdInterceptor;

    // Array of allowed origins
    private static final String[] ALLOWED_ORIGINS = {
        "http://localhost:5173", 
        "http://localhost:5174",
        "http://localhost:3000", 
        "https://wildcat-radio-f05d362144e6.herokuapp.com",
        "https://wildcat-radio.vercel.app"
        // Add any additional origins as needed
    };

    /**
     * Constructor-based dependency injection
     */
    public WebSocketConfig(AudioStreamHandler audioStreamHandler, ChannelInterceptor sessionIdInterceptor) {
        this.audioStreamHandler = audioStreamHandler;
        this.sessionIdInterceptor = sessionIdInterceptor;
    }

    /**
     * Configure raw WebSocket endpoints
     */
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        logger.info("Registering WebSocket handlers with allowed origins: {}", String.join(", ", ALLOWED_ORIGINS));

        // Wrap the handler with exception handling decorator
        WebSocketHandler decoratedHandler = new ExceptionWebSocketHandlerDecorator(audioStreamHandler);

        // Configure with maximum compatibility for different browser environments
        registry.addHandler(decoratedHandler, "/stream")
               .setAllowedOrigins("*") // Allow all origins for audio streaming
               .withSockJS()
               .setHeartbeatTime(25000)
               .setDisconnectDelay(30000)
               .setSessionCookieNeeded(false);
               
        // Also add a direct WebSocket endpoint without SockJS for maximum compatibility
        registry.addHandler(decoratedHandler, "/stream")
               .setAllowedOrigins("*"); // Allow all origins for audio streaming
    }

    /**
     * Configure STOMP messaging broker
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Enable simple broker to relay messages to clients
        registry.enableSimpleBroker("/topic", "/queue")
               .setHeartbeatValue(new long[] {10000, 10000}) // Set heartbeat every 10 seconds for server and client
               .setTaskScheduler(heartbeatScheduler()); // Use a dedicated task scheduler for reliable heartbeats

        // Set prefix for client-to-server messages
        registry.setApplicationDestinationPrefixes("/app");
    }

    /**
     * Configure client inbound channel to handle exceptions gracefully
     */
    @Override
    public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                try {
                    // Check if message headers contain trace IDs that might cause issues
                    if (message.getHeaders().containsKey("spanTraceId") || 
                        message.getHeaders().containsKey("spanId") || 
                        message.getHeaders().containsKey("spanSampled")) {
                        
                        // Create a mutable copy of the headers to avoid UnsupportedOperationException
                        MessageHeaderAccessor accessor = MessageHeaderAccessor.getMutableAccessor(message);
                        
                        // Remove problematic trace headers
                        try {
                            accessor.removeHeader("spanTraceId");
                            accessor.removeHeader("spanId");
                            accessor.removeHeader("spanSampled");
                            
                            // Don't try to use removeNativeHeader method which isn't available
                            
                            // Create a new message with cleaned headers
                            return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
                        } catch (Exception e) {
                            // If we can't modify headers, log and continue
                            logger.debug("Could not remove trace headers: {}", e.getMessage());
                        }
                    }
                    
                    // Log connection issues or errors in debug mode
                    if (logger.isDebugEnabled()) {
                        logger.debug("Processing inbound message: {}", message.getHeaders().getId());
                    }
                    return message;
                } catch (Exception e) {
                    logger.error("Error processing inbound message", e);
                    return message;
                }
            }

            @Override
            public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent, Exception ex) {
                if (ex != null) {
                    // Check for specific exception type related to trace headers
                    if (ex instanceof UnsupportedOperationException && 
                        ex.getMessage() != null && 
                        ex.getMessage().contains("remove")) {
                        // This is likely the issue with removing headers from unmodifiable map
                        logger.debug("Expected exception during header removal (connection likely closed): {}", ex.getMessage());
                    } else if (ex instanceof MessageDeliveryException) {
                        // Message delivery failures are expected when clients disconnect
                        logger.debug("Message delivery failed (client likely disconnected): {}", ex.getMessage());
                    } else {
                        // Improved error logging with more context
                        logger.warn("Exception in client inbound channel: {} - {}. Headers: {}", 
                            ex.getClass().getSimpleName(), ex.getMessage(), message.getHeaders());
                        
                        // Log the full stack trace only at debug level
                        if (logger.isDebugEnabled()) {
                            logger.debug("Full exception details:", ex);
                        }
                    }
                }
            }
        });

        // Increase thread pool size for better concurrency handling
        registration.taskExecutor()
            .corePoolSize(4)
            .maxPoolSize(10)
            .queueCapacity(50); // Add a queue to buffer messages during high load
    }

    /**
     * Configure client outbound channel to handle exceptions gracefully
     */
    @Override
    public void configureClientOutboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(sessionIdInterceptor);
        
        // Increase thread pool size for better concurrency handling
        registration.taskExecutor()
            .corePoolSize(4)
            .maxPoolSize(10)
            .queueCapacity(50) // Add a queue to buffer messages during high load
            .keepAliveSeconds(60); // Keep threads alive for 60 seconds to handle bursts
    }

    /**
     * Dedicated scheduler for WebSocket heartbeats
     */
    @Bean
    public TaskScheduler heartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);  // Increased pool size for better reliability
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(5);
        scheduler.setErrorHandler(t -> {
            logger.error("Error in heartbeat scheduler", t);
        });
        scheduler.initialize();
        return scheduler;
    }

    /**
     * Configure STOMP endpoints
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        logger.info("Registering STOMP endpoints with allowed origins: {}", String.join(", ", ALLOWED_ORIGINS));

        registry.addEndpoint("/ws-radio")
               .setAllowedOrigins(ALLOWED_ORIGINS)
               .withSockJS()
               // Enable transport fallbacks for reliability
               .setWebSocketEnabled(true)
               // Ensure XHR streaming is enabled for fallback
               .setDisconnectDelay(15 * 1000) // 15 seconds disconnect delay
               .setHeartbeatTime(10 * 1000)   // 10 seconds heartbeat
               .setSuppressCors(false) // Enable CORS support
               .setSessionCookieNeeded(false) // Don't use cookies for session tracking
               .setClientLibraryUrl("https://cdn.jsdelivr.net/npm/sockjs-client@1.6.1/dist/sockjs.min.js"); // Use a reliable CDN
    }

    /**
     * Configure WebSocket container for performance
     */
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(8192);
        container.setMaxBinaryMessageBufferSize(1024 * 1024); // 1MB max message size for audio data
        container.setMaxSessionIdleTimeout(3600000L); // 1 hour timeout
        container.setAsyncSendTimeout(30000L); // 30 seconds send timeout
        return container;
    }

    /**
     * Configure message converters 
     */
    @Override
    public boolean configureMessageConverters(List<MessageConverter> messageConverters) {
        // Add a custom message converter that ensures session ID is preserved in messages
        DefaultContentTypeResolver resolver = new DefaultContentTypeResolver();
        resolver.setDefaultMimeType(MimeTypeUtils.APPLICATION_JSON);

        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setContentTypeResolver(resolver);
        
        // Configure special handling for outbound messages
        converter.setStrictContentTypeMatch(false);
        
        messageConverters.add(converter);
        
        // Return false to also register the default converters
        return false;
    }
}
