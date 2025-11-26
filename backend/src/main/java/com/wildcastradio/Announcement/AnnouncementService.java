package com.wildcastradio.Announcement;

import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.Announcement.DTO.AnnouncementDTO;
import com.wildcastradio.Announcement.DTO.CreateAnnouncementRequest;
import com.wildcastradio.Announcement.DTO.ScheduleAnnouncementRequest;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserEntity.UserRole;
import com.wildcastradio.storage.GcsStorageService;
import com.wildcastradio.Notification.NotificationService;
import com.wildcastradio.Notification.NotificationType;
import com.wildcastradio.User.UserService;

@Service
public class AnnouncementService {

    private static final int MAX_PINNED_ANNOUNCEMENTS = 2;
    private final AnnouncementRepository announcementRepository;
    private final GcsStorageService gcsStorageService;
    private final NotificationService notificationService;
    private final UserService userService;

    public AnnouncementService(AnnouncementRepository announcementRepository, GcsStorageService gcsStorageService,
                               NotificationService notificationService, UserService userService) {
        this.announcementRepository = announcementRepository;
        this.gcsStorageService = gcsStorageService;
        this.notificationService = notificationService;
        this.userService = userService;
    }

    /**
     * Get published announcements for public view (pinned first, then by date)
     */
    @Transactional(readOnly = true)
    public Page<AnnouncementDTO> getPublishedAnnouncements(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AnnouncementEntity> announcements = announcementRepository.findPublishedAnnouncements(pageable);
        return announcements.map(AnnouncementDTO::fromEntity);
    }

    /**
     * Get announcements by status (for moderators/admins)
     */
    @Transactional(readOnly = true)
    public Page<AnnouncementDTO> getAnnouncementsByStatus(AnnouncementStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AnnouncementEntity> announcements = 
            announcementRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
        return announcements.map(AnnouncementDTO::fromEntity);
    }

    /**
     * Get user's own announcements (for DJs to see their drafts)
     */
    @Transactional(readOnly = true)
    public Page<AnnouncementDTO> getUserAnnouncements(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AnnouncementEntity> announcements = 
            announcementRepository.findByCreatedByIdOrderByCreatedAtDesc(userId, pageable);
        return announcements.map(AnnouncementDTO::fromEntity);
    }

