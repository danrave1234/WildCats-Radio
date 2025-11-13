package com.wildcastradio.ActivityLog;

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
@Table(name = "activity_logs", indexes = {
    @Index(name = "idx_activity_log_user", columnList = "user_id"),
    @Index(name = "idx_activity_log_timestamp", columnList = "timestamp"),
    @Index(name = "idx_activity_log_activity_type", columnList = "activity_type"),
    @Index(name = "idx_activity_log_user_timestamp", columnList = "user_id, timestamp"),
    @Index(name = "idx_activity_log_user_type", columnList = "user_id, activity_type")
})
public class ActivityLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type", nullable = false)
    private ActivityType activityType;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    // Relationships
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = true) // Nullable for system-level audit logs
    private UserEntity user;

    // Audit metadata fields for enhanced tracking
    @Column(name = "broadcast_id")
    private Long broadcastId;

    @Column(name = "metadata", length = 1000) // JSON string for additional context
    private String metadata; // Stores JSON: {oldStatus, newStatus, idempotencyKey, etc.}

    @Column(name = "ip_address", length = 45) // IPv6 max length
    private String ipAddress;

    @Column(name = "is_system_event")
    private Boolean isSystemEvent = false; // True for system-level events (recovery, health checks, etc.)

    // Constructors
    public ActivityLogEntity() {
    }

    public ActivityLogEntity(Long id, ActivityType activityType, String description, LocalDateTime timestamp, UserEntity user) {
        this.id = id;
        this.activityType = activityType;
        this.description = description;
        this.timestamp = timestamp;
        this.user = user;
    }

    public ActivityLogEntity(ActivityType activityType, String description, UserEntity user) {
        this.activityType = activityType;
        this.description = description;
        this.user = user;
        this.timestamp = LocalDateTime.now();
        this.isSystemEvent = (user == null);
    }

    // Constructor for system-level audit logs (no user)
    public ActivityLogEntity(ActivityType activityType, String description) {
        this.activityType = activityType;
        this.description = description;
        this.user = null;
        this.timestamp = LocalDateTime.now();
        this.isSystemEvent = true;
    }

    // Constructor with metadata
    public ActivityLogEntity(ActivityType activityType, String description, UserEntity user, Long broadcastId, String metadata) {
        this.activityType = activityType;
        this.description = description;
        this.user = user;
        this.broadcastId = broadcastId;
        this.metadata = metadata;
        this.timestamp = LocalDateTime.now();
        this.isSystemEvent = (user == null);
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ActivityType getActivityType() {
        return activityType;
    }

    public void setActivityType(ActivityType activityType) {
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

    public UserEntity getUser() {
        return user;
    }

    public void setUser(UserEntity user) {
        this.user = user;
    }

    public Long getBroadcastId() {
        return broadcastId;
    }

    public void setBroadcastId(Long broadcastId) {
        this.broadcastId = broadcastId;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public Boolean getIsSystemEvent() {
        return isSystemEvent != null ? isSystemEvent : false;
    }

    public void setIsSystemEvent(Boolean isSystemEvent) {
        this.isSystemEvent = isSystemEvent;
    }

    // Activity type enum
    public enum ActivityType {
        // User activities
        LOGIN, LOGOUT, PROFILE_UPDATE, SONG_REQUEST,
        USER_REGISTER, USER_ROLE_CHANGE, USER_CREATE, SCHEDULE_CREATE, EMAIL_VERIFY,
        
        // Broadcast lifecycle
        BROADCAST_START, BROADCAST_END, BROADCAST_CREATE, BROADCAST_UPDATE, BROADCAST_CANCEL,
        
        // Broadcast state transitions (audit)
        BROADCAST_STATE_TRANSITION, // SCHEDULED -> LIVE, LIVE -> ENDED, etc.
        
        // System events
        SERVER_START, SERVER_STOP,
        
        // Recovery and health events (audit)
        BROADCAST_RECOVERY, // Auto-recovery on startup
        BROADCAST_AUTO_END, // Auto-end stale broadcast
        BROADCAST_CHECKPOINT, // Periodic checkpointing
        BROADCAST_HEALTH_CHECK_FAILED, // Health check failures
        BROADCAST_HEALTH_CHECK_RECOVERED, // Health recovery
        
        // Circuit breaker events (audit)
        CIRCUIT_BREAKER_OPEN, CIRCUIT_BREAKER_CLOSED, CIRCUIT_BREAKER_HALF_OPEN,
        
        // Idempotency events (audit)
        IDEMPOTENT_OPERATION_DETECTED // Duplicate operation prevented
    }
} 
