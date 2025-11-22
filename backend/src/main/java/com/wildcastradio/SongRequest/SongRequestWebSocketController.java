package com.wildcastradio.SongRequest;

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

/**
 * STOMP WebSocket controller for song request operations
 * Centralizes all song request-related WebSocket messaging
 * 
 * HARD REFACTOR: Moves messaging from service-level to controller-level
 */
@Controller
public class SongRequestWebSocketController {
    private static final Logger logger = LoggerFactory.getLogger(SongRequestWebSocketController.class);

    @Autowired
    private SongRequestService songRequestService;

    @Autowired
    private UserService userService;

    /**
     * Handle song request creation via WebSocket
     * Message destination: /app/broadcast/{broadcastId}/song-request/create
     */
    @MessageMapping("/broadcast/{broadcastId}/song-request/create")
    public void handleSongRequestCreate(
            @DestinationVariable Long broadcastId,
            @Payload SongRequestCreateMessage request,
            SimpMessageHeaderAccessor headerAccessor) {
        
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserEntity user = null;
            
            if (authentication != null && authentication.isAuthenticated()) {
                user = userService.getUserByEmail(authentication.getName()).orElse(null);
            }

            if (user == null) {
                logger.warn("Unauthenticated song request attempt for broadcast {}: songTitle={}, artist={}", 
                           broadcastId, request.getSongTitle(), request.getArtist());
                return;
            }

            if (request.getSongTitle() == null || request.getSongTitle().trim().isEmpty()) {
                logger.warn("Invalid song request: missing songTitle");
                return;
            }

            logger.debug("Processing song request via STOMP: broadcastId={}, songTitle={}, artist={}, user={}", 
                        broadcastId, request.getSongTitle(), request.getArtist(), user.getEmail());

            // Process song request via service (service handles messaging internally)
            songRequestService.createSongRequest(
                broadcastId,
                user,
                request.getSongTitle(),
                request.getArtist() != null ? request.getArtist() : ""
            );
            
            logger.debug("Song request processed successfully via STOMP");
            
        } catch (Exception e) {
            logger.error("Error processing song request via WebSocket for broadcast {}: {}", 
                        broadcastId, e.getMessage(), e);
        }
    }

    /**
     * DTO for song request creation messages
     */
    public static class SongRequestCreateMessage {
        private String songTitle;
        private String artist;

        public String getSongTitle() { 
            return songTitle; 
        }
        
        public void setSongTitle(String songTitle) { 
            this.songTitle = songTitle; 
        }
        
        public String getArtist() { 
            return artist; 
        }
        
        public void setArtist(String artist) { 
            this.artist = artist; 
        }
    }
}

