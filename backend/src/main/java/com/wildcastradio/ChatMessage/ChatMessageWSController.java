package com.wildcastradio.ChatMessage;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

/**
 * WebSocket controller for handling chat messages
 */
@Controller
public class ChatMessageWSController {

    private final ChatMessageService chatMessageService;
    private final UserService userService;
    private final SimpMessageSendingOperations messagingTemplate;

    @Autowired
    public ChatMessageWSController(
            ChatMessageService chatMessageService,
            UserService userService,
            SimpMessageSendingOperations messagingTemplate) {
        this.chatMessageService = chatMessageService;
        this.userService = userService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * WebSocket endpoint for sending a chat message
     * 
     * @param broadcastId The ID of the broadcast
     * @param chatMessage The message content
     * @param headerAccessor Header information with security context
     */
    @MessageMapping("/chat/{broadcastId}")
    public void sendMessage(
            @DestinationVariable Long broadcastId,
            @Payload ChatMessageRequest chatMessage,
            SimpMessageHeaderAccessor headerAccessor) {
        
        // Get user from the WebSocket session
        Authentication authentication = (Authentication) headerAccessor.getUser();
        if (authentication == null) {
            return; // Unauthenticated requests are ignored
        }
        
        UserEntity sender = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Create and save the message using existing service
        chatMessageService.createMessage(
                broadcastId,
                sender,
                chatMessage.getContent()
        );
        // Note: The message is broadcast by chatMessageService.createMessage
    }
} 