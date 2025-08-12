package com.wildcastradio.ChatMessage;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {

    // Find all messages for a specific broadcast, ordered by creation time
    List<ChatMessageEntity> findByBroadcast_IdOrderByCreatedAtAsc(Long broadcastId);

    // Find messages older than specified date for cleanup
    List<ChatMessageEntity> findByCreatedAtBefore(LocalDateTime cutoffDate);

    // Delete messages older than specified date
    @Modifying
    @Query("DELETE FROM ChatMessageEntity c WHERE c.createdAt < :cutoffDate")
    int deleteByCreatedAtBefore(@Param("cutoffDate") LocalDateTime cutoffDate);

    // Count messages older than specified date
    long countByCreatedAtBefore(LocalDateTime cutoffDate);
}
