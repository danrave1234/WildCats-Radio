package com.wildcastradio.Broadcast;

import com.wildcastradio.Broadcast.DTO.BroadcastDTO;

/**
 * WebSocket message wrapper for broadcast messages
 */
public class BroadcastWebSocketMessage {
    private String type;
    private BroadcastDTO broadcast;
    private Long broadcastId;
    private Object data;

    public BroadcastWebSocketMessage() {}

    public BroadcastWebSocketMessage(String type, BroadcastDTO broadcast) {
        this.type = type;
        this.broadcast = broadcast;
        this.broadcastId = broadcast != null ? broadcast.getId() : null;
    }

    public BroadcastWebSocketMessage(String type, Long broadcastId) {
        this.type = type;
        this.broadcastId = broadcastId;
    }

    public BroadcastWebSocketMessage(String type, Long broadcastId, Object data) {
        this.type = type;
        this.broadcastId = broadcastId;
        this.data = data;
    }

    // Getters and setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public BroadcastDTO getBroadcast() {
        return broadcast;
    }

    public void setBroadcast(BroadcastDTO broadcast) {
        this.broadcast = broadcast;
    }

    public Long getBroadcastId() {
        return broadcastId;
    }

    public void setBroadcastId(Long broadcastId) {
        this.broadcastId = broadcastId;
    }

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }
} 