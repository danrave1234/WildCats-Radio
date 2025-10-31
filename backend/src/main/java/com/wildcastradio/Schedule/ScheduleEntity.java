package com.wildcastradio.Schedule;

import java.time.LocalDateTime;

import com.wildcastradio.User.UserEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "schedules", indexes = {
    @Index(name = "idx_schedule_created_by", columnList = "created_by_id"),
    @Index(name = "idx_schedule_status", columnList = "status"),
    @Index(name = "idx_schedule_scheduled_start", columnList = "scheduled_start"),
    @Index(name = "idx_schedule_scheduled_end", columnList = "scheduled_end"),
    @Index(name = "idx_schedule_status_start", columnList = "status, scheduled_start"),
    @Index(name = "idx_schedule_start_end", columnList = "scheduled_start, scheduled_end")
})
public class ScheduleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime scheduledStart;

    @Column(nullable = false)
    private LocalDateTime scheduledEnd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ScheduleStatus status = ScheduleStatus.SCHEDULED;

    @Column
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;

    // Relationships
    @ManyToOne
    @JoinColumn(name = "created_by_id", nullable = false)
    private UserEntity createdBy;

    // Schedule status enum
    public enum ScheduleStatus {
        SCHEDULED,   // Schedule is created and waiting
        ACTIVE,      // Schedule is currently active (broadcast is live)
        COMPLETED,   // Schedule has been completed
        CANCELLED    // Schedule was cancelled
    }

    // Constructors
    public ScheduleEntity() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public ScheduleEntity(LocalDateTime scheduledStart, LocalDateTime scheduledEnd, UserEntity createdBy) {
        this();
        this.scheduledStart = scheduledStart;
        this.scheduledEnd = scheduledEnd;
        this.createdBy = createdBy;
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
        this.updatedAt = LocalDateTime.now();
    }

    public LocalDateTime getScheduledEnd() {
        return scheduledEnd;
    }

    public void setScheduledEnd(LocalDateTime scheduledEnd) {
        this.scheduledEnd = scheduledEnd;
        this.updatedAt = LocalDateTime.now();
    }

    public ScheduleStatus getStatus() {
        return status;
    }

    public void setStatus(ScheduleStatus status) {
        this.status = status;
        this.updatedAt = LocalDateTime.now();
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

    public UserEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UserEntity createdBy) {
        this.createdBy = createdBy;
        this.updatedAt = LocalDateTime.now();
    }

    // Helper methods
    public boolean isActive() {
        LocalDateTime now = LocalDateTime.now();
        return status == ScheduleStatus.ACTIVE || 
               (status == ScheduleStatus.SCHEDULED && 
                now.isAfter(scheduledStart) && 
                now.isBefore(scheduledEnd));
    }

    public boolean isUpcoming() {
        LocalDateTime now = LocalDateTime.now();
        return status == ScheduleStatus.SCHEDULED && now.isBefore(scheduledStart);
    }

    public boolean isPast() {
        LocalDateTime now = LocalDateTime.now();
        return status == ScheduleStatus.COMPLETED || 
               (status != ScheduleStatus.CANCELLED && now.isAfter(scheduledEnd));
    }
} 