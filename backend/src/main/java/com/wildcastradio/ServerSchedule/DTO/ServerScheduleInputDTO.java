package com.wildcastradio.ServerSchedule.DTO;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import com.wildcastradio.ServerSchedule.ServerScheduleEntity;

public class ServerScheduleInputDTO {
    private Long id;
    private DayOfWeek dayOfWeek;
    private String scheduledStart;
    private String scheduledEnd;
    private boolean automatic;
    private boolean redundantEnabled;

    // Constructors
    public ServerScheduleInputDTO() {
    }

    // Convert to Entity
    public ServerScheduleEntity toEntity() {
        ServerScheduleEntity entity = new ServerScheduleEntity();
        
        entity.setId(this.id);
        entity.setDayOfWeek(this.dayOfWeek);
        entity.setAutomatic(this.automatic);
        entity.setRedundantEnabled(this.redundantEnabled);

        // Convert time strings to LocalDateTime
        if (this.scheduledStart != null && !this.scheduledStart.isEmpty()) {
            LocalTime startTime = LocalTime.parse(this.scheduledStart);
            entity.setScheduledStart(LocalDateTime.of(LocalDate.now(), startTime));
        }

        if (this.scheduledEnd != null && !this.scheduledEnd.isEmpty()) {
            LocalTime endTime = LocalTime.parse(this.scheduledEnd);
            entity.setScheduledEnd(LocalDateTime.of(LocalDate.now(), endTime));
        }

        return entity;
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

    public boolean isAutomatic() {
        return automatic;
    }

    public void setAutomatic(boolean automatic) {
        this.automatic = automatic;
    }

    public boolean isRedundantEnabled() {
        return redundantEnabled;
    }

    public void setRedundantEnabled(boolean redundantEnabled) {
        this.redundantEnabled = redundantEnabled;
    }
} 