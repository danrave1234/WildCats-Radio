package com.wildcastradio.DJHandover;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.DJHandover.DTO.DJHandoverDTO;
import com.wildcastradio.DJHandover.DTO.HandoverRequestDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserRepository;
import com.wildcastradio.User.UserEntity.UserRole;

@Service
public class DJHandoverService {

    private static final Logger logger = LoggerFactory.getLogger(DJHandoverService.class);

    @Autowired
    private DJHandoverRepository handoverRepository;

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Initiate a DJ handover for a live broadcast
     * 
     * @param broadcastId The broadcast ID
     * @param request The handover request containing new DJ ID and optional reason
     * @param initiator The user initiating the handover
     * @return The created handover DTO
     * @throws IllegalArgumentException if validation fails
     */
    @Transactional
    public DJHandoverDTO initiateHandover(Long broadcastId, HandoverRequestDTO request, UserEntity initiator) {
        // Validate broadcast exists and is LIVE
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));

        if (broadcast.getStatus() != BroadcastEntity.BroadcastStatus.LIVE) {
            throw new IllegalArgumentException("Broadcast must be LIVE to initiate handover");
        }

        // Validate new DJ exists and has DJ role
        UserEntity newDJ = userRepository.findById(request.getNewDJId())
                .orElseThrow(() -> new IllegalArgumentException("New DJ not found"));

        if (newDJ.getRole() != UserRole.DJ) {
            throw new IllegalArgumentException("New DJ must have DJ role");
        }

        if (!newDJ.isActive()) {
            throw new IllegalArgumentException("New DJ must be active");
        }

        // Validate permissions
        UserEntity currentActiveDJ = broadcast.getCurrentActiveDJ();
        boolean hasPermission = false;

        if (initiator.getRole() == UserRole.ADMIN || initiator.getRole() == UserRole.MODERATOR) {
            hasPermission = true;
        } else if (initiator.getRole() == UserRole.DJ && currentActiveDJ != null 
                && currentActiveDJ.getId().equals(initiator.getId())) {
            hasPermission = true;
        }

        if (!hasPermission) {
            throw new IllegalArgumentException("You do not have permission to initiate handover");
        }

        // Validate new DJ is different from current active DJ
        if (currentActiveDJ != null && currentActiveDJ.getId().equals(newDJ.getId())) {
            throw new IllegalArgumentException("New DJ cannot be the same as current active DJ");
        }

        // Create handover entity
        DJHandoverEntity handover = new DJHandoverEntity();
        handover.setBroadcast(broadcast);
        handover.setPreviousDJ(currentActiveDJ);
        handover.setNewDJ(newDJ);
        handover.setHandoverTime(LocalDateTime.now());
        handover.setInitiatedBy(initiator);
        handover.setReason(request.getReason());

        // Calculate duration of previous DJ's session
        if (currentActiveDJ != null && broadcast.getActualStart() != null) {
            // Find the last handover for this broadcast to get the start time of current DJ's period
            List<DJHandoverEntity> previousHandovers = handoverRepository
                    .findByBroadcast_IdOrderByHandoverTimeAsc(broadcastId);
            
            LocalDateTime periodStart = broadcast.getActualStart();
            for (DJHandoverEntity prevHandover : previousHandovers) {
                if (prevHandover.getNewDJ().getId().equals(currentActiveDJ.getId())) {
                    periodStart = prevHandover.getHandoverTime();
                    break;
                }
            }
            
            Duration duration = Duration.between(periodStart, LocalDateTime.now());
            handover.setDurationSeconds(duration.getSeconds());
        }

        // Save handover
        DJHandoverEntity savedHandover = handoverRepository.save(handover);

        // Update broadcast's current active DJ
        broadcast.setCurrentActiveDJ(newDJ);
        broadcastRepository.save(broadcast);

        // Convert to DTO
        DJHandoverDTO handoverDTO = DJHandoverDTO.fromEntity(savedHandover);

        // Send WebSocket notification
        try {
            Map<String, Object> handoverMessage = new HashMap<>();
            handoverMessage.put("type", "DJ_HANDOVER");
            handoverMessage.put("broadcastId", broadcastId);
            handoverMessage.put("handover", handoverDTO);
            
            messagingTemplate.convertAndSend("/topic/broadcast/" + broadcastId + "/handover", handoverMessage);
            
            // Also send current DJ update
            Map<String, Object> currentDJMessage = new HashMap<>();
            currentDJMessage.put("type", "CURRENT_DJ_UPDATE");
            currentDJMessage.put("broadcastId", broadcastId);
            currentDJMessage.put("currentDJ", com.wildcastradio.User.DTO.UserDTO.fromEntity(newDJ));
            
            messagingTemplate.convertAndSend("/topic/broadcast/" + broadcastId + "/current-dj", currentDJMessage);
        } catch (Exception e) {
            logger.error("Error sending WebSocket notification for handover", e);
        }

        logger.info("DJ handover initiated: Broadcast {} from DJ {} to DJ {}", 
                broadcastId, 
                currentActiveDJ != null ? currentActiveDJ.getEmail() : "none",
                newDJ.getEmail());

        return handoverDTO;
    }

    /**
     * Get handover history for a broadcast
     * 
     * @param broadcastId The broadcast ID
     * @return List of handover DTOs ordered by handover time
     */
    public List<DJHandoverDTO> getHandoverHistory(Long broadcastId) {
        List<DJHandoverEntity> handovers = handoverRepository
                .findByBroadcast_IdOrderByHandoverTimeAsc(broadcastId);
        
        return handovers.stream()
                .map(DJHandoverDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Get current active DJ for a broadcast
     * 
     * @param broadcastId The broadcast ID
     * @return UserDTO of current active DJ, or null if none
     */
    public com.wildcastradio.User.DTO.UserDTO getCurrentActiveDJ(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));

        UserEntity currentDJ = broadcast.getCurrentActiveDJ();
        if (currentDJ == null) {
            // Fallback to startedBy if currentActiveDJ is not set
            currentDJ = broadcast.getStartedBy();
        }

        return currentDJ != null ? com.wildcastradio.User.DTO.UserDTO.fromEntity(currentDJ) : null;
    }
}

