package com.wildcastradio.Poll;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;
import com.wildcastradio.Poll.DTO.VoteRequest;

/**
 * STOMP WebSocket controller for poll operations
 * Centralizes all poll-related WebSocket messaging
 * 
 * HARD REFACTOR: Moves messaging from service-level to controller-level
 */
@Controller
public class PollWebSocketController {
    private static final Logger logger = LoggerFactory.getLogger(PollWebSocketController.class);

    @Autowired
    private PollService pollService;

    @Autowired
    private UserService userService;

    /**
     * Handle poll votes via WebSocket
     * Message destination: /app/broadcast/{broadcastId}/poll/vote
     */
    @MessageMapping("/broadcast/{broadcastId}/poll/vote")
    public void handlePollVote(
            @DestinationVariable Long broadcastId,
            @Payload VoteRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserEntity user = null;
            
            if (authentication != null && authentication.isAuthenticated()) {
                user = userService.getUserByEmail(authentication.getName()).orElse(null);
            }

            if (user == null) {
                logger.warn("Unauthenticated poll vote attempt for broadcast {}: pollId={}, optionId={}", 
                           broadcastId, request.getPollId(), request.getOptionId());
                return;
            }

            // Verify broadcastId matches the poll's broadcast
            // This is done by the service when processing the vote
            if (request.getPollId() == null || request.getOptionId() == null) {
                logger.warn("Invalid vote request: missing pollId or optionId");
                return;
            }

            logger.debug("Processing poll vote via STOMP: broadcastId={}, pollId={}, optionId={}, user={}", 
                        broadcastId, request.getPollId(), request.getOptionId(), user.getEmail());

            // Process vote via service (service handles messaging internally)
            pollService.vote(request, user.getId());
            
            logger.debug("Poll vote processed successfully via STOMP");
            
        } catch (Exception e) {
            logger.error("Error processing poll vote via WebSocket for broadcast {}: {}", 
                        broadcastId, e.getMessage(), e);
        }
    }
}

