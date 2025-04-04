package com.wildcastradio.ServerSchedule;

import java.time.DayOfWeek;
import java.time.LocalDateTime;

import com.wildcastradio.User.UserEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "server_schedules")
public class ServerScheduleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DayOfWeek dayOfWeek;

    @Column
    private LocalDateTime scheduledStart;

    @Column
    private LocalDateTime scheduledEnd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ServerStatus status = ServerStatus.SCHEDULED;

    @Column(nullable = false)
    private boolean automatic = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ServerStatus redundantStatus = ServerStatus.OFF;

    @Column(nullable = false)
    private boolean redundantEnabled = false;

    @ManyToOne
    @JoinColumn(name = "created_by_id")
    private UserEntity createdBy;

    // Constructors
    public ServerScheduleEntity() {
    }

    public ServerScheduleEntity(DayOfWeek dayOfWeek, LocalDateTime scheduledStart, LocalDateTime scheduledEnd, 
                               ServerStatus status, boolean automatic, 
                               ServerStatus redundantStatus, boolean redundantEnabled, 
                               UserEntity createdBy) {
        this.dayOfWeek = dayOfWeek;
        this.scheduledStart = scheduledStart;
        this.scheduledEnd = scheduledEnd;
        this.status = status;
        this.automatic = automatic;
        this.redundantStatus = redundantStatus;
        this.redundantEnabled = redundantEnabled;
        this.createdBy = createdBy;
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

    public ServerStatus getStatus() {
        return status;
    }

    public void setStatus(ServerStatus status) {
        this.status = status;
    }

    public boolean isAutomatic() {
        return automatic;
    }

    public void setAutomatic(boolean automatic) {
        this.automatic = automatic;
    }

    public ServerStatus getRedundantStatus() {
        return redundantStatus;
    }

    public void setRedundantStatus(ServerStatus redundantStatus) {
        this.redundantStatus = redundantStatus;
    }

    public boolean isRedundantEnabled() {
        return redundantEnabled;
    }

    public void setRedundantEnabled(boolean redundantEnabled) {
        this.redundantEnabled = redundantEnabled;
    }

    public UserEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UserEntity createdBy) {
        this.createdBy = createdBy;
    }

    // Server status enum
    public enum ServerStatus {
        SCHEDULED, RUNNING, OFF
    }
} 
