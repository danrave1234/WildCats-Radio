package com.wildcastradio.ServerSchedule.DTO;

import java.time.DayOfWeek;

import com.wildcastradio.ServerSchedule.ServerScheduleEntity;
import com.wildcastradio.User.DTO.UserDTO;

public class ServerScheduleDTO {
    private Long id;
    private DayOfWeek dayOfWeek;
    private String scheduledStart;
    private String scheduledEnd;
    private String status;
    private boolean automatic;
    private String redundantStatus;
    private boolean redundantEnabled;
    private UserDTO createdBy;

    // Constructors
    public ServerScheduleDTO() {
    }

    public ServerScheduleDTO(Long id, DayOfWeek dayOfWeek, String scheduledStart, String scheduledEnd,
                            String status, boolean automatic, String redundantStatus,
                            boolean redundantEnabled, UserDTO createdBy) {
        this.id = id;
        this.dayOfWeek = dayOfWeek;
        this.scheduledStart = scheduledStart;
        this.scheduledEnd = scheduledEnd;
        this.status = status;
        this.automatic = automatic;
        this.redundantStatus = redundantStatus;
        this.redundantEnabled = redundantEnabled;
        this.createdBy = createdBy;
    }

    // Convert from Entity to DTO
    public static ServerScheduleDTO fromEntity(ServerScheduleEntity serverSchedule) {
        if (serverSchedule == null) {
            return null;
        }

        String startTime = serverSchedule.getScheduledStart() != null ? 
            serverSchedule.getScheduledStart().toLocalTime().toString() : null;
        String endTime = serverSchedule.getScheduledEnd() != null ? 
            serverSchedule.getScheduledEnd().toLocalTime().toString() : null;

        return new ServerScheduleDTO(
            serverSchedule.getId(),
            serverSchedule.getDayOfWeek(),
            startTime,
            endTime,
            serverSchedule.getStatus().toString(),
            serverSchedule.isAutomatic(),
            serverSchedule.getRedundantStatus().toString(),
            serverSchedule.isRedundantEnabled(),
            UserDTO.fromEntity(serverSchedule.getCreatedBy())
        );
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(DayOfWeek dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public String getScheduledStart() {
        return scheduledStart;
    }

    public void setScheduledStart(String scheduledStart) {
        this.scheduledStart = scheduledStart;
    }

    public String getScheduledEnd() {
        return scheduledEnd;
    }

    public void setScheduledEnd(String scheduledEnd) {
        this.scheduledEnd = scheduledEnd;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isAutomatic() {
        return automatic;
    }

    public void setAutomatic(boolean automatic) {
        this.automatic = automatic;
    }

    public String getRedundantStatus() {
        return redundantStatus;
    }

    public void setRedundantStatus(String redundantStatus) {
        this.redundantStatus = redundantStatus;
    }

    public boolean isRedundantEnabled() {
        return redundantEnabled;
    }

    public void setRedundantEnabled(boolean redundantEnabled) {
        this.redundantEnabled = redundantEnabled;
    }

    public UserDTO getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UserDTO createdBy) {
        this.createdBy = createdBy;
    }
} 
