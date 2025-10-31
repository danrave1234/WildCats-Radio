package com.wildcastradio.User;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_user_email", columnList = "email"),
    @Index(name = "idx_user_role", columnList = "role"),
    @Index(name = "idx_user_banned", columnList = "banned"),
    @Index(name = "idx_user_active", columnList = "is_active"),
    @Index(name = "idx_user_created_at", columnList = "created_at"),
    @Index(name = "idx_user_banned_until", columnList = "banned_until"),
    @Index(name = "idx_user_verified", columnList = "verified")
})
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


    @Column
    private LocalDateTime lastLoginAt; // Track user activity

    @Column
    private boolean isActive = true; // Soft delete capability

    @Column
    private LocalDateTime createdAt; // User registration date

    @Column
    private LocalDate birthdate; // User birthdate for analytics

    // Demographics
    @Enumerated(EnumType.STRING)
    @Column(name = "gender")
    private Gender gender; // Optional gender for demographics analytics

    // Moderation fields
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean banned = false; // If true, user is banned from interactive features like chat

    @Column(name = "banned_until")
    private LocalDateTime bannedUntil; // If set and in the future, ban expires at this time; null means permanent while banned=true

    @Column(name = "banned_at")
    private LocalDateTime bannedAt; // When the ban was applied

    @Column(name = "ban_reason", length = 500)
    private String banReason; // Human-readable reason for ban

    @Column(nullable = false, columnDefinition = "integer default 0")
    private int warningCount = 0; // Number of warnings issued to the user

    // Notification preferences (persisted per-user)
    @Column(name = "notify_broadcast_start", nullable = false, columnDefinition = "boolean default true")
    private boolean notifyBroadcastStart = true;

    @Column(name = "notify_broadcast_reminders", nullable = false, columnDefinition = "boolean default true")
    private boolean notifyBroadcastReminders = true;

    @Column(name = "notify_new_schedule", nullable = false, columnDefinition = "boolean default false")
    private boolean notifyNewSchedule = false;

    @Column(name = "notify_system_updates", nullable = false, columnDefinition = "boolean default true")
    private boolean notifySystemUpdates = true;

    // Relationships - Fixed cascade types for better performance and data integrity
    @OneToMany(mappedBy = "createdBy", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<BroadcastEntity> broadcasts = new ArrayList<>();

    @OneToMany(mappedBy = "sender", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<ChatMessageEntity> chatMessages = new ArrayList<>();

    @OneToMany(mappedBy = "requestedBy", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<SongRequestEntity> songRequests = new ArrayList<>();

    @OneToMany(mappedBy = "recipient", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<NotificationEntity> notifications = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<ActivityLogEntity> activityLogs = new ArrayList<>();

    // User roles enum
    public enum UserRole {
        ADMIN, MODERATOR, DJ, LISTENER
    }

    // Gender enum for demographics
    public enum Gender {
        MALE, FEMALE, OTHER
    }

    // Default constructor
    public UserEntity() {
        this.createdAt = LocalDateTime.now();
    }

    // All args constructor
    public UserEntity(Long id, String firstname, String lastname, String email, String password, UserRole role, 
                    boolean verified, String verificationCode, LocalDateTime lastLoginAt, boolean isActive, LocalDateTime createdAt,
                    LocalDate birthdate, List<BroadcastEntity> broadcasts, List<ChatMessageEntity> chatMessages, 
                    List<SongRequestEntity> songRequests, List<NotificationEntity> notifications, 
                    List<ActivityLogEntity> activityLogs) {
        this.id = id;
        this.firstname = firstname;
        this.lastname = lastname;
        this.email = email;
        this.password = password;
        this.role = role;
        this.verified = verified;
        this.verificationCode = verificationCode;
        this.lastLoginAt = lastLoginAt;
        this.isActive = isActive;
        this.createdAt = createdAt != null ? createdAt : LocalDateTime.now();
        this.birthdate = birthdate;
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

    // Notification preference getters/setters
    public boolean isNotifyBroadcastStart() { return notifyBroadcastStart; }
    public void setNotifyBroadcastStart(boolean notifyBroadcastStart) { this.notifyBroadcastStart = notifyBroadcastStart; }
    public boolean isNotifyBroadcastReminders() { return notifyBroadcastReminders; }
    public void setNotifyBroadcastReminders(boolean notifyBroadcastReminders) { this.notifyBroadcastReminders = notifyBroadcastReminders; }
    public boolean isNotifyNewSchedule() { return notifyNewSchedule; }
    public void setNotifyNewSchedule(boolean notifyNewSchedule) { this.notifyNewSchedule = notifyNewSchedule; }
    public boolean isNotifySystemUpdates() { return notifySystemUpdates; }
    public void setNotifySystemUpdates(boolean notifySystemUpdates) { this.notifySystemUpdates = notifySystemUpdates; }


    public LocalDateTime getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(LocalDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDate getBirthdate() {
        return birthdate;
    }

    public void setBirthdate(LocalDate birthdate) {
        this.birthdate = birthdate;
    }

    public Gender getGender() {
        return gender;
    }

    public void setGender(Gender gender) {
        this.gender = gender;
    }

    public boolean isBanned() {
        return banned;
    }

    public void setBanned(boolean banned) {
        this.banned = banned;
    }

    public int getWarningCount() {
        return warningCount;
    }

    public void setWarningCount(int warningCount) {
        this.warningCount = warningCount;
    }

    public java.time.LocalDateTime getBannedUntil() {
        return bannedUntil;
    }

    public void setBannedUntil(java.time.LocalDateTime bannedUntil) {
        this.bannedUntil = bannedUntil;
    }

    public java.time.LocalDateTime getBannedAt() {
        return bannedAt;
    }

    public void setBannedAt(java.time.LocalDateTime bannedAt) {
        this.bannedAt = bannedAt;
    }

    public String getBanReason() {
        return banReason;
    }

    public void setBanReason(String banReason) {
        this.banReason = banReason;
    }

    // Helper methods
    public String getFullName() {
        return firstname + " " + lastname;
    }

    public String getDisplayNameOrFullName() {
        return getFullName();
    }
}
