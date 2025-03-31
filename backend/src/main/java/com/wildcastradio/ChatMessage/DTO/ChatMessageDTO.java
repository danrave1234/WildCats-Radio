package com.wildcastradio.ChatMessage.DTO;

import com.wildcastradio.ChatMessage.ChatMessageEntity;
import com.wildcastradio.User.DTO.UserDTO;

import java.time.LocalDateTime;

public class ChatMessageDTO {
    private Long id;
    private String content;
    private LocalDateTime timestamp;
    private UserDTO sender;
    private Long broadcastId;
    
    // Constructors
    public ChatMessageDTO() {
    }
    
    public ChatMessageDTO(Long id, String content, LocalDateTime timestamp, UserDTO sender, Long broadcastId) {
        this.id = id;
        this.content = content;
        this.timestamp = timestamp;
        this.sender = sender;
        this.broadcastId = broadcastId;
    }
    
    // Convert from Entity to DTO
    public static ChatMessageDTO fromEntity(ChatMessageEntity chatMessage) {
        if (chatMessage == null) {
            return null;
        }
        
        return new ChatMessageDTO(
            chatMessage.getId(),
            chatMessage.getContent(),
            chatMessage.getTimestamp(),
            UserDTO.fromEntity(chatMessage.getSender()),
            chatMessage.getBroadcast().getId()
        );
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getContent() {
        return content;
    }
    
    public void setContent(String content) {
        this.content = content;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
    
    public UserDTO getSender() {
        return sender;
    }
    
    public void setSender(UserDTO sender) {
        this.sender = sender;
    }
    
    public Long getBroadcastId() {
        return broadcastId;
    }
    
    public void setBroadcastId(Long broadcastId) {
        this.broadcastId = broadcastId;
    }
} 