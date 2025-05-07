package com.wildcastradio.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
public class WebSocketConfigTest {

    @Autowired
    private WebSocketConfig webSocketConfig;

    @Test
    public void testWebSocketConfigExists() {
        assertNotNull(webSocketConfig, "WebSocketConfig should be autowired");
    }

    @Test
    public void testConfigureMessageBroker() {
        // This is more of a verification that the method doesn't throw exceptions
        MessageBrokerRegistry registry = new MessageBrokerRegistry();
        webSocketConfig.configureMessageBroker(registry);
        // If no exception is thrown, the test passes
    }

    @Test
    public void testRegisterStompEndpoints() {
        // This is more of a verification that the method doesn't throw exceptions
        StompEndpointRegistry registry = new StompEndpointRegistry();
        webSocketConfig.registerStompEndpoints(registry);
        // If no exception is thrown, the test passes
    }
}