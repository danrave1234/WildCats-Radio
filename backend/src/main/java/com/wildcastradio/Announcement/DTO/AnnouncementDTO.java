package com.wildcastradio.Announcement.DTO;

import java.time.LocalDateTime;

import com.wildcastradio.Announcement.AnnouncementEntity;
import com.wildcastradio.Announcement.AnnouncementStatus;

public class AnnouncementDTO {
    private Long id;
    private String title;
    private String content;
    private String imageUrl;
    private AnnouncementStatus status;
    private LocalDateTime scheduledFor;
    private LocalDateTime expiresAt;
    private boolean pinned;
    private LocalDateTime pinnedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime publishedAt;
    private Long createdById;
    private String createdByName;
    private Long approvedById;
    private String approvedByName;
    private Long archivedById;
    private String archivedByName;
    private LocalDateTime archivedAt;
    private Long rejectedById;
    private String rejectedByName;
    private LocalDateTime rejectedAt;
    private String rejectionReason;

    // No-arg constructor
    public AnnouncementDTO() {
    }

    // All args constructor
    public AnnouncementDTO(Long id, String title, String content, String imageUrl, 
                          AnnouncementStatus status, LocalDateTime scheduledFor, 
                          LocalDateTime expiresAt, boolean pinned, LocalDateTime pinnedAt,
                          LocalDateTime createdAt, LocalDateTime updatedAt, LocalDateTime publishedAt,
                          Long createdById, String createdByName,
                          Long approvedById, String approvedByName,
                          Long archivedById, String archivedByName, LocalDateTime archivedAt,
                          Long rejectedById, String rejectedByName, LocalDateTime rejectedAt, String rejectionReason) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.imageUrl = imageUrl;
        this.status = status;
        this.scheduledFor = scheduledFor;
        this.expiresAt = expiresAt;
        this.pinned = pinned;
        this.pinnedAt = pinnedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.publishedAt = publishedAt;
        this.createdById = createdById;
        this.createdByName = createdByName;
        this.approvedById = approvedById;
        this.approvedByName = approvedByName;
        this.archivedById = archivedById;
        this.archivedByName = archivedByName;
        this.archivedAt = archivedAt;
        this.rejectedById = rejectedById;
        this.rejectedByName = rejectedByName;
        this.rejectedAt = rejectedAt;
        this.rejectionReason = rejectionReason;
    }

    // Factory method to create DTO from Entity
    public static AnnouncementDTO fromEntity(AnnouncementEntity entity) {
        if (entity == null) {
            return null;
        }

        String creatorName = entity.getCreatedBy() != null 
            ? entity.getCreatedBy().getFirstname() + " " + entity.getCreatedBy().getLastname()
            : "Unknown";
        
        Long creatorId = entity.getCreatedBy() != null 
            ? entity.getCreatedBy().getId()
            : null;

        String approverName = entity.getApprovedBy() != null 
            ? entity.getApprovedBy().getFirstname() + " " + entity.getApprovedBy().getLastname()
            : null;
        
        Long approverId = entity.getApprovedBy() != null 
            ? entity.getApprovedBy().getId()
            : null;

        String archiverName = entity.getArchivedBy() != null 
            ? entity.getArchivedBy().getFirstname() + " " + entity.getArchivedBy().getLastname()
            : null;
        
        Long archiverId = entity.getArchivedBy() != null 
            ? entity.getArchivedBy().getId()
            : null;

        String rejecterName = entity.getRejectedBy() != null 
            ? entity.getRejectedBy().getFirstname() + " " + entity.getRejectedBy().getLastname()
            : null;
        
        Long rejecterId = entity.getRejectedBy() != null 
            ? entity.getRejectedBy().getId()
            : null;

        return new AnnouncementDTO(
            entity.getId(),
            entity.getTitle(),
            entity.getContent(),
            entity.getImageUrl(),
            entity.getStatus(),
            entity.getScheduledFor(),
            entity.getExpiresAt(),
            entity.isPinned(),
            entity.getPinnedAt(),
            entity.getCreatedAt(),
            entity.getUpdatedAt(),
            entity.getPublishedAt(),
            creatorId,
            creatorName,
            approverId,
            approverName,
            archiverId,
            archiverName,
            entity.getArchivedAt(),
            rejecterId,
            rejecterName,
            entity.getRejectedAt(),
            entity.getRejectionReason()
        );
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

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
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

    public AnnouncementStatus getStatus() {
        return status;
    }

    public void setStatus(AnnouncementStatus status) {
        this.status = status;
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

    public boolean isPinned() {
        return pinned;
    }

    public void setPinned(boolean pinned) {
        this.pinned = pinned;
    }

    public LocalDateTime getPinnedAt() {
        return pinnedAt;
    }

    public void setPinnedAt(LocalDateTime pinnedAt) {
        this.pinnedAt = pinnedAt;
    }

    public LocalDateTime getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(LocalDateTime publishedAt) {
        this.publishedAt = publishedAt;
    }

    public Long getApprovedById() {
        return approvedById;
    }

    public void setApprovedById(Long approvedById) {
        this.approvedById = approvedById;
    }

    public String getApprovedByName() {
        return approvedByName;
    }

    public void setApprovedByName(String approvedByName) {
        this.approvedByName = approvedByName;
    }

    public Long getArchivedById() {
        return archivedById;
    }

    public void setArchivedById(Long archivedById) {
        this.archivedById = archivedById;
    }

    public String getArchivedByName() {
        return archivedByName;
    }

    public void setArchivedByName(String archivedByName) {
        this.archivedByName = archivedByName;
    }

    public LocalDateTime getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(LocalDateTime archivedAt) {
        this.archivedAt = archivedAt;
    }

    public Long getRejectedById() {
        return rejectedById;
    }

    public void setRejectedById(Long rejectedById) {
        this.rejectedById = rejectedById;
    }

    public String getRejectedByName() {
        return rejectedByName;
    }

    public void setRejectedByName(String rejectedByName) {
        this.rejectedByName = rejectedByName;
    }

    public LocalDateTime getRejectedAt() {
        return rejectedAt;
    }

    public void setRejectedAt(LocalDateTime rejectedAt) {
        this.rejectedAt = rejectedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }
}