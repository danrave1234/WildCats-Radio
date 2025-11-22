package com.wildcastradio.DJHandover;

import java.time.LocalDateTime;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.UserEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "dj_handovers", indexes = {
    @Index(name = "idx_handover_broadcast", columnList = "broadcast_id"),
    @Index(name = "idx_handover_new_dj", columnList = "new_dj_id"),
    @Index(name = "idx_handover_time", columnList = "handover_time"),
    @Index(name = "idx_handover_broadcast_time", columnList = "broadcast_id, handover_time")
})
public class DJHandoverEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "broadcast_id", nullable = false)
    private BroadcastEntity broadcast;

    @ManyToOne
    @JoinColumn(name = "previous_dj_id")
    private UserEntity previousDJ; // null for initial handover

    @ManyToOne
    @JoinColumn(name = "new_dj_id", nullable = false)
    private UserEntity newDJ;

    @Column(name = "handover_time", nullable = false)
    private LocalDateTime handoverTime;

    @ManyToOne
    @JoinColumn(name = "initiated_by_id")
    private UserEntity initiatedBy; // Who triggered the handover

    @Column(name = "reason", length = 500)
    private String reason; // Optional reason for handover

    @Column(name = "duration_seconds")
    private Long durationSeconds; // Duration of previous DJ's session

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Default constructor
    public DJHandoverEntity() {
        this.handoverTime = LocalDateTime.now();
        this.createdAt = LocalDateTime.now();
    }

    // Constructor with required fields
    public DJHandoverEntity(BroadcastEntity broadcast, UserEntity newDJ, UserEntity initiatedBy) {
        this.broadcast = broadcast;
        this.newDJ = newDJ;
        this.initiatedBy = initiatedBy;
        this.handoverTime = LocalDateTime.now();
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public BroadcastEntity getBroadcast() {
        return broadcast;
    }

    public void setBroadcast(BroadcastEntity broadcast) {
        this.broadcast = broadcast;
    }

    public UserEntity getPreviousDJ() {
        return previousDJ;
    }

    public void setPreviousDJ(UserEntity previousDJ) {
        this.previousDJ = previousDJ;
    }

    public UserEntity getNewDJ() {
        return newDJ;
    }

    public void setNewDJ(UserEntity newDJ) {
        this.newDJ = newDJ;
    }

    public LocalDateTime getHandoverTime() {
        return handoverTime;
    }

    public void setHandoverTime(LocalDateTime handoverTime) {
        this.handoverTime = handoverTime;
    }

    public UserEntity getInitiatedBy() {
        return initiatedBy;
    }

    public void setInitiatedBy(UserEntity initiatedBy) {
        this.initiatedBy = initiatedBy;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Long getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Long durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // Helper method to get broadcast ID
    public Long getBroadcastId() {
        return broadcast != null ? broadcast.getId() : null;
    }
}

