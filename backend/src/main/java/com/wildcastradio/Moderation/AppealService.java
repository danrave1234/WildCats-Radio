package com.wildcastradio.Moderation;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@Service
public class AppealService {

    @Autowired
    private AppealRepository appealRepository;

    @Autowired
    private UserService userService;
    
    @Autowired
    private ModeratorActionService moderatorActionService;
    
    @Autowired
    private StrikeService strikeService;

    @Transactional
    public AppealEntity createAppeal(Long userId, String reason) {
        UserEntity user = userService.findById(userId);
        
        // Check if pending appeal exists
        List<AppealEntity> pending = appealRepository.findByUserAndStatus(user, "PENDING");
        if (!pending.isEmpty()) {
            throw new IllegalStateException("You already have a pending appeal.");
        }
        
        // Snapshot strike history
        List<StrikeEventEntity> strikes = strikeService.getUserStrikes(userId);
        StringBuilder history = new StringBuilder();
        for (StrikeEventEntity s : strikes) {
            history.append(String.format("[%s] Level %d: %s; ", s.getCreatedAt(), s.getStrikeLevel(), s.getReason()));
        }
        
        AppealEntity appeal = new AppealEntity(user, history.toString(), reason);
        return appealRepository.save(appeal);
    }

    public List<AppealEntity> getPendingAppeals() {
        // Return only pending
        // Repository method findByStatus...
        // For simplicity, fetch all and filter or use Pageable
        // Let's use the repo method I added earlier
        // Wait, I added findByStatus(String, Pageable).
        // I should stick to List for small volume or add List method.
        // Let's assume low volume for MVP.
        return appealRepository.findAll().stream()
                .filter(a -> "PENDING".equals(a.getStatus()))
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional
    public AppealEntity resolveAppeal(Long appealId, String decision, UserEntity reviewer, String notes) {
        AppealEntity appeal = appealRepository.findById(appealId)
                .orElseThrow(() -> new IllegalArgumentException("Appeal not found"));
        
        if (!"PENDING".equals(appeal.getStatus())) {
            throw new IllegalStateException("Appeal already resolved");
        }
        
        appeal.setStatus(decision); // APPROVED or DENIED
        appeal.setReviewedBy(reviewer);
        appeal.setDecidedAt(LocalDateTime.now());
        
        if ("APPROVED".equals(decision)) {
            // Unban user
            userService.unbanUser(appeal.getUser().getId(), reviewer);
            // Optional: reset strikes or warnings?
            // "Admin/President can override"
            // For now, just unban.
        }
        
        // Log decision
        moderatorActionService.logAction(
            reviewer, 
            "APPEAL_DECISION", 
            appeal.getUser(), 
            null, 
            "Appeal " + decision + ": " + notes
        );
        
        return appealRepository.save(appeal);
    }
    
    public List<AppealEntity> getAppealsForUser(Long userId) {
        UserEntity user = userService.findById(userId);
        return appealRepository.findByUser(user);
    }
}

