package com.wildcastradio.User.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class HandoverLoginRequest {
    @NotNull(message = "Broadcast ID is required")
    private Long broadcastId;
    
    @NotNull(message = "New DJ ID is required")
    private Long newDJId;
    
    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
    private String password;
    
    @Size(max = 500, message = "Reason cannot exceed 500 characters")
    private String reason;

    // Constructors
    public HandoverLoginRequest() {
    }

    public HandoverLoginRequest(Long broadcastId, Long newDJId, String password, String reason) {
        this.broadcastId = broadcastId;
        this.newDJId = newDJId;
        this.password = password;
        this.reason = reason;
    }

    // Getters and Setters
    public Long getBroadcastId() {
        return broadcastId;
    }

    public void setBroadcastId(Long broadcastId) {
        this.broadcastId = broadcastId;
    }

    public Long getNewDJId() {
        return newDJId;
    }

    public void setNewDJId(Long newDJId) {
        this.newDJId = newDJId;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}

