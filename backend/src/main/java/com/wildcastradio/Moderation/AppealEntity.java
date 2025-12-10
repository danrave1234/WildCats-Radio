package com.wildcastradio.Moderation;

import java.time.LocalDateTime;

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
@Table(name = "appeals", indexes = {
    @Index(name = "idx_appeal_user", columnList = "user_id"),
    @Index(name = "idx_appeal_status", columnList = "status")
})
public class AppealEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "strike_history", columnDefinition = "TEXT")
    private String strikeHistory; // Snapshot

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false)
    private String status = "PENDING"; // PENDING, APPROVED, DENIED

    @ManyToOne
    @JoinColumn(name = "reviewed_by_id")
    private UserEntity reviewedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    public AppealEntity() {
        this.createdAt = LocalDateTime.now();
    }

    public AppealEntity(UserEntity user, String strikeHistory, String reason) {
        this.user = user;
        this.strikeHistory = strikeHistory;
        this.reason = reason;
        this.createdAt = LocalDateTime.now();
        this.status = "PENDING";
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public String getStrikeHistory() { return strikeHistory; }
    public void setStrikeHistory(String strikeHistory) { this.strikeHistory = strikeHistory; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UserEntity getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(UserEntity reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getDecidedAt() { return decidedAt; }
    public void setDecidedAt(LocalDateTime decidedAt) { this.decidedAt = decidedAt; }

    public enum Status {
        PENDING, APPROVED, DENIED
    }
}

