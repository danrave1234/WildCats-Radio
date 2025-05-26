package com.wildcastradio.ActivityLog;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.ActivityLog.DTO.ActivityLogDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/activity-logs")
public class ActivityLogController {

    @Autowired
    private ActivityLogService activityLogService;
    
    @Autowired
    private UserService userService;

    /**
     * Get all system activity logs (requires ADMIN role for complete access)
     */
    @GetMapping
    public ResponseEntity<List<ActivityLogDTO>> getAllActivityLogs(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity currentUser = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Only ADMIN users can see all activity logs
        if (!"ADMIN".equals(currentUser.getRole().toString())) {
            return ResponseEntity.status(403).build();
        }

        // Get all activity logs from all users for system analytics
        List<ActivityLogDTO> allLogs = activityLogService.getAllActivityLogs();
        return ResponseEntity.ok(allLogs);
    }

    /**
     * Get activity logs for a specific user (requires ADMIN role or own user)
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ActivityLogDTO>> getActivityLogsForUser(
            @PathVariable Long userId, 
            Authentication authentication) {
        
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity currentUser = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Users can only see their own logs unless they're admin
        if (!currentUser.getId().equals(userId) && !"ADMIN".equals(currentUser.getRole().toString())) {
            return ResponseEntity.status(403).build();
        }

        UserEntity targetUser = userService.getUserById(userId)
                .orElseThrow(() -> new RuntimeException("Target user not found"));

        List<ActivityLogDTO> userLogs = activityLogService.getActivityLogsForUser(targetUser);
        return ResponseEntity.ok(userLogs);
    }

    /**
     * Get recent activity logs for current user
     */
    @GetMapping("/recent")
    public ResponseEntity<List<ActivityLogDTO>> getRecentActivityLogs(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity currentUser = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ActivityLogDTO> recentLogs = activityLogService.getRecentActivityLogsForUser(currentUser);
        return ResponseEntity.ok(recentLogs);
    }
} 