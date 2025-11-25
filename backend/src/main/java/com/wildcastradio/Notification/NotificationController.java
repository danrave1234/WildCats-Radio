package com.wildcastradio.Notification;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Notification.DTO.NotificationDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserService userService;

    public NotificationController(NotificationService notificationService, UserService userService) {
        this.notificationService = notificationService;
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(
            Authentication authentication,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // ✅ PHASE 6: Enforce reasonable limits to prevent system overload
        final int MAX_PAGE_SIZE = 50;  // Industry standard: 20-50 items per page
        final int DEFAULT_PAGE_SIZE = 20;

        if (page != null || size != null) {
            int p = Math.max(0, page != null ? page : 0);  // Ensure non-negative page
            int s = Math.min(MAX_PAGE_SIZE, size != null ? size : DEFAULT_PAGE_SIZE);  // Cap page size
            Page<NotificationDTO> result = notificationService.getNotificationsForUser(user, p, s);
            return ResponseEntity.ok(result);
        }

        List<NotificationDTO> notifications = notificationService.getNotificationsForUser(user);
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/unread")
    public ResponseEntity<List<NotificationDTO>> getUnreadNotifications(Authentication authentication) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<NotificationDTO> notifications = notificationService.getUnreadNotificationsForUser(user);
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/count-unread")
    public ResponseEntity<Long> getUnreadCount(Authentication authentication) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        long count = notificationService.countUnreadNotifications(user);
        return ResponseEntity.ok(count);
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<NotificationDTO> markAsRead(
            @PathVariable Long id,
            Authentication authentication) {
        // Additional security check could be added here to ensure the user owns this notification

        NotificationEntity notification = notificationService.markAsRead(id);
        return ResponseEntity.ok(NotificationDTO.fromEntity(notification));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<NotificationDTO>> getRecentNotifications(
            @RequestParam LocalDateTime since,
            Authentication authentication) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<NotificationDTO> notifications = notificationService.getRecentNotifications(user, since);
        return ResponseEntity.ok(notifications);
    }

    @PutMapping("/read-all")
    public ResponseEntity<Integer> markAllAsRead(Authentication authentication) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        int updated = notificationService.markAllAsRead(user);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/by-type/{type}")
    public ResponseEntity<List<NotificationDTO>> getNotificationsByType(
            @PathVariable String type,
            Authentication authentication) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        try {
            NotificationType notificationType = NotificationType.valueOf(type.toUpperCase());
            List<NotificationDTO> notifications = notificationService.getNotificationsByType(user, notificationType);
            return ResponseEntity.ok(notifications);
        } catch (IllegalArgumentException e) {
            // If the type is not a valid enum value
            return ResponseEntity.badRequest().build();
        }
    }

    // Test endpoint for admins to send test notifications
    @PostMapping("/test")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR')")
    public ResponseEntity<NotificationDTO> sendTestNotification(
            @RequestParam String message,
            @RequestParam(defaultValue = "INFO") String type,
            @RequestParam(required = false) String targetEmail,
            Authentication authentication) {
        
        try {
            NotificationType notificationType = NotificationType.valueOf(type.toUpperCase());
            
            if (targetEmail != null && !targetEmail.isEmpty()) {
                // Send to specific user
                UserEntity targetUser = userService.getUserByEmail(targetEmail)
                        .orElseThrow(() -> new RuntimeException("Target user not found"));
                
                NotificationEntity notification = notificationService.sendNotification(targetUser, message, notificationType);
                return ResponseEntity.ok(NotificationDTO.fromEntity(notification));
            } else {
                // Send to current user (admin)
                UserEntity currentUser = userService.getUserByEmail(authentication.getName())
                        .orElseThrow(() -> new RuntimeException("User not found"));
                
                NotificationEntity notification = notificationService.sendNotification(currentUser, message, notificationType);
                return ResponseEntity.ok(NotificationDTO.fromEntity(notification));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // Test endpoint for admins to send notifications to all users
    @PostMapping("/test/broadcast")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR')")
    public ResponseEntity<String> sendTestNotificationToAll(
            @RequestParam String message,
            @RequestParam(defaultValue = "INFO") String type) {
        
        try {
            NotificationType notificationType = NotificationType.valueOf(type.toUpperCase());
            List<UserEntity> allUsers = userService.findAllUsers();
            
            int sentCount = 0;
            for (UserEntity user : allUsers) {
                notificationService.sendNotification(user, message, notificationType);
                sentCount++;
            }
            
            return ResponseEntity.ok("Notification sent to " + sentCount + " users");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid notification type");
        }
    }
} 
