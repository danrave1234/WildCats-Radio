package com.wildcastradio.Notification.DTO;

import com.wildcastradio.Notification.NotificationEntity;
import com.wildcastradio.Notification.NotificationType;
import com.wildcastradio.User.DTO.UserDTO;

import java.time.LocalDateTime;

public class NotificationDTO {
    private Long id;
    private String message;
    private String type;
    private LocalDateTime timestamp;
    private boolean read;
    private UserDTO recipient;
    
    // Constructors
    public NotificationDTO() {
    }
    
    public NotificationDTO(Long id, String message, String type, LocalDateTime timestamp,
                          boolean read, UserDTO recipient) {
        this.id = id;
        this.message = message;
        this.type = type;
        this.timestamp = timestamp;
        this.read = read;
        this.recipient = recipient;
    }
    
    // Convert from Entity to DTO
    public static NotificationDTO fromEntity(NotificationEntity notification) {
        if (notification == null) {
            return null;
        }
        
        return new NotificationDTO(
            notification.getId(),
            notification.getMessage(),
            notification.getType().toString(),
            notification.getTimestamp(),
            notification.isRead(),
            UserDTO.fromEntity(notification.getRecipient())
        );
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
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
    
    public boolean isRead() {
        return read;
    }
    
    public void setRead(boolean read) {
        this.read = read;
    }
    
    public UserDTO getRecipient() {
        return recipient;
    }
    
    public void setRecipient(UserDTO recipient) {
        this.recipient = recipient;
    }
} 