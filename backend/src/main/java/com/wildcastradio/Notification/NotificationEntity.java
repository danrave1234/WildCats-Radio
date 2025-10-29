package com.wildcastradio.Notification;

import java.time.LocalDateTime;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.Announcement.AnnouncementEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(
    name = "notifications",
    indexes = {
        @Index(name = "idx_notifications_recipient", columnList = "recipient_id"),
        @Index(name = "idx_notifications_recipient_timestamp", columnList = "recipient_id, timestamp"),
        @Index(name = "idx_notifications_recipient_is_read", columnList = "recipient_id, is_read")
    }
)
public class NotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @Column(name = "is_read", nullable = false)
    private boolean isRead;

    // Relationships
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private UserEntity recipient;

    // Optional link to an announcement that generated this notification
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id")
    private AnnouncementEntity announcement;

    // No-arg constructor required by JPA
    public NotificationEntity() {
    }

    // Default constructor
    public NotificationEntity(String message, NotificationType type, UserEntity recipient) {
        this.message = message;
        this.type = type;
        this.recipient = recipient;
        this.isRead = false;
        this.timestamp = LocalDateTime.now();
    }

    // All args constructor
    public NotificationEntity(Long id, String message, NotificationType type, LocalDateTime timestamp, UserEntity recipient) {
        this.id = id;
        this.message = message;
        this.type = type;
        this.timestamp = timestamp;
        this.recipient = recipient;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public NotificationType getType() {
        return type;
    }

    public void setType(NotificationType type) {
        this.type = type;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public UserEntity getRecipient() {
        return recipient;
    }

    public void setRecipient(UserEntity recipient) {
        this.recipient = recipient;
    }

    public boolean isRead() {
        return isRead;
    }

    public void setRead(boolean read) {
        isRead = read;
    }

    public AnnouncementEntity getAnnouncement() {
        return announcement;
    }

    public void setAnnouncement(AnnouncementEntity announcement) {
        this.announcement = announcement;
    }
}
