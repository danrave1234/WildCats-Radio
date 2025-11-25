package com.wildcastradio.DJHandover.DTO;

public class HandoverRequestDTO {
    private Long newDJId;
    private String reason;

    // Constructors
    public HandoverRequestDTO() {
    }

    public HandoverRequestDTO(Long newDJId, String reason) {
        this.newDJId = newDJId;
        this.reason = reason;
    }

    // Getters and Setters
    public Long getNewDJId() {
        return newDJId;
    }

    public void setNewDJId(Long newDJId) {
        this.newDJId = newDJId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}

