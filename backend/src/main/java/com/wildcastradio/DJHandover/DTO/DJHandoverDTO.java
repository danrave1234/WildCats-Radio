package com.wildcastradio.DJHandover.DTO;

import java.time.LocalDateTime;

import com.wildcastradio.DJHandover.DJHandoverEntity;
import com.wildcastradio.User.DTO.UserDTO;

public class DJHandoverDTO {
    private Long id;
    private Long broadcastId;
    private UserDTO previousDJ;
    private UserDTO newDJ;
    private LocalDateTime handoverTime;
    private UserDTO initiatedBy;
    private String reason;
    private Long durationSeconds;
    private LocalDateTime createdAt;

    // Constructors
    public DJHandoverDTO() {
    }

    public DJHandoverDTO(Long id, Long broadcastId, UserDTO previousDJ, UserDTO newDJ,
                        LocalDateTime handoverTime, UserDTO initiatedBy, String reason,
                        Long durationSeconds, LocalDateTime createdAt) {
        this.id = id;
        this.broadcastId = broadcastId;
        this.previousDJ = previousDJ;
        this.newDJ = newDJ;
        this.handoverTime = handoverTime;
        this.initiatedBy = initiatedBy;
        this.reason = reason;
        this.durationSeconds = durationSeconds;
        this.createdAt = createdAt;
    }

    // Convert from Entity to DTO
    public static DJHandoverDTO fromEntity(DJHandoverEntity handover) {
        if (handover == null) {
            return null;
        }

        UserDTO previousDJDTO = handover.getPreviousDJ() != null ? 
            UserDTO.fromEntity(handover.getPreviousDJ()) : null;
        UserDTO newDJDTO = handover.getNewDJ() != null ? 
            UserDTO.fromEntity(handover.getNewDJ()) : null;
        UserDTO initiatedByDTO = handover.getInitiatedBy() != null ? 
            UserDTO.fromEntity(handover.getInitiatedBy()) : null;

        return new DJHandoverDTO(
            handover.getId(),
            handover.getBroadcastId(),
            previousDJDTO,
            newDJDTO,
            handover.getHandoverTime(),
            initiatedByDTO,
            handover.getReason(),
            handover.getDurationSeconds(),
            handover.getCreatedAt()
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

    public UserDTO getPreviousDJ() {
        return previousDJ;
    }

    public void setPreviousDJ(UserDTO previousDJ) {
        this.previousDJ = previousDJ;
    }

    public UserDTO getNewDJ() {
        return newDJ;
    }

    public void setNewDJ(UserDTO newDJ) {
        this.newDJ = newDJ;
    }

    public LocalDateTime getHandoverTime() {
        return handoverTime;
    }

    public void setHandoverTime(LocalDateTime handoverTime) {
        this.handoverTime = handoverTime;
    }

    public UserDTO getInitiatedBy() {
        return initiatedBy;
    }

    public void setInitiatedBy(UserDTO initiatedBy) {
        this.initiatedBy = initiatedBy;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Long getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Long durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

