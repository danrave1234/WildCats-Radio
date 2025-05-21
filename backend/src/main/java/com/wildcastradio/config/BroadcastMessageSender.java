package com.wildcastradio.config;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.stereotype.Component;

/**
 * Helper class for broadcasting messages to WebSocket topics
 * with proper session handling to avoid common errors
 */
@Component
public class BroadcastMessageSender {
    
    private static final Logger logger = LoggerFactory.getLogger(BroadcastMessageSender.class);
    
    @Autowired
    private SimpMessageSendingOperations messagingTemplate;
    
    /**
     * Safely broadcast a message to a topic
     * Handles the "Could not find session id" error by using a synthetic session ID
     * 
     * @param destination The destination topic to send to
     * @param payload The message payload to send
     * @return true if successful, false otherwise
     */
    public boolean broadcastToTopic(String destination, Object payload) {
        try {
            // Create special headers with a synthetic session ID for broadcast messages
            SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
            headerAccessor.setLeaveMutable(true);
            headerAccessor.setSessionId("broadcast-" + UUID.randomUUID().toString());
            
            // Add custom header to mark this as a broadcast message
            headerAccessor.setHeader("isBroadcast", true);
            
            // Remove any trace headers that might cause issues
            headerAccessor.setHeader("spanTraceId", null);
            headerAccessor.setHeader("spanId", null);
            headerAccessor.setHeader("spanSampled", null);
            
            // Send the message with our custom headers
            messagingTemplate.convertAndSend(destination, payload, headerAccessor.getMessageHeaders());
            
            return true;
        } catch (MessageDeliveryException e) {
            logger.debug("Message delivery failed (normal for disconnected clients): {}", e.getMessage());
            return false;
        } catch (Exception e) {
            logger.warn("Error broadcasting message to {}: {}", destination, e.getMessage());
            return false;
        }
    }
    
    /**
     * Send a message to a specific user's queue
     * 
     * @param user The username or principal name
     * @param destination The destination (without the /user/ prefix)
     * @param payload The payload to send
     * @return true if successful, false otherwise
     */
    public boolean sendToUser(String user, String destination, Object payload) {
        try {
            messagingTemplate.convertAndSendToUser(user, destination, payload);
            return true;
        } catch (Exception e) {
            logger.warn("Error sending message to user {}: {}", user, e.getMessage());
            return false;
        }
    }
} 