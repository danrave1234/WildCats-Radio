package com.wildcastradio.Announcement;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.Notification.NotificationService;
import com.wildcastradio.Notification.NotificationType;
import com.wildcastradio.User.UserService;

/**
 * Scheduled tasks for announcements:
 * - Auto-publish scheduled announcements
 * - Auto-archive expired announcements
 */
@Service
public class AnnouncementScheduler {

    private static final Logger logger = LoggerFactory.getLogger(AnnouncementScheduler.class);

    private final AnnouncementRepository announcementRepository;
    private final NotificationService notificationService;
    private final UserService userService;

    public AnnouncementScheduler(AnnouncementRepository announcementRepository,
                                 NotificationService notificationService,
                                 UserService userService) {
        this.announcementRepository = announcementRepository;
        this.notificationService = notificationService;
        this.userService = userService;
    }

    /**
     * Auto-publish scheduled announcements every minute
     */
    @Scheduled(cron = "0 * * * * *") // Every minute at :00 seconds
    @Transactional
    public void publishScheduledAnnouncements() {
        try {
            LocalDateTime now = LocalDateTime.now();
            List<AnnouncementEntity> readyToPublish = 
                announcementRepository.findScheduledAnnouncementsReadyToPublish(now);

            if (!readyToPublish.isEmpty()) {
                logger.info("Publishing {} scheduled announcements", readyToPublish.size());
                
                for (AnnouncementEntity announcement : readyToPublish) {
                    announcement.setStatus(AnnouncementStatus.PUBLISHED);
                    announcement.setPublishedAt(LocalDateTime.now());
                    announcementRepository.save(announcement);
                    
                    logger.info("Published announcement: {} (ID: {})", 
                        announcement.getTitle(), announcement.getId());

                    // Notify all users for each published announcement
                    final AnnouncementEntity published = announcement;
                    String message = "New announcement: " + (published.getTitle() != null ? published.getTitle() : "View details");
                    userService.findAllUsers().forEach(user -> {
                        notificationService.sendNotificationWithAnnouncement(
                            user,
                            message,
                            NotificationType.ANNOUNCEMENT_PUBLISHED,
                            published
                        );
                    });
                    notificationService.sendPublicAnnouncementToast(published, message);
                }
            }
        } catch (Exception e) {
            logger.error("Error publishing scheduled announcements", e);
        }
    }

    /**
     * Auto-archive expired announcements every 5 minutes
     */
    @Scheduled(cron = "0 */5 * * * *") // Every 5 minutes
    @Transactional
    public void archiveExpiredAnnouncements() {
        try {
            LocalDateTime now = LocalDateTime.now();
            List<AnnouncementEntity> expired = 
                announcementRepository.findExpiredAnnouncements(now);

            if (!expired.isEmpty()) {
                logger.info("Archiving {} expired announcements", expired.size());
                
                for (AnnouncementEntity announcement : expired) {
                    announcement.setStatus(AnnouncementStatus.ARCHIVED);
                    announcement.setUpdatedAt(LocalDateTime.now());
                    // Remove pin when archiving
                    if (announcement.isPinned()) {
                        announcement.setPinned(false);
                        announcement.setPinnedAt(null);
                    }
                    announcementRepository.save(announcement);
                    
                    logger.info("Archived announcement: {} (ID: {})", 
                        announcement.getTitle(), announcement.getId());
                }
            }
        } catch (Exception e) {
            logger.error("Error archiving expired announcements", e);
        }
    }
}