package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.wildcastradio.ChatMessage.ChatMessageEntity;
import com.wildcastradio.Schedule.ScheduleEntity;
import com.wildcastradio.SongRequest.SongRequestEntity;
import com.wildcastradio.User.UserEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "broadcasts")
public class BroadcastEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column
    private String description;

    @Column
    private LocalDateTime actualStart;

    @Column
    private LocalDateTime actualEnd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BroadcastStatus status;

    @Column
    private String streamUrl;

    // Relationships
    @ManyToOne
    @JoinColumn(name = "created_by_id", nullable = false)
    private UserEntity createdBy;

    @OneToOne
    @JoinColumn(name = "schedule_id", nullable = false)
    private ScheduleEntity schedule;

    @OneToMany(mappedBy = "broadcast", cascade = CascadeType.ALL)
    private List<ChatMessageEntity> chatMessages = new ArrayList<>();

    @OneToMany(mappedBy = "broadcast", cascade = CascadeType.ALL)
    private List<SongRequestEntity> songRequests = new ArrayList<>();

    // Broadcast status enum
    public enum BroadcastStatus {
        SCHEDULED, LIVE, ENDED, TESTING
    }
    
    // Default constructor
    public BroadcastEntity() {
    }
    
    // All args constructor
    public BroadcastEntity(Long id, String title, String description, LocalDateTime actualStart,
                          LocalDateTime actualEnd, BroadcastStatus status, String streamUrl, 
                          UserEntity createdBy, ScheduleEntity schedule,
                          List<ChatMessageEntity> chatMessages, List<SongRequestEntity> songRequests) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.actualStart = actualStart;
        this.actualEnd = actualEnd;
        this.status = status;
        this.streamUrl = streamUrl;
        this.createdBy = createdBy;
        this.schedule = schedule;
        this.chatMessages = chatMessages;
        this.songRequests = songRequests;
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDateTime getActualStart() {
        return actualStart;
    }

    public void setActualStart(LocalDateTime actualStart) {
        this.actualStart = actualStart;
    }

    public LocalDateTime getActualEnd() {
        return actualEnd;
    }

    public void setActualEnd(LocalDateTime actualEnd) {
        this.actualEnd = actualEnd;
    }

    public BroadcastStatus getStatus() {
        return status;
    }

    public void setStatus(BroadcastStatus status) {
        BroadcastStatus oldStatus = this.status;
        this.status = status;
    }

    public String getStreamUrl() {
        return streamUrl;
    }

    public void setStreamUrl(String streamUrl) {
        this.streamUrl = streamUrl;
    }

    public UserEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UserEntity createdBy) {
        this.createdBy = createdBy;
    }

    public ScheduleEntity getSchedule() {
        return schedule;
    }

    public void setSchedule(ScheduleEntity schedule) {
        this.schedule = schedule;
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

    // Helper methods to access schedule information
    public LocalDateTime getScheduledStart() {
        return schedule != null ? schedule.getScheduledStart() : null;
    }

    public LocalDateTime getScheduledEnd() {
        return schedule != null ? schedule.getScheduledEnd() : null;
    }
} 