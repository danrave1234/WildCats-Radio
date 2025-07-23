package com.wildcastradio.Broadcast;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;

import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

/**
 * Controller for handling WebSocket messages related to broadcasts
 */
@Controller
public class BroadcastWebSocketController {

    @Autowired
    private BroadcastService broadcastService;

    @Autowired
    private UserService userService;

    /**
     * Handle listener joining a broadcast
     * 
     * @param broadcastId The ID of the broadcast
     * @param message The message payload
     * @param headerAccessor Headers for the message
     * @return The acknowledgment message
     */
    @MessageMapping("/broadcast/{broadcastId}/join")
    public BroadcastWebSocketMessage joinBroadcast(
            @DestinationVariable String broadcastId,
            @Payload BroadcastWebSocketMessage message,
            SimpMessageHeaderAccessor headerAccessor) {

        // Validate broadcastId - handle null, "null", or invalid values
        if (broadcastId == null || "null".equals(broadcastId) || broadcastId.trim().isEmpty()) {
            // For null or invalid broadcast IDs, return a generic acknowledgment
            // This handles cases where frontend sends null for global subscriptions
            return new BroadcastWebSocketMessage("JOIN_ACK", (BroadcastDTO) null);
        }

        Long parsedBroadcastId;
        try {
            parsedBroadcastId = Long.parseLong(broadcastId);
        } catch (NumberFormatException e) {
            // Invalid broadcast ID format, return error acknowledgment
            BroadcastWebSocketMessage errorMessage = new BroadcastWebSocketMessage("JOIN_ERROR", (Long) null);
            errorMessage.setData("Invalid broadcast ID format");
            return errorMessage;
        }

        // Get the authenticated user if available
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserEntity user = null;

        if (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser")) {
            user = userService.getUserByEmail(authentication.getName())
                    .orElse(null);
        }

        // Record the listener joining (could update analytics)
        broadcastService.recordListenerJoin(parsedBroadcastId, user);

        // Get the broadcast info to return
        Optional<BroadcastEntity> broadcastOpt = broadcastService.getBroadcastById(parsedBroadcastId);
        BroadcastDTO broadcastDTO = null;

        if (broadcastOpt.isPresent()) {
            broadcastDTO = BroadcastDTO.fromEntity(broadcastOpt.get());
        }

        // Return acknowledgment
        return new BroadcastWebSocketMessage("JOIN_ACK", broadcastDTO);
    }

    /**
     * Handle listener leaving a broadcast
     * 
     * @param broadcastId The ID of the broadcast
     * @param message The message payload
     * @param headerAccessor Headers for the message
     */
    @MessageMapping("/broadcast/{broadcastId}/leave")
    public void leaveBroadcast(
            @DestinationVariable String broadcastId,
            @Payload BroadcastWebSocketMessage message,
            SimpMessageHeaderAccessor headerAccessor) {

        // Validate broadcastId - handle null, "null", or invalid values
        if (broadcastId == null || "null".equals(broadcastId) || broadcastId.trim().isEmpty()) {
            // For null or invalid broadcast IDs, silently ignore the leave request
            // This handles cases where frontend sends null for global subscriptions
            return;
        }

        Long parsedBroadcastId;
        try {
            parsedBroadcastId = Long.parseLong(broadcastId);
        } catch (NumberFormatException e) {
            // Invalid broadcast ID format, silently ignore
            return;
        }

        // Get the authenticated user if available
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserEntity user = null;

        if (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser")) {
            user = userService.getUserByEmail(authentication.getName())
                    .orElse(null);
        }

        // Record the listener leaving (could update analytics)
        broadcastService.recordListenerLeave(parsedBroadcastId, user);
    }

    // Additional WebSocket handling methods can be added here as needed
} 
