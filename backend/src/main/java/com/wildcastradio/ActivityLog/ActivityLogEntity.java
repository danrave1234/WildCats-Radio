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
    @Column(nullable = false)
    private ActivityType activityType;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    // Relationships
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

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

    // Activity type enum
    public enum ActivityType {
        LOGIN, LOGOUT, BROADCAST_START, BROADCAST_END, PROFILE_UPDATE, SONG_REQUEST,
        USER_REGISTER, USER_ROLE_CHANGE, USER_CREATE, SCHEDULE_CREATE, EMAIL_VERIFY,
        SERVER_START, SERVER_STOP
    }
} 
