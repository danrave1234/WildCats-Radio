package com.wildcastradio.Poll.DTO;

import java.time.LocalDateTime;
import java.util.List;

public class PollDTO {
    private Long id;
    private String question;
    private LocalDateTime createdAt;
    private LocalDateTime endedAt;
    private boolean active;
    private Long createdById;
    private String createdByName;
    private Long broadcastId;
    private List<PollOptionDTO> options;
    private long totalVotes;

    // Constructors
    public PollDTO() {
    }

    public PollDTO(Long id, String question, LocalDateTime createdAt, LocalDateTime endedAt, boolean active,
                  Long createdById, String createdByName, Long broadcastId, List<PollOptionDTO> options, long totalVotes) {
        this.id = id;
        this.question = question;
        this.createdAt = createdAt;
        this.endedAt = endedAt;
        this.active = active;
        this.createdById = createdById;
        this.createdByName = createdByName;
        this.broadcastId = broadcastId;
        this.options = options;
        this.totalVotes = totalVotes;
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

    public Long getCreatedById() {
        return createdById;
    }

    public void setCreatedById(Long createdById) {
        this.createdById = createdById;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public void setCreatedByName(String createdByName) {
        this.createdByName = createdByName;
    }

    public Long getBroadcastId() {
        return broadcastId;
    }

    public void setBroadcastId(Long broadcastId) {
        this.broadcastId = broadcastId;
    }

    public List<PollOptionDTO> getOptions() {
        return options;
    }

    public void setOptions(List<PollOptionDTO> options) {
        this.options = options;
    }

    public long getTotalVotes() {
        return totalVotes;
    }

    public void setTotalVotes(long totalVotes) {
        this.totalVotes = totalVotes;
    }
}