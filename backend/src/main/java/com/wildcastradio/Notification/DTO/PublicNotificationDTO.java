package com.wildcastradio.Notification.DTO;

import java.time.LocalDateTime;

/**
 * Minimal DTO for public broadcasts via STOMP topics.
 * Contains no recipient information and is safe for anonymous clients.
 */
public class PublicNotificationDTO {
    private String type;
    private String message;
    private Long announcementId;
    private LocalDateTime timestamp;

    public PublicNotificationDTO() {
    }

    public PublicNotificationDTO(String type, String message, Long announcementId, LocalDateTime timestamp) {
        this.type = type;
        this.message = message;
        this.announcementId = announcementId;
        this.timestamp = timestamp;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Long getAnnouncementId() {
        return announcementId;
    }

    public void setAnnouncementId(Long announcementId) {
        this.announcementId = announcementId;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}


