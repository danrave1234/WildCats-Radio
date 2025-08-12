package com.wildcastradio.Notification;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.wildcastradio.User.UserEntity;

@Repository
public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {
    List<NotificationEntity> findByRecipient(UserEntity recipient);
    List<NotificationEntity> findByRecipientOrderByTimestampDesc(UserEntity recipient);
    List<NotificationEntity> findByRecipientAndIsReadOrderByTimestampDesc(UserEntity recipient, boolean isRead);
    List<NotificationEntity> findByRecipientAndTimestampAfter(UserEntity recipient, LocalDateTime timestamp);
    long countByRecipientAndIsRead(UserEntity recipient, boolean isRead);
    List<NotificationEntity> findByRecipientAndType(UserEntity recipient, NotificationType type);

    // Deduplication helpers
    boolean existsByRecipientAndMessageAndTypeAndTimestampAfter(
            UserEntity recipient,
            String message,
            NotificationType type,
            LocalDateTime timestamp
    );

    Optional<NotificationEntity> findTopByRecipientAndMessageAndTypeOrderByTimestampDesc(
            UserEntity recipient,
            String message,
            NotificationType type
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE NotificationEntity n SET n.isRead = true WHERE n.recipient = :recipient AND n.isRead = false")
    int markAllAsReadForUser(@Param("recipient") UserEntity recipient);
} 
