package com.wildcastradio.ChatMessage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Service responsible for scheduled cleanup of old chat messages
 * Automatically deletes messages older than 7 days to keep the database clean
 */
@Service
public class ChatMessageCleanupService {

    private static final Logger logger = LoggerFactory.getLogger(ChatMessageCleanupService.class);

    @Autowired
    private ChatMessageService chatMessageService;

    /**
     * Scheduled task to clean up old chat messages
     * Runs daily at 2:00 AM to delete messages older than 7 days
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanupOldMessages() {
        logger.info("Starting scheduled cleanup of old chat messages");
        
        try {
            int deletedCount = chatMessageService.cleanupOldMessages();
            
            if (deletedCount > 0) {
                logger.info("Scheduled cleanup completed successfully. Deleted {} old messages", deletedCount);
            } else {
                logger.debug("Scheduled cleanup completed. No old messages found to delete");
            }
        } catch (Exception e) {
            logger.error("Error occurred during scheduled message cleanup", e);
        }
    }

    /**
     * Manual cleanup method that can be called on-demand
     * 
     * @return Number of messages deleted
     */
    public int performManualCleanup() {
        logger.info("Manual cleanup of old chat messages requested");
        
        try {
            int deletedCount = chatMessageService.cleanupOldMessages();
            logger.info("Manual cleanup completed. Deleted {} old messages", deletedCount);
            return deletedCount;
        } catch (Exception e) {
            logger.error("Error occurred during manual message cleanup", e);
            throw new RuntimeException("Failed to perform manual cleanup", e);
        }
    }

    /**
     * Get statistics about messages that would be cleaned up
     * 
     * @return Number of messages older than 7 days
     */
    public long getCleanupStatistics() {
        return chatMessageService.getOldMessagesCount();
    }
}