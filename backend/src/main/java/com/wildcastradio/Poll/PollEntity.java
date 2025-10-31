package com.wildcastradio.Poll;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.UserEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "polls", indexes = {
    @Index(name = "idx_poll_broadcast", columnList = "broadcast_id"),
    @Index(name = "idx_poll_created_by", columnList = "created_by_id"),
    @Index(name = "idx_poll_active", columnList = "active"),
    @Index(name = "idx_poll_created_at", columnList = "created_at"),
    @Index(name = "idx_poll_broadcast_active", columnList = "broadcast_id, active")
})
public class PollEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String question;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime endedAt;

    @Column(nullable = false)
    private boolean active;

    @ManyToOne
    @JoinColumn(name = "created_by_id", nullable = false)
    private UserEntity createdBy;

    @ManyToOne
    @JoinColumn(name = "broadcast_id", nullable = false)
    private BroadcastEntity broadcast;

    @OneToMany(mappedBy = "poll", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PollOptionEntity> options = new ArrayList<>();

    // Constructors
    public PollEntity() {
        this.createdAt = LocalDateTime.now();
        this.active = true;
    }

    public PollEntity(String question, UserEntity createdBy, BroadcastEntity broadcast) {
        this.question = question;
        this.createdBy = createdBy;
        this.broadcast = broadcast;
        this.createdAt = LocalDateTime.now();
        this.active = true;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(LocalDateTime endedAt) {
        this.endedAt = endedAt;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public UserEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UserEntity createdBy) {
        this.createdBy = createdBy;
    }

    public BroadcastEntity getBroadcast() {
        return broadcast;
    }

    public void setBroadcast(BroadcastEntity broadcast) {
        this.broadcast = broadcast;
    }

    public List<PollOptionEntity> getOptions() {
        return options;
    }

    public void setOptions(List<PollOptionEntity> options) {
        this.options = options;
    }

    // Helper methods
    public void addOption(PollOptionEntity option) {
        options.add(option);
        option.setPoll(this);
    }

    public void removeOption(PollOptionEntity option) {
        options.remove(option);
        option.setPoll(null);
    }

    public void endPoll() {
        this.active = false;
        this.endedAt = LocalDateTime.now();
    }
}