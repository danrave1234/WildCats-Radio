package com.wildcastradio.Moderation;

import java.time.LocalDateTime;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.ChatMessage.ChatMessageEntity;
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
@Table(name = "strike_events", indexes = {
    @Index(name = "idx_strike_user", columnList = "user_id"),
    @Index(name = "idx_strike_broadcast", columnList = "broadcast_id"),
    @Index(name = "idx_strike_created_at", columnList = "created_at")
})
public class StrikeEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne
    @JoinColumn(name = "broadcast_id")
    private BroadcastEntity broadcast;

    @ManyToOne
    @JoinColumn(name = "message_id")
    private ChatMessageEntity message;

    @Column(name = "strike_level", nullable = false)
    private Integer strikeLevel;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @ManyToOne
    @JoinColumn(name = "created_by_id")
    private UserEntity createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public StrikeEventEntity() {
        this.createdAt = LocalDateTime.now();
    }

    public StrikeEventEntity(UserEntity user, BroadcastEntity broadcast, ChatMessageEntity message, Integer strikeLevel, String reason, UserEntity createdBy) {
        this.user = user;
        this.broadcast = broadcast;
        this.message = message;
        this.strikeLevel = strikeLevel;
        this.reason = reason;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public BroadcastEntity getBroadcast() { return broadcast; }
    public void setBroadcast(BroadcastEntity broadcast) { this.broadcast = broadcast; }
    public ChatMessageEntity getMessage() { return message; }
    public void setMessage(ChatMessageEntity message) { this.message = message; }
    public Integer getStrikeLevel() { return strikeLevel; }
    public void setStrikeLevel(Integer strikeLevel) { this.strikeLevel = strikeLevel; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public UserEntity getCreatedBy() { return createdBy; }
    public void setCreatedBy(UserEntity createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

