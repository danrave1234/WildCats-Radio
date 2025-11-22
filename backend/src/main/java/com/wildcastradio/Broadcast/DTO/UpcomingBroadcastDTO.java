package com.wildcastradio.Broadcast.DTO;

import java.time.LocalDateTime;

import com.wildcastradio.Broadcast.BroadcastEntity;

/**
 * Lightweight DTO for public/upcoming schedules. Contains only the
 * information needed by the Schedule page and public consumers.
 */
public class UpcomingBroadcastDTO {
    private Long id;
    private String title;
    private String description;
    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;
    private String createdByName; // e.g., "First Last"

    public UpcomingBroadcastDTO() {}

    public UpcomingBroadcastDTO(Long id, String title, String description,
                                LocalDateTime scheduledStart, LocalDateTime scheduledEnd,
                                String createdByName) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.scheduledStart = scheduledStart;
        this.scheduledEnd = scheduledEnd;
        // Trim and clean up name (CONCAT may produce extra spaces)
        this.createdByName = (createdByName != null && !createdByName.trim().isEmpty()) 
            ? createdByName.trim() 
            : null;
    }

    public static UpcomingBroadcastDTO fromEntity(BroadcastEntity broadcast) {
        if (broadcast == null) return null;

        String name = null;
        if (broadcast.getCreatedBy() != null) {
            String first = broadcast.getCreatedBy().getFirstname();
            String last = broadcast.getCreatedBy().getLastname();
            StringBuilder sb = new StringBuilder();
            if (first != null && !first.isBlank()) sb.append(first.trim());
            if (last != null && !last.isBlank()) {
                if (sb.length() > 0) sb.append(' ');
                sb.append(last.trim());
            }
            name = sb.length() > 0 ? sb.toString() : null;
        }

        return new UpcomingBroadcastDTO(
            broadcast.getId(),
            broadcast.getTitle(),
            broadcast.getDescription(),
            broadcast.getScheduledStart(),
            broadcast.getScheduledEnd(),
            name
        );
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getScheduledStart() { return scheduledStart; }
    public void setScheduledStart(LocalDateTime scheduledStart) { this.scheduledStart = scheduledStart; }
    public LocalDateTime getScheduledEnd() { return scheduledEnd; }
    public void setScheduledEnd(LocalDateTime scheduledEnd) { this.scheduledEnd = scheduledEnd; }
    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }
}



