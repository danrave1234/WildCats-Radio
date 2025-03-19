package com.wildcastradio.ActivityLog.DTO;

import java.time.LocalDateTime;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.User.DTO.UserDTO;

public class ActivityLogDTO {
    private Long id;
    private String activityType;
    private String description;
    private LocalDateTime timestamp;
    private UserDTO user;
    
    // Constructors
    public ActivityLogDTO() {
    }
    
    public ActivityLogDTO(Long id, String activityType, String description, LocalDateTime timestamp, UserDTO user) {
        this.id = id;
        this.activityType = activityType;
        this.description = description;
        this.timestamp = timestamp;
        this.user = user;
    }
    
    // Convert from Entity to DTO
    public static ActivityLogDTO fromEntity(ActivityLogEntity activityLog) {
        if (activityLog == null) {
            return null;
        }
        
        return new ActivityLogDTO(
            activityLog.getId(),
            activityLog.getActivityType().toString(),
            activityLog.getDescription(),
            activityLog.getTimestamp(),
            UserDTO.fromEntity(activityLog.getUser())
        );
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getActivityType() {
        return activityType;
    }
    
    public void setActivityType(String activityType) {
        this.activityType = activityType;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
    
    public UserDTO getUser() {
        return user;
    }
    
    public void setUser(UserDTO user) {
        this.user = user;
    }
} 