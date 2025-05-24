package com.wildcastradio.config;

import com.wildcastradio.icecast.IcecastStreamHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * WebSocket configuration for the application.
 * Configures WebSocket endpoints for audio streaming.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    
    private final IcecastStreamHandler icecastStreamHandler;
    
    @Autowired
    public WebSocketConfig(IcecastStreamHandler icecastStreamHandler) {
        this.icecastStreamHandler = icecastStreamHandler;
    }
    
    /**
     * Configures WebSocket buffer sizes and timeouts
     */
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        // Set larger buffer sizes for audio data (64KB)
        container.setMaxBinaryMessageBufferSize(65536); 
        container.setMaxTextMessageBufferSize(65536);
        // Increase timeout to handle potential network delays
        container.setAsyncSendTimeout(30000L);
        return container;
    }
    
    /**
     * Register WebSocket handlers and configure allowed origins
     */
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(icecastStreamHandler, "/ws/live")
                .setAllowedOriginPatterns("*"); // Use patterns instead of origins for CORS compatibility
    }
}