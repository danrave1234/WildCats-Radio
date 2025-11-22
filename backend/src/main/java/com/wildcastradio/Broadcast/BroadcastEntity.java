package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.wildcastradio.ChatMessage.ChatMessageEntity;
import com.wildcastradio.DJHandover.DJHandoverEntity;
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
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "broadcasts", indexes = {
    @Index(name = "idx_broadcast_status", columnList = "status"),
    @Index(name = "idx_broadcast_created_by", columnList = "created_by_id"),
    @Index(name = "idx_broadcast_scheduled_start", columnList = "scheduled_start"),
    @Index(name = "idx_broadcast_scheduled_end", columnList = "scheduled_end"),
    @Index(name = "idx_broadcast_actual_start", columnList = "actual_start"),
    @Index(name = "idx_broadcast_actual_end", columnList = "actual_end"),
    @Index(name = "idx_broadcast_status_start", columnList = "status, actual_start"),
    @Index(name = "idx_broadcast_started_by", columnList = "started_by_id"),
    @Index(name = "idx_broadcast_current_dj", columnList = "current_active_dj_id")
})
public class BroadcastEntity {

    // Chat slow mode settings
    @Column(name = "slow_mode_enabled")
    private Boolean slowModeEnabled = false;

    @Column(name = "slow_mode_seconds")
    private Integer slowModeSeconds = 0;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column
    private String description;

    @Column(name = "actual_start")
    private LocalDateTime actualStart;

    @Column(name = "actual_end")
    private LocalDateTime actualEnd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BroadcastStatus status;

    @Column(name = "stream_url")
    private String streamUrl;

    // Schedule fields embedded directly in broadcast
    @Column(name = "scheduled_start")
    private LocalDateTime scheduledStart;

    @Column(name = "scheduled_end")
    private LocalDateTime scheduledEnd;

    // Analytics fields that could be cached
    @Column(name = "peak_listeners")
    private Integer peakListeners = 0; // Historical peak

    @Column(name = "total_interactions")
    private Integer totalInteractions = 0; // Cached count

    // Relationships
    @ManyToOne
    @JoinColumn(name = "created_by_id", nullable = false)
    private UserEntity createdBy;

    @ManyToOne
    @JoinColumn(name = "started_by_id")
    private UserEntity startedBy;

    @ManyToOne
    @JoinColumn(name = "current_active_dj_id")
    private UserEntity currentActiveDJ; // Currently broadcasting DJ

    @OneToMany(mappedBy = "broadcast", cascade = CascadeType.ALL)
    private List<ChatMessageEntity> chatMessages = new ArrayList<>();

    @OneToMany(mappedBy = "broadcast", cascade = CascadeType.ALL)
    private List<SongRequestEntity> songRequests = new ArrayList<>();

    @OneToMany(mappedBy = "broadcast", cascade = CascadeType.ALL)
    private List<DJHandoverEntity> handovers = new ArrayList<>();

    // Idempotency keys for preventing duplicate operations
    @Column(name = "start_idempotency_key", unique = true)
    private String startIdempotencyKey;

    @Column(name = "end_idempotency_key", unique = true)
    private String endIdempotencyKey;

    // Checkpoint fields for state persistence
    @Column(name = "last_checkpoint_time")
    private LocalDateTime lastCheckpointTime;

    @Column(name = "current_duration_seconds")
    private Long currentDurationSeconds;

    // Broadcast status enum with state machine validation
    public enum BroadcastStatus {
        SCHEDULED, LIVE, ENDED, TESTING, CANCELLED;

        /**
         * Validates if transition from current status to new status is allowed
         * @param newStatus The target status
         * @return true if transition is allowed, false otherwise
         */
        public boolean canTransitionTo(BroadcastStatus newStatus) {
            return switch (this) {
                case SCHEDULED -> newStatus == LIVE || newStatus == CANCELLED || newStatus == TESTING;
                case LIVE -> newStatus == ENDED;
                case TESTING -> newStatus == LIVE || newStatus == ENDED;
                case ENDED, CANCELLED -> false; // Terminal states
            };
        }
    }

