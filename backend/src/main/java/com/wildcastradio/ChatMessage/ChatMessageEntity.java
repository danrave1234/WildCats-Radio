package com.wildcastradio.ChatMessage;

import java.time.LocalDateTime;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.UserEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "chat_messages")
public class ChatMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "broadcast_id", insertable = false, updatable = false)
    private Long broadcastId;

    @ManyToOne
    @JoinColumn(name = "broadcast_id", nullable = false)
    private BroadcastEntity broadcast;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // Default constructor
    public ChatMessageEntity() {
        this.createdAt = LocalDateTime.now();
    }

    // Constructor with fields
    public ChatMessageEntity(Long broadcastId, UserEntity sender, String content) {
        this.broadcastId = broadcastId;
        this.sender = sender;
        this.content = content;
        this.createdAt = LocalDateTime.now();
        // Note: broadcast field must be set separately when using this constructor
    }

    // Constructor with BroadcastEntity
    public ChatMessageEntity(BroadcastEntity broadcast, UserEntity sender, String content) {
        this.broadcast = broadcast;
        this.broadcastId = broadcast != null ? broadcast.getId() : null;
        this.sender = sender;
        this.content = content;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getBroadcastId() {
        return broadcastId;
    }

    public void setBroadcastId(Long broadcastId) {
        this.broadcastId = broadcastId;
    }

    public UserEntity getSender() {
        return sender;
    }

    public void setSender(UserEntity sender) {
        this.sender = sender;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public BroadcastEntity getBroadcast() {
        return broadcast;
    }

    public void setBroadcast(BroadcastEntity broadcast) {
        this.broadcast = broadcast;
        this.broadcastId = broadcast != null ? broadcast.getId() : null;
    }
}
