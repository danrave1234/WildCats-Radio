package com.wildcastradio.Moderation;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.ChatMessage.ChatMessageEntity;
import com.wildcastradio.ChatMessage.ChatMessageRepository;
import com.wildcastradio.User.DTO.BanRequest;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserRepository;
import com.wildcastradio.User.UserService;

@Service
public class StrikeService {

    private static final Logger logger = LoggerFactory.getLogger(StrikeService.class);

    @Autowired
    private StrikeEventRepository strikeEventRepository;

    @Autowired
    private UserService userService;
    
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Process a tier violation and apply appropriate strikes/bans
     */
    @Transactional
    public void processTierViolation(UserEntity user, Long broadcastId, Integer tier, String reason) {
        if (user == null || tier == null) return;

        // Tier 1: Censor Only (Level 0 Strike / Log)
        if (tier == 1) {
            addStrike(user.getId(), broadcastId, null, 0, reason, getSystemUser());
            return;
        }

        // Determine current status for Tier 2+
        List<StrikeEventEntity> strikes = strikeEventRepository.findByUserOrderByCreatedAtDesc(user);
        
        // Count effective strikes (Level > 0) in last 30 days
        long recentStrikes = strikes.stream()
            .filter(s -> s.getStrikeLevel() > 0 && s.getCreatedAt().isAfter(LocalDateTime.now().minusDays(30)))
            .count();

        int nextLevel = 1;
        
        if (tier == 2) {
            // Harsh Words -> Add 1 level
            nextLevel = (int) recentStrikes + 1;
        } else if (tier >= 3) {
            // Slurs -> Jump levels
            if (recentStrikes < 1) {
                nextLevel = 2; // Jump to Strike 2
            } else {
                nextLevel = 3; // Jump to Strike 3
            }
        }

        if (nextLevel > 3) nextLevel = 3;
        
        addStrike(user.getId(), broadcastId, null, nextLevel, reason, getSystemUser());
    }

    @Transactional
    public void addStrike(Long userId, Long broadcastId, Long messageId, Integer level, String reason, UserEntity actor) {
        UserEntity user = userService.findById(userId);
        BroadcastEntity broadcast = broadcastId != null ? broadcastRepository.findById(broadcastId).orElse(null) : null;
        ChatMessageEntity message = messageId != null ? chatMessageRepository.findById(messageId).orElse(null) : null;

        // Create strike event
        StrikeEventEntity strike = new StrikeEventEntity(user, broadcast, message, level, reason, actor);
        strikeEventRepository.save(strike);

        if (level > 0) {
            logger.info("Strike {} issued to user {} for: {}", level, user.getEmail(), reason);
            
            // Notify user
            messagingTemplate.convertAndSendToUser(
                user.getEmail(),
                "/queue/moderation",
                new ModerationNotice("STRIKE", "You received a Strike " + level + ": " + reason)
            );
        } else {
            logger.info("Censor event (Tier 1) for user {}: {}", user.getEmail(), reason);
            // Optional: Notify user they were censored?
            // "When censored, show 'Message censored for profanity.'" -> Handled by frontend seeing replacement text?
            // But we can also send a toast.
             messagingTemplate.convertAndSendToUser(
                user.getEmail(),
                "/queue/moderation",
                new ModerationNotice("CENSOR", "Your message was censored: " + reason)
            );
        }

        // Apply consequences for Level > 0
        if (level == 1) {
            userService.warnUser(userId, actor != null ? actor : getSystemUser());
        } else if (level == 2) {
            BanRequest req = new BanRequest();
            req.setUnit(BanRequest.DurationUnit.DAYS);
            req.setAmount(1);
            req.setReason("Strike 2: " + reason);
            userService.banUser(userId, req, actor != null ? actor : getSystemUser());
        } else if (level >= 3) {
            BanRequest req = new BanRequest();
            req.setUnit(BanRequest.DurationUnit.DAYS);
            req.setAmount(7); 
            req.setReason("Strike 3: " + reason);
            userService.banUser(userId, req, actor != null ? actor : getSystemUser());
        }
    }
    
    private UserEntity getSystemUser() {
        return userRepository.findByRole(UserEntity.UserRole.ADMIN).stream().findFirst().orElse(null);
    }

    public List<StrikeEventEntity> getUserStrikes(Long userId) {
        UserEntity user = userService.findById(userId);
        return strikeEventRepository.findByUserOrderByCreatedAtDesc(user);
    }
    
    public List<StrikeEventEntity> getBroadcastStrikes(Long broadcastId) {
        return strikeEventRepository.findByBroadcast_Id(broadcastId);
    }

    public static class ModerationNotice {
        public String type;
        public String message;
        public ModerationNotice(String type, String message) {
            this.type = type;
            this.message = message;
        }
    }
}
