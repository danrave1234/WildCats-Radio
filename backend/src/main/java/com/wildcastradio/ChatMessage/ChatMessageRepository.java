package com.wildcastradio.ChatMessage;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {

	// Find all messages for a specific broadcast, ordered by creation time
	List<ChatMessageEntity> findByBroadcast_IdOrderByCreatedAtAsc(Long broadcastId);

	// Paged access for large exports
	Page<ChatMessageEntity> findByBroadcast_IdOrderByCreatedAtAsc(Long broadcastId, Pageable pageable);

	// Find messages older than specified date for cleanup
	List<ChatMessageEntity> findByCreatedAtBefore(LocalDateTime cutoffDate);

	// Delete messages older than specified date
	@Modifying
	@Query("DELETE FROM ChatMessageEntity c WHERE c.createdAt < :cutoffDate")
	int deleteByCreatedAtBefore(@Param("cutoffDate") LocalDateTime cutoffDate);

	// Count messages older than specified date
	long countByCreatedAtBefore(LocalDateTime cutoffDate);

	// Count messages within a time range
	long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
	
	// Count messages for a specific broadcast
	long countByBroadcast_Id(Long broadcastId);
	
	// Count messages for a specific broadcast within a time range
	@Query("SELECT COUNT(c) FROM ChatMessageEntity c WHERE c.broadcast.id = :broadcastId AND c.createdAt BETWEEN :start AND :end")
	long countByBroadcast_IdAndCreatedAtBetween(@Param("broadcastId") Long broadcastId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
	
	// Bulk count: Count all messages for broadcasts created by a specific DJ
	@Query("SELECT COUNT(c) FROM ChatMessageEntity c WHERE c.broadcast.createdBy.id = :userId")
	long countByBroadcast_CreatedBy_Id(@Param("userId") Long userId);
	
	// Bulk count: Count messages for DJ's broadcasts within a time range
	@Query("SELECT COUNT(c) FROM ChatMessageEntity c WHERE c.broadcast.createdBy.id = :userId AND c.createdAt BETWEEN :start AND :end")
	long countByBroadcast_CreatedBy_IdAndCreatedAtBetween(@Param("userId") Long userId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
	
	// Batch aggregation: Get message counts grouped by broadcast ID for multiple broadcasts
	@Query("SELECT c.broadcast.id, COUNT(c) FROM ChatMessageEntity c WHERE c.broadcast.id IN :broadcastIds GROUP BY c.broadcast.id")
	List<Object[]> countMessagesByBroadcastIds(@Param("broadcastIds") List<Long> broadcastIds);
}
