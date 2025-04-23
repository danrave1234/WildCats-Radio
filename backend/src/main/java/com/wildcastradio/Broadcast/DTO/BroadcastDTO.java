package com.wildcastradio.Broadcast.DTO;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.DTO.UserDTO;

public class BroadcastDTO {
    private Long id;
    private String title;
    private String description;
    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;
    private LocalDateTime actualStart;
    private LocalDateTime actualEnd;
    private String status;
    private String streamUrl;
    private UserDTO createdBy;
    
    // For displaying formatted dates in frontend
    private String formattedStart;
    private String formattedEnd;
    
    // Constructors
    public BroadcastDTO() {
    }
    
    public BroadcastDTO(Long id, String title, String description, LocalDateTime scheduledStart,
                       LocalDateTime scheduledEnd, LocalDateTime actualStart, LocalDateTime actualEnd,
                       String status, String streamUrl, UserDTO createdBy) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.scheduledStart = scheduledStart;
        this.scheduledEnd = scheduledEnd;
        this.actualStart = actualStart;
        this.actualEnd = actualEnd;
        this.status = status;
        this.streamUrl = streamUrl;
        this.createdBy = createdBy;
        
        // Format the dates for frontend display
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        if (scheduledStart != null) {
            this.formattedStart = scheduledStart.format(formatter);
        }
        if (scheduledEnd != null) {
            this.formattedEnd = scheduledEnd.format(formatter);
        }
    }
    
    // Convert from Entity to DTO
    public static BroadcastDTO fromEntity(BroadcastEntity broadcast) {
        if (broadcast == null) {
            return null;
        }
        
        UserDTO userDTO = null;
        if (broadcast.getCreatedBy() != null) {
            userDTO = UserDTO.fromEntity(broadcast.getCreatedBy());
        }
        
        return new BroadcastDTO(
            broadcast.getId(),
            broadcast.getTitle(),
            broadcast.getDescription(),
            broadcast.getScheduledStart(),
            broadcast.getScheduledEnd(),
            broadcast.getActualStart(),
            broadcast.getActualEnd(),
            broadcast.getStatus().toString(),
            broadcast.getStreamUrl(),
            userDTO
        );
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getTitle() {
        return title;
    }
    
    public void setTitle(String title) {
        this.title = title;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public LocalDateTime getScheduledStart() {
        return scheduledStart;
    }
    
    public void setScheduledStart(LocalDateTime scheduledStart) {
        this.scheduledStart = scheduledStart;
    }
    
    public LocalDateTime getScheduledEnd() {
        return scheduledEnd;
    }
    
    public void setScheduledEnd(LocalDateTime scheduledEnd) {
        this.scheduledEnd = scheduledEnd;
    }
    
    public LocalDateTime getActualStart() {
        return actualStart;
    }
    
    public void setActualStart(LocalDateTime actualStart) {
        this.actualStart = actualStart;
    }
    
    public LocalDateTime getActualEnd() {
        return actualEnd;
    }
    
    public void setActualEnd(LocalDateTime actualEnd) {
        this.actualEnd = actualEnd;
    }
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
    
    public String getStreamUrl() {
        return streamUrl;
    }
    
    public void setStreamUrl(String streamUrl) {
        this.streamUrl = streamUrl;
    }
    
    public UserDTO getCreatedBy() {
        return createdBy;
    }
    
    public void setCreatedBy(UserDTO createdBy) {
        this.createdBy = createdBy;
    }
    
    public String getFormattedStart() {
        return formattedStart;
    }
    
    public void setFormattedStart(String formattedStart) {
        this.formattedStart = formattedStart;
    }
    
    public String getFormattedEnd() {
        return formattedEnd;
    }
    
    public void setFormattedEnd(String formattedEnd) {
        this.formattedEnd = formattedEnd;
    }
} 