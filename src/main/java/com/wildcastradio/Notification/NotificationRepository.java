package com.wildcastradio.Notification;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.User.UserEntity;

@Repository
public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {
    List<NotificationEntity> findByRecipient(UserEntity recipient);
    List<NotificationEntity> findByRecipientAndIsReadOrderByTimestampDesc(UserEntity recipient, boolean isRead);
    List<NotificationEntity> findByRecipientAndTimestampAfter(UserEntity recipient, LocalDateTime timestamp);
    long countByRecipientAndIsRead(UserEntity recipient, boolean isRead);
} 