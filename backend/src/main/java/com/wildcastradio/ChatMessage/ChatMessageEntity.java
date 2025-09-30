package com.wildcastradio.ChatMessage;

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
@Table(name = "chat_messages", indexes = {
    @Index(name = "idx_chat_broadcast_id", columnList = "broadcast_id"),
    @Index(name = "idx_chat_created_at", columnList = "created_at"),
    @Index(name = "idx_chat_user_id", columnList = "user_id")
})
public class ChatMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "broadcast_id", nullable = false)
    private BroadcastEntity broadcast;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

	@Column(name = "original_content", columnDefinition = "TEXT")
	private String originalContent;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // Default constructor
    public ChatMessageEntity() {
        this.createdAt = LocalDateTime.now();
    }

    // Constructor with BroadcastEntity
    public ChatMessageEntity(BroadcastEntity broadcast, UserEntity sender, String content) {
        this.broadcast = broadcast;
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

    // Helper method to get broadcast ID through relationship
    public Long getBroadcastId() {
        return broadcast != null ? broadcast.getId() : null;
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

	public String getOriginalContent() {
		return originalContent;
	}

	public void setOriginalContent(String originalContent) {
		this.originalContent = originalContent;
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
    }
}
