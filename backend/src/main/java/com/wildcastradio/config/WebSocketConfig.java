package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import com.wildcastradio.icecast.IcecastStreamHandler;
import com.wildcastradio.icecast.ListenerStatusHandler;

/**
 * WebSocket configuration for the application.
 * Configures WebSocket endpoints for audio streaming and listener status updates.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    
    private final IcecastStreamHandler icecastStreamHandler;
    private final ListenerStatusHandler listenerStatusHandler;
    private final CorsConfig corsConfig;
    private final WebSocketHandshakeAuthInterceptor handshakeAuthInterceptor;
    private final com.wildcastradio.ratelimit.WebSocketRateLimitHandshakeInterceptor rateLimitHandshakeInterceptor;
    
    @Autowired
    public WebSocketConfig(IcecastStreamHandler icecastStreamHandler, 
                          ListenerStatusHandler listenerStatusHandler,
                          CorsConfig corsConfig,
                          WebSocketHandshakeAuthInterceptor handshakeAuthInterceptor,
                          com.wildcastradio.ratelimit.WebSocketRateLimitHandshakeInterceptor rateLimitHandshakeInterceptor) {
        this.icecastStreamHandler = icecastStreamHandler;
        this.listenerStatusHandler = listenerStatusHandler;
        this.corsConfig = corsConfig;
        this.handshakeAuthInterceptor = handshakeAuthInterceptor;
        this.rateLimitHandshakeInterceptor = rateLimitHandshakeInterceptor;
    }
    
    /**
     * Configures WebSocket buffer sizes and timeouts for optimal performance
     */
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();

        // Optimized buffer sizes for audio streaming
        container.setMaxBinaryMessageBufferSize(262144); // 256KB - increased for better audio streaming
        container.setMaxTextMessageBufferSize(65536);    // 64KB - sufficient for text messages

        // Connection optimization settings
        container.setAsyncSendTimeout(20000L);           // 20s - balanced timeout
        container.setMaxSessionIdleTimeout(300000L);     // 5 minutes - reasonable session timeout

        return container;
    }
    
    /**
     * Register WebSocket handlers and configure allowed origins
     */
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Audio streaming endpoint for DJs
        registry.addHandler(icecastStreamHandler, "/ws/live")
                .addInterceptors(handshakeAuthInterceptor, rateLimitHandshakeInterceptor)
                .setAllowedOrigins(corsConfig.getAllowedOrigins().toArray(new String[0]));
        
        // Status updates endpoint for listeners  
        registry.addHandler(listenerStatusHandler, "/ws/listener")
                .addInterceptors(handshakeAuthInterceptor, rateLimitHandshakeInterceptor)
                .setAllowedOrigins(corsConfig.getAllowedOrigins().toArray(new String[0]));
    }
}