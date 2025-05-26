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
    
    @Autowired
    public WebSocketConfig(IcecastStreamHandler icecastStreamHandler, 
                          ListenerStatusHandler listenerStatusHandler) {
        this.icecastStreamHandler = icecastStreamHandler;
        this.listenerStatusHandler = listenerStatusHandler;
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
        // Audio streaming endpoint for DJs
        registry.addHandler(icecastStreamHandler, "/ws/live")
                .setAllowedOriginPatterns("*"); // Use patterns instead of origins for CORS compatibility
        
        // Status updates endpoint for listeners  
        registry.addHandler(listenerStatusHandler, "/ws/listener")
                .setAllowedOriginPatterns("*");
    }
}