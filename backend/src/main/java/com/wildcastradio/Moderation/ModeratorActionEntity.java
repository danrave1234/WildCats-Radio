package com.wildcastradio.Moderation;

import java.time.LocalDateTime;

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
@Table(name = "moderator_actions", indexes = {
    @Index(name = "idx_mod_action_moderator", columnList = "moderator_id"),
    @Index(name = "idx_mod_action_target", columnList = "target_user_id"),
    @Index(name = "idx_mod_action_type", columnList = "action_type"),
    @Index(name = "idx_mod_action_created_at", columnList = "created_at")
})
public class ModeratorActionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "moderator_id")
    private UserEntity moderator;

    @Column(name = "action_type", nullable = false)
    private String actionType; // DELETE, WARN, BAN, UNBAN, CENSOR, APPEAL_DECISION

    @ManyToOne
    @JoinColumn(name = "target_user_id")
    private UserEntity targetUser;

    @ManyToOne
    @JoinColumn(name = "message_id")
    private ChatMessageEntity message;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public ModeratorActionEntity() {
        this.createdAt = LocalDateTime.now();
    }

    public ModeratorActionEntity(UserEntity moderator, String actionType, UserEntity targetUser, ChatMessageEntity message, String details) {
        this.moderator = moderator;
        this.actionType = actionType;
        this.targetUser = targetUser;
        this.message = message;
        this.details = details;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UserEntity getModerator() { return moderator; }
    public void setModerator(UserEntity moderator) { this.moderator = moderator; }
    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public UserEntity getTargetUser() { return targetUser; }
    public void setTargetUser(UserEntity targetUser) { this.targetUser = targetUser; }
    public ChatMessageEntity getMessage() { return message; }
    public void setMessage(ChatMessageEntity message) { this.message = message; }
    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public enum ActionType {
        DELETE, WARN, BAN, UNBAN, CENSOR, APPEAL_DECISION
    }
}

