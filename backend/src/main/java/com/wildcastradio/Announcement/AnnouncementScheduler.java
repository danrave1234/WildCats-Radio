package com.wildcastradio.Announcement;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Scheduled tasks for announcements:
 * - Auto-publish scheduled announcements
 * - Auto-archive expired announcements
 */
@Service
public class AnnouncementScheduler {

    private static final Logger logger = LoggerFactory.getLogger(AnnouncementScheduler.class);

    private final AnnouncementRepository announcementRepository;

    public AnnouncementScheduler(AnnouncementRepository announcementRepository) {
        this.announcementRepository = announcementRepository;
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