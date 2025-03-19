package com.wildcastradio.Notification;

import com.wildcastradio.Notification.DTO.NotificationDTO;
import com.wildcastradio.User.UserEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationService(
            NotificationRepository notificationRepository,
            SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
    }

    public NotificationEntity sendNotification(UserEntity recipient, String message, NotificationType type) {
        NotificationEntity notification = new NotificationEntity(message, type, recipient);
        NotificationEntity savedNotification = notificationRepository.save(notification);
        
        // Send real-time notification to the user if they're online
        messagingTemplate.convertAndSendToUser(
                recipient.getEmail(),
                "/queue/notifications",
                NotificationDTO.fromEntity(savedNotification)
        );
        
        return savedNotification;
    }

    public List<NotificationDTO> getNotificationsForUser(UserEntity user) {
        return notificationRepository.findByRecipient(user).stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public List<NotificationDTO> getUnreadNotificationsForUser(UserEntity user) {
        return notificationRepository.findByRecipientAndIsReadOrderByTimestampDesc(user, false).stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public NotificationEntity markAsRead(Long notificationId) {
        NotificationEntity notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        
        notification.setRead(true);
        return notificationRepository.save(notification);
    }

    public long countUnreadNotifications(UserEntity user) {
        return notificationRepository.countByRecipientAndIsRead(user, false);
    }

    public List<NotificationDTO> getRecentNotifications(UserEntity user, LocalDateTime since) {
        return notificationRepository.findByRecipientAndTimestampAfter(user, since).stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }
} 