    // Default constructor
    public BroadcastEntity() {
    }

    // All args constructor
    public BroadcastEntity(Long id, String title, String description, LocalDateTime actualStart,
                          LocalDateTime actualEnd, BroadcastStatus status, String streamUrl,
                          LocalDateTime scheduledStart, LocalDateTime scheduledEnd,
                          Integer peakListeners, Integer totalInteractions,
                          UserEntity createdBy, UserEntity startedBy,
                          List<ChatMessageEntity> chatMessages, List<SongRequestEntity> songRequests) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.actualStart = actualStart;
        this.actualEnd = actualEnd;
        this.status = status;
        this.streamUrl = streamUrl;
        this.scheduledStart = scheduledStart;
        this.scheduledEnd = scheduledEnd;
        this.peakListeners = peakListeners != null ? peakListeners : 0;
        this.totalInteractions = totalInteractions != null ? totalInteractions : 0;
        this.createdBy = createdBy;
        this.startedBy = startedBy;
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
        this.status = status;
    }

    public String getStreamUrl() {
        return streamUrl;
    }

    public void setStreamUrl(String streamUrl) {
        this.streamUrl = streamUrl;
    }

    public LocalDateTime getScheduledStart() {
        return scheduledStart;
    }

    public void setScheduledStart(LocalDateTime scheduledStart) {
        this.scheduledStart = scheduledStart;
    }

    public LocalDateTime getScheduledEnd() {
        return scheduledEnd;
    }

    public void setScheduledEnd(LocalDateTime scheduledEnd) {
        this.scheduledEnd = scheduledEnd;
    }

    public UserEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UserEntity createdBy) {
        this.createdBy = createdBy;
    }

    public UserEntity getStartedBy() {
        return startedBy;
    }

    public void setStartedBy(UserEntity startedBy) {
        this.startedBy = startedBy;
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



    public Integer getPeakListeners() {
        return peakListeners;
    }

    public void setPeakListeners(Integer peakListeners) {
        this.peakListeners = peakListeners;
    }

    public Integer getTotalInteractions() {
        return totalInteractions;
    }

    public void setTotalInteractions(Integer totalInteractions) {
        this.totalInteractions = totalInteractions;
    }

    public Boolean getSlowModeEnabled() {
        return slowModeEnabled != null ? slowModeEnabled : false;
    }

    public void setSlowModeEnabled(Boolean slowModeEnabled) {
        this.slowModeEnabled = slowModeEnabled != null ? slowModeEnabled : false;
    }

    public Integer getSlowModeSeconds() {
        return slowModeSeconds != null ? slowModeSeconds : 0;
    }

    public void setSlowModeSeconds(Integer slowModeSeconds) {
        this.slowModeSeconds = slowModeSeconds != null ? slowModeSeconds : 0;
    }

    public String getStartIdempotencyKey() {
        return startIdempotencyKey;
    }

    public void setStartIdempotencyKey(String startIdempotencyKey) {
        this.startIdempotencyKey = startIdempotencyKey;
    }

    public String getEndIdempotencyKey() {
        return endIdempotencyKey;
    }

    public void setEndIdempotencyKey(String endIdempotencyKey) {
        this.endIdempotencyKey = endIdempotencyKey;
    }

    public LocalDateTime getLastCheckpointTime() {
        return lastCheckpointTime;
    }

    public void setLastCheckpointTime(LocalDateTime lastCheckpointTime) {
        this.lastCheckpointTime = lastCheckpointTime;
    }

    public Long getCurrentDurationSeconds() {
        return currentDurationSeconds;
    }

    public void setCurrentDurationSeconds(Long currentDurationSeconds) {
        this.currentDurationSeconds = currentDurationSeconds;
    }

    public UserEntity getCurrentActiveDJ() {
        return currentActiveDJ;
    }

    public void setCurrentActiveDJ(UserEntity currentActiveDJ) {
        this.currentActiveDJ = currentActiveDJ;
    }

    public List<DJHandoverEntity> getHandovers() {
        return handovers;
    }

    public void setHandovers(List<DJHandoverEntity> handovers) {
        this.handovers = handovers;
    }
}
