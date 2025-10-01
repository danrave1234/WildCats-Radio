package com.wildcastradio.Announcement.DTO;

import java.time.LocalDateTime;

public class ScheduleAnnouncementRequest {
    private LocalDateTime scheduledFor;
    private LocalDateTime expiresAt;

    public ScheduleAnnouncementRequest() {
    }

    public ScheduleAnnouncementRequest(LocalDateTime scheduledFor, LocalDateTime expiresAt) {
        this.scheduledFor = scheduledFor;
        this.expiresAt = expiresAt;
    }

    public LocalDateTime getScheduledFor() {
        return scheduledFor;
    }

    public void setScheduledFor(LocalDateTime scheduledFor) {
        this.scheduledFor = scheduledFor;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }
}