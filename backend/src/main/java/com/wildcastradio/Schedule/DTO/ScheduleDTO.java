package com.wildcastradio.Schedule.DTO;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import com.wildcastradio.Schedule.ScheduleEntity;
import com.wildcastradio.User.DTO.UserDTO;

public class ScheduleDTO {
    private Long id;
    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private UserDTO createdBy;
    
    // For displaying formatted dates in frontend
    private String formattedStart;
    private String formattedEnd;
    
    // Constructors
    public ScheduleDTO() {
    }
    
    public ScheduleDTO(Long id, LocalDateTime scheduledStart, LocalDateTime scheduledEnd,
                      String status, LocalDateTime createdAt, LocalDateTime updatedAt,
                      UserDTO createdBy) {
        this.id = id;
        this.scheduledStart = scheduledStart;
        this.scheduledEnd = scheduledEnd;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
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
    public static ScheduleDTO fromEntity(ScheduleEntity schedule) {
        if (schedule == null) {
            return null;
        }
        
        UserDTO userDTO = null;
        if (schedule.getCreatedBy() != null) {
            userDTO = UserDTO.fromEntity(schedule.getCreatedBy());
        }
        
        return new ScheduleDTO(
            schedule.getId(),
            schedule.getScheduledStart(),
            schedule.getScheduledEnd(),
            schedule.getStatus().toString(),
            schedule.getCreatedAt(),
            schedule.getUpdatedAt(),
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
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
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