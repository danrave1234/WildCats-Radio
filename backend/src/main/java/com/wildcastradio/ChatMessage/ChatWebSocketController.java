package com.wildcastradio.ChatMessage;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

/**
 * WebSocket controller for handling chat messages via STOMP
 */
@Controller
public class ChatWebSocketController {

    @Autowired
    private ChatMessageService chatMessageService;

    @Autowired
    private UserService userService;

    /**
     * Handle chat messages sent via WebSocket
     * 
     * @param broadcastId The ID of the broadcast
     * @param message The chat message payload
     * @param headerAccessor Headers for the message
     */
    @MessageMapping("/broadcast/{broadcastId}/chat")
    public void handleChatMessage(
            @DestinationVariable String broadcastId,
            @Payload ChatMessageWebSocketRequest message,
            SimpMessageHeaderAccessor headerAccessor) {

        System.out.println("Received WebSocket chat message for broadcast: " + broadcastId);
        System.out.println("Message content: " + message.getContent());
        System.out.println("Headers: " + headerAccessor.getSessionAttributes());

        try {
            // Parse broadcast ID
            Long parsedBroadcastId = Long.parseLong(broadcastId);
            
            // Get the authenticated user from Spring Security context
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserEntity sender = null;
            
            if (authentication != null && authentication.isAuthenticated()) {
                String userEmail = authentication.getName();
                System.out.println("Authenticated user: " + userEmail);
                sender = userService.getUserByEmail(userEmail).orElse(null);
            } else {
                System.out.println("No authentication found in SecurityContext");
            }

            // If no sender found, try to get from header
            if (sender == null) {
                String userEmail = headerAccessor.getUser() != null ? 
                    headerAccessor.getUser().getName() : null;
                
                if (userEmail != null) {
                    System.out.println("User from header: " + userEmail);
                    sender = userService.getUserByEmail(userEmail).orElse(null);
                } else {
                    System.out.println("No user found in header");
                }
            }

            // If still no sender found, create anonymous message or return
            if (sender == null) {
                System.err.println("No authenticated user found for chat message");
                return;
            }

            System.out.println("Creating chat message with sender: " + sender.getEmail());

            // Create the chat message
            chatMessageService.createMessage(parsedBroadcastId, sender, message.getContent());

        } catch (NumberFormatException e) {
            // Invalid broadcast ID format
            System.err.println("Invalid broadcast ID format: " + broadcastId);
        } catch (Exception e) {
            // Handle other errors
            System.err.println("Error processing chat message: " + e.getMessage());
            e.printStackTrace();
        }
    }
}

/**
 * WebSocket request payload for chat messages
 */
class ChatMessageWebSocketRequest {
    private String content;
    private String message; // Alternative field name for compatibility

    public String getContent() {
        return content != null ? content : message;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
} 