package com.wildcastradio.Notification;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.Notification.DTO.NotificationDTO;
import com.wildcastradio.Notification.DTO.PublicNotificationDTO;
import com.wildcastradio.Announcement.AnnouncementEntity;
import com.wildcastradio.User.UserEntity;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    // Tracks notifications already broadcasted for ephemeral events (e.g., "starting soon")
    private final Set<String> transientNotificationKeys = new HashSet<>();

    public NotificationService(
            NotificationRepository notificationRepository,
            SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public NotificationEntity sendNotification(UserEntity recipient, String message, NotificationType type) {
        // Basic deduplication: avoid saving the exact same notification for the same user
        // within the last minute.
        LocalDateTime oneMinuteAgo = LocalDateTime.now().minusMinutes(1);
        boolean recentDuplicateExists = notificationRepository
                .existsByRecipientAndMessageAndTypeAndTimestampAfter(recipient, message, type, oneMinuteAgo);

        if (recentDuplicateExists) {
            // Return the latest existing one without creating/spamming more
            return notificationRepository
                    .findTopByRecipientAndMessageAndTypeOrderByTimestampDesc(recipient, message, type)
                    .orElseGet(() -> {
                        // Fallback in the unlikely case the record was deleted between checks
                        NotificationEntity fallback = new NotificationEntity(message, type, recipient);
                        return notificationRepository.save(fallback);
                    });
        }

        NotificationEntity notification = new NotificationEntity(message, type, recipient);
        NotificationEntity savedNotification = notificationRepository.save(notification);

        // Create DTO for the notification
        NotificationDTO notificationDTO = NotificationDTO.fromEntity(savedNotification);

        // Send real-time notification to the user if they're online
        messagingTemplate.convertAndSendToUser(
                recipient.getEmail(),
                "/queue/notifications",
                notificationDTO
        );

        return savedNotification;
    }

    @Transactional
    public NotificationEntity sendNotificationWithAnnouncement(
            UserEntity recipient,
            String message,
            NotificationType type,
            AnnouncementEntity announcement
    ) {
        NotificationEntity notification = sendNotification(recipient, message, type);
        // attach announcement link and re-save
        notification.setAnnouncement(announcement);
        NotificationEntity saved = notificationRepository.save(notification);

        // Push updated DTO with announcementId to WS
        NotificationDTO dto = NotificationDTO.fromEntity(saved);
        messagingTemplate.convertAndSendToUser(
                recipient.getEmail(),
                "/queue/notifications",
                dto
        );
        return saved;
    }

    public void sendPublicAnnouncementToast(AnnouncementEntity announcement, String message) {
        try {
            PublicNotificationDTO dto = new PublicNotificationDTO(
                    NotificationType.ANNOUNCEMENT_PUBLISHED.name(),
                    message,
                    announcement != null ? announcement.getId() : null,
                    LocalDateTime.now()
            );
            messagingTemplate.convertAndSend("/topic/announcements/public", dto);
        } catch (Exception ignored) {
        }
    }

    /**
     * Send a transient (non-repeating) broadcast-style notification that should not
     * fire multiple times for the same logical event key (e.g., a specific broadcast id).
     *
     * The key is caller-defined (e.g., "starting-soon:123").
     */
    @Transactional
    public boolean sendTransientNotificationOnce(String dedupeKey, UserEntity recipient, String message, NotificationType type) {
        if (transientNotificationKeys.contains(dedupeKey)) {
            return false; // already sent during app lifetime
        }
        transientNotificationKeys.add(dedupeKey);
        sendNotification(recipient, message, type);
        return true;
    }

    public void clearTransientKey(String dedupeKey) {
        transientNotificationKeys.remove(dedupeKey);
    }

    @Transactional(readOnly = true)
    public List<NotificationDTO> getNotificationsForUser(UserEntity user) {
        return notificationRepository.findByRecipientOrderByTimestampDesc(user).stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<NotificationDTO> getUnreadNotificationsForUser(UserEntity user) {
        return notificationRepository.findByRecipientAndIsReadOrderByTimestampDesc(user, false).stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public NotificationEntity markAsRead(Long notificationId) {
        NotificationEntity notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        notification.setRead(true);
        return notificationRepository.save(notification);
    }

    public long countUnreadNotifications(UserEntity user) {
        return notificationRepository.countByRecipientAndIsRead(user, false);
    }

    @Transactional(readOnly = true)
    public List<NotificationDTO> getRecentNotifications(UserEntity user, LocalDateTime since) {
        return notificationRepository.findByRecipientAndTimestampAfter(user, since).stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<NotificationDTO> getNotificationsByType(UserEntity user, NotificationType type) {
        return notificationRepository.findByRecipientAndType(user, type).stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public int markAllAsRead(UserEntity user) {
        return notificationRepository.markAllAsReadForUser(user);
    }

    @Transactional(readOnly = true)
    public Page<NotificationDTO> getNotificationsForUser(UserEntity user, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(safePage, safeSize);
        Page<NotificationEntity> result = notificationRepository.findByRecipientOrderByTimestampDesc(user, pageable);
        return result.map(NotificationDTO::fromEntity);
    }
} 
