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
            @DestinationVariable Long broadcastId,
            @Payload BroadcastWebSocketMessage message,
            SimpMessageHeaderAccessor headerAccessor) {

        // Get the authenticated user if available
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserEntity user = null;

        if (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser")) {
            user = userService.getUserByEmail(authentication.getName())
                    .orElse(null);
        }

        // Record the listener joining (could update analytics)
        broadcastService.recordListenerJoin(broadcastId, user);

        // Get the broadcast info to return
        Optional<BroadcastEntity> broadcastOpt = broadcastService.getBroadcastById(broadcastId);
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
            @DestinationVariable Long broadcastId,
            @Payload BroadcastWebSocketMessage message,
            SimpMessageHeaderAccessor headerAccessor) {

        // Get the authenticated user if available
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserEntity user = null;

        if (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser")) {
            user = userService.getUserByEmail(authentication.getName())
                    .orElse(null);
        }

        // Record the listener leaving (could update analytics)
        broadcastService.recordListenerLeave(broadcastId, user);
    }

    // Additional WebSocket handling methods can be added here as needed
} 
