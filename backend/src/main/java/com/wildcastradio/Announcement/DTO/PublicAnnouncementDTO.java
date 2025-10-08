package com.wildcastradio.Announcement.DTO;

import java.time.LocalDateTime;

import com.wildcastradio.Announcement.AnnouncementStatus;

/**
 * Public-safe DTO for announcements.
 * Omits internal IDs and moderation-only metadata.
 */
public class PublicAnnouncementDTO {
    private Long id;
    private String title;
    private String content;
    private String imageUrl;
    private AnnouncementStatus status;
    private boolean pinned;
    private LocalDateTime pinnedAt;
    private LocalDateTime createdAt;
    private LocalDateTime publishedAt;
    private String createdByName;

    public PublicAnnouncementDTO() {}

    public static PublicAnnouncementDTO fromDTO(AnnouncementDTO dto) {
        if (dto == null) return null;
        PublicAnnouncementDTO p = new PublicAnnouncementDTO();
        p.id = dto.getId();
        p.title = dto.getTitle();
        p.content = dto.getContent();
        p.imageUrl = dto.getImageUrl();
        p.status = dto.getStatus();
        p.pinned = dto.isPinned();
        p.pinnedAt = dto.getPinnedAt();
        p.createdAt = dto.getCreatedAt();
        p.publishedAt = dto.getPublishedAt();
        p.createdByName = dto.getCreatedByName();
        return p;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public String getImageUrl() { return imageUrl; }
    public AnnouncementStatus getStatus() { return status; }
    public boolean isPinned() { return pinned; }
    public LocalDateTime getPinnedAt() { return pinnedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getPublishedAt() { return publishedAt; }
    public String getCreatedByName() { return createdByName; }
}


