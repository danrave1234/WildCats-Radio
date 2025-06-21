package com.wildcastradio.User;

import java.util.ArrayList;
import java.util.List;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.ChatMessage.ChatMessageEntity;
import com.wildcastradio.Notification.NotificationEntity;
import com.wildcastradio.SongRequest.SongRequestEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String firstname;

    @Column(nullable = false)
    private String lastname;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    // Verification information
    private boolean verified = false;
    private String verificationCode;

    // Relationships
    @OneToMany(mappedBy = "createdBy", cascade = CascadeType.ALL)
    private List<BroadcastEntity> broadcasts = new ArrayList<>();

    @OneToMany(mappedBy = "sender", cascade = CascadeType.ALL)
    private List<ChatMessageEntity> chatMessages = new ArrayList<>();

    @OneToMany(mappedBy = "requestedBy", cascade = CascadeType.ALL)
    private List<SongRequestEntity> songRequests = new ArrayList<>();

    @OneToMany(mappedBy = "recipient", cascade = CascadeType.ALL)
    private List<NotificationEntity> notifications = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<ActivityLogEntity> activityLogs = new ArrayList<>();

    // User roles enum
    public enum UserRole {
        ADMIN, DJ, LISTENER
    }
    
    // Default constructor
    public UserEntity() {
    }
    
    // All args constructor
    public UserEntity(Long id, String firstname, String lastname, String email, String password, UserRole role, 
                    boolean verified, String verificationCode, List<BroadcastEntity> broadcasts,
                    List<ChatMessageEntity> chatMessages, List<SongRequestEntity> songRequests,
                    List<NotificationEntity> notifications, List<ActivityLogEntity> activityLogs) {
        this.id = id;
        this.firstname = firstname;
        this.lastname = lastname;
        this.email = email;
        this.password = password;
        this.role = role;
        this.verified = verified;
        this.verificationCode = verificationCode;
        this.broadcasts = broadcasts;
        this.chatMessages = chatMessages;
        this.songRequests = songRequests;
        this.notifications = notifications;
        this.activityLogs = activityLogs;
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFirstname() {
        return firstname;
    }

    public void setFirstname(String firstname) {
        this.firstname = firstname;
    }

    public String getLastname() {
        return lastname;
    }

    public void setLastname(String lastname) {
        this.lastname = lastname;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public String getVerificationCode() {
        return verificationCode;
    }

    public void setVerificationCode(String verificationCode) {
        this.verificationCode = verificationCode;
    }

    public List<BroadcastEntity> getBroadcasts() {
        return broadcasts;
    }

    public void setBroadcasts(List<BroadcastEntity> broadcasts) {
        this.broadcasts = broadcasts;
    }

    public List<ChatMessageEntity> getChatMessages() {
        return chatMessages;
    }

    public void setChatMessages(List<ChatMessageEntity> chatMessages) {
        this.chatMessages = chatMessages;
    }

    public List<SongRequestEntity> getSongRequests() {
        return songRequests;
    }

    public void setSongRequests(List<SongRequestEntity> songRequests) {
        this.songRequests = songRequests;
    }

    public List<NotificationEntity> getNotifications() {
        return notifications;
    }

    public void setNotifications(List<NotificationEntity> notifications) {
        this.notifications = notifications;
    }

    public List<ActivityLogEntity> getActivityLogs() {
        return activityLogs;
    }

    public void setActivityLogs(List<ActivityLogEntity> activityLogs) {
        this.activityLogs = activityLogs;
    }
} 