    /**
     * Get a single announcement by ID
     */
    @Transactional(readOnly = true)
    public AnnouncementDTO getAnnouncementById(Long id) {
        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));
        return AnnouncementDTO.fromEntity(announcement);
    }

    /**
     * Create a new announcement
     * Always starts as DRAFT; publishing/scheduling is handled explicitly.
     */
    @Transactional
    public AnnouncementDTO createAnnouncement(CreateAnnouncementRequest request, UserEntity creator) {
        AnnouncementEntity announcement = new AnnouncementEntity();
        // Sanitize inputs: trim title, imageUrl; remove trailing whitespace/newlines for content
        String title = request.getTitle() != null ? request.getTitle().trim() : null;
        String imageUrl = request.getImageUrl() != null ? request.getImageUrl().trim() : null;
        String content = request.getContent() != null ? request.getContent().replaceAll("\\s+$", "") : null;

        announcement.setTitle(title);
        announcement.setContent(content);
        announcement.setImageUrl(imageUrl);
        announcement.setCreatedBy(creator);
        announcement.setCreatedAt(LocalDateTime.now());
        // Always start as DRAFT; further state changes happen via publish/schedule endpoints
        announcement.setStatus(AnnouncementStatus.DRAFT);

        AnnouncementEntity saved = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(saved);
    }

    /**
     * Update an announcement
     * - DJs: Can ONLY edit their own DRAFT announcements
     * - Moderators/Admins: Can edit any announcement at any status
     */
    @Transactional
    public AnnouncementDTO updateAnnouncement(Long id, CreateAnnouncementRequest request, UserEntity updater) {
        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        boolean isCreator = announcement.getCreatedBy().getId().equals(updater.getId());
        boolean isModerator = updater.getRole() == UserRole.MODERATOR || updater.getRole() == UserRole.ADMIN;

        // DJs can ONLY edit their own drafts or rejected announcements
        if (updater.getRole() == UserRole.DJ) {
            if (!isCreator) {
                throw new RuntimeException("DJs can only edit their own announcements");
            }
            if (announcement.getStatus() != AnnouncementStatus.DRAFT && announcement.getStatus() != AnnouncementStatus.REJECTED) {
                throw new RuntimeException("DJs can only edit draft or rejected announcements. This announcement is " + announcement.getStatus());
            }
        }

        // Non-moderators who aren't the creator cannot edit
        if (!isCreator && !isModerator) {
            throw new RuntimeException("You are not authorized to update this announcement");
        }

        String title = request.getTitle() != null ? request.getTitle().trim() : null;
        String newImageUrl = request.getImageUrl() != null ? request.getImageUrl().trim() : null;
        String content = request.getContent() != null ? request.getContent().replaceAll("\\s+$", "") : null;

        // If the user explicitly removed the image (clicked X), newImageUrl will be blank.
        String oldImageUrl = announcement.getImageUrl();
        boolean oldHasImage = oldImageUrl != null && !oldImageUrl.trim().isEmpty();
        boolean removedNow = (newImageUrl == null || newImageUrl.isEmpty()) && oldHasImage;
        if (removedNow) {
            try {
                gcsStorageService.deleteByPublicUrl(oldImageUrl);
            } catch (Exception _e) {
                // best-effort cleanup; do not block update
            }
        }

        announcement.setTitle(title);
        announcement.setContent(content);
        announcement.setImageUrl(newImageUrl);
        announcement.setUpdatedAt(LocalDateTime.now());

        AnnouncementEntity updated = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(updated);
    }

    /**
     * Publish a draft announcement (Moderators/Admins only)
     */
    @Transactional
    public AnnouncementDTO publishAnnouncement(Long id, UserEntity publisher) {
        if (publisher.getRole() != UserRole.MODERATOR && publisher.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only moderators and admins can publish announcements");
        }

        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        if (announcement.getStatus() != AnnouncementStatus.DRAFT) {
            throw new RuntimeException("Only draft announcements can be published");
        }

        announcement.setStatus(AnnouncementStatus.PUBLISHED);
        announcement.setPublishedAt(LocalDateTime.now());
        announcement.setApprovedBy(publisher);
        announcement.setUpdatedAt(LocalDateTime.now());

        AnnouncementEntity published = announcementRepository.save(announcement);

        // Broadcast notification for published announcement
        broadcastAnnouncementPublished(published);
        notificationService.sendPublicAnnouncementToast(published, "New announcement: " + (published.getTitle() != null ? published.getTitle() : "View details"));

        return AnnouncementDTO.fromEntity(published);
    }

    /**
     * Schedule an announcement for future publication (Moderators/Admins only)
     */
    @Transactional
    public AnnouncementDTO scheduleAnnouncement(Long id, ScheduleAnnouncementRequest request, UserEntity scheduler) {
        if (scheduler.getRole() != UserRole.MODERATOR && scheduler.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only moderators and admins can schedule announcements");
        }

        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        if (announcement.getStatus() != AnnouncementStatus.DRAFT) {
            throw new RuntimeException("Only draft announcements can be scheduled");
        }

        if (request.getScheduledFor() == null || request.getScheduledFor().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Scheduled time must be in the future");
        }

        announcement.setStatus(AnnouncementStatus.SCHEDULED);
        announcement.setScheduledFor(request.getScheduledFor());
        announcement.setExpiresAt(request.getExpiresAt());
        announcement.setApprovedBy(scheduler);
        announcement.setUpdatedAt(LocalDateTime.now());

        AnnouncementEntity scheduled = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(scheduled);
    }

    /**
     * Pin an announcement (Moderators/Admins only, max 2 pinned)
     */
    @Transactional
    public AnnouncementDTO pinAnnouncement(Long id, UserEntity pinner) {
        if (pinner.getRole() != UserRole.MODERATOR && pinner.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only moderators and admins can pin announcements");
        }

        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        if (announcement.getStatus() != AnnouncementStatus.PUBLISHED) {
            throw new RuntimeException("Only published announcements can be pinned");
        }

        if (announcement.isPinned()) {
            throw new RuntimeException("Announcement is already pinned");
        }

        // Check pinned count limit
        long pinnedCount = announcementRepository.countByPinnedTrue();
        if (pinnedCount >= MAX_PINNED_ANNOUNCEMENTS) {
            throw new RuntimeException("Maximum " + MAX_PINNED_ANNOUNCEMENTS + " announcements can be pinned. Unpin one first.");
        }

        announcement.setPinned(true);
        announcement.setPinnedAt(LocalDateTime.now());
        announcement.setUpdatedAt(LocalDateTime.now());

        AnnouncementEntity pinned = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(pinned);
    }

    /**
     * Unpin an announcement (Moderators/Admins only)
     */
    @Transactional
    public AnnouncementDTO unpinAnnouncement(Long id, UserEntity unpinner) {
        if (unpinner.getRole() != UserRole.MODERATOR && unpinner.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only moderators and admins can unpin announcements");
        }

        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        if (!announcement.isPinned()) {
            throw new RuntimeException("Announcement is not pinned");
        }

        announcement.setPinned(false);
        announcement.setPinnedAt(null);
        announcement.setUpdatedAt(LocalDateTime.now());

        AnnouncementEntity unpinned = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(unpinned);
    }

    /**
     * Archive an announcement (Moderators/Admins only)
     */
    @Transactional
    public AnnouncementDTO archiveAnnouncement(Long id, UserEntity archiver) {
        if (archiver.getRole() != UserRole.MODERATOR && archiver.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only moderators and admins can archive announcements");
        }

        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        if (announcement.getStatus() == AnnouncementStatus.ARCHIVED) {
            throw new RuntimeException("Announcement is already archived");
        }

        announcement.setStatus(AnnouncementStatus.ARCHIVED);
        announcement.setArchivedBy(archiver);
        announcement.setArchivedAt(LocalDateTime.now());
        announcement.setUpdatedAt(LocalDateTime.now());

        // Remove pin when archiving
        if (announcement.isPinned()) {
            announcement.setPinned(false);
            announcement.setPinnedAt(null);
        }

        AnnouncementEntity archived = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(archived);
    }

    /**
     * Unarchive an announcement (Moderators/Admins only)
     */
    @Transactional
    public AnnouncementDTO unarchiveAnnouncement(Long id, UserEntity unarchiver) {
        if (unarchiver.getRole() != UserRole.MODERATOR && unarchiver.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only moderators and admins can unarchive announcements");
        }

        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        if (announcement.getStatus() != AnnouncementStatus.ARCHIVED) {
            throw new RuntimeException("Only archived announcements can be unarchived");
        }

        // Restore to published status
        announcement.setStatus(AnnouncementStatus.PUBLISHED);
        announcement.setArchivedBy(null);
        announcement.setArchivedAt(null);
        announcement.setUpdatedAt(LocalDateTime.now());

        AnnouncementEntity unarchived = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(unarchived);
    }

    /**
     * Reject an announcement (Moderators/Admins only)
     * Instead of deleting, marks as REJECTED so DJ can revise and resubmit
     */
    @Transactional
    public AnnouncementDTO rejectAnnouncement(Long id, String rejectionReason, UserEntity rejecter) {
        if (rejecter.getRole() != UserRole.MODERATOR && rejecter.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only moderators and admins can reject announcements");
        }

        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        if (announcement.getStatus() != AnnouncementStatus.DRAFT) {
            throw new RuntimeException("Only draft announcements can be rejected");
        }

        announcement.setStatus(AnnouncementStatus.REJECTED);
        announcement.setRejectedBy(rejecter);
        announcement.setRejectedAt(LocalDateTime.now());
        announcement.setRejectionReason(rejectionReason);
        announcement.setUpdatedAt(LocalDateTime.now());

        AnnouncementEntity rejected = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(rejected);
    }

    /**
     * Resubmit a rejected announcement (DJ only, their own)
     * Clears rejection data and returns status to DRAFT
     */
    @Transactional
    public AnnouncementDTO resubmitAnnouncement(Long id, UserEntity submitter) {
        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        if (announcement.getStatus() != AnnouncementStatus.REJECTED) {
            throw new RuntimeException("Only rejected announcements can be resubmitted");
        }

        boolean isCreator = announcement.getCreatedBy().getId().equals(submitter.getId());
        if (!isCreator) {
            throw new RuntimeException("You can only resubmit your own announcements");
        }

        // Clear rejection data and return to DRAFT
        announcement.setStatus(AnnouncementStatus.DRAFT);
        announcement.setRejectedBy(null);
        announcement.setRejectedAt(null);
        announcement.setRejectionReason(null);
        announcement.setUpdatedAt(LocalDateTime.now());

        AnnouncementEntity resubmitted = announcementRepository.save(announcement);
        return AnnouncementDTO.fromEntity(resubmitted);
    }

    /**
     * Delete an announcement
     * - DJs: Can ONLY delete their own DRAFT announcements
     * - Moderators/Admins: Can delete any announcement at any status
     */
    @Transactional
    public void deleteAnnouncement(Long id, UserEntity deleter) {
        AnnouncementEntity announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found with id: " + id));

        boolean isCreator = announcement.getCreatedBy().getId().equals(deleter.getId());
        boolean isModerator = deleter.getRole() == UserRole.MODERATOR || deleter.getRole() == UserRole.ADMIN;

        // DJs can ONLY delete their own drafts
        if (deleter.getRole() == UserRole.DJ) {
            if (!isCreator) {
                throw new RuntimeException("DJs can only delete their own announcements");
            }
            if (announcement.getStatus() != AnnouncementStatus.DRAFT) {
                throw new RuntimeException("DJs can only delete draft announcements. This announcement is " + announcement.getStatus());
            }
        }

        // Non-moderators who aren't the creator cannot delete
        if (!isCreator && !isModerator) {
            throw new RuntimeException("You are not authorized to delete this announcement");
        }

        // Best-effort delete of associated image from GCS (scoped to our bucket/prefix)
        String oldImageUrl = announcement.getImageUrl();
        if (oldImageUrl != null && !oldImageUrl.trim().isEmpty()) {
            try {
                gcsStorageService.deleteByPublicUrl(oldImageUrl);
            } catch (Exception _e) {
                // ignore failures
            }
        }

        announcementRepository.delete(announcement);
    }

    private void broadcastAnnouncementPublished(AnnouncementEntity announcement) {
        try {
            String message = "New announcement: " + (announcement.getTitle() != null ? announcement.getTitle() : "View details");
            userService.findAllUsers().forEach(user -> {
                notificationService.sendNotificationWithAnnouncement(
                    user,
                    message,
                    NotificationType.ANNOUNCEMENT_PUBLISHED,
                    announcement
                );
            });
        } catch (Exception _e) {
            // Fail-soft: do not interrupt publish flow
        }
    }
}