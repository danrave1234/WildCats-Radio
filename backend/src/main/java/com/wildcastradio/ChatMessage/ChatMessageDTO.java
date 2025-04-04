package com.wildcastradio.ChatMessage;

import java.time.LocalDateTime;

import com.wildcastradio.User.DTO.UserDTO;

public class ChatMessageDTO {
    private Long id;
    private Long broadcastId;
    private UserDTO sender;
    private String content;
    private LocalDateTime createdAt;

    // Default constructor
    public ChatMessageDTO() {
    }

    // Constructor with fields
    public ChatMessageDTO(Long id, Long broadcastId, UserDTO sender, String content, LocalDateTime createdAt) {
        this.id = id;
        this.broadcastId = broadcastId;
        this.sender = sender;
        this.content = content;
        this.createdAt = createdAt;
    }

    // Static method to convert entity to DTO
    public static ChatMessageDTO fromEntity(ChatMessageEntity entity) {
        return new ChatMessageDTO(
                entity.getId(),
                entity.getBroadcastId(),
                UserDTO.fromEntity(entity.getSender()),
                entity.getContent(),
                entity.getCreatedAt()
        );
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

    public UserDTO getSender() {
        return sender;
    }

    public void setSender(UserDTO sender) {
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
}