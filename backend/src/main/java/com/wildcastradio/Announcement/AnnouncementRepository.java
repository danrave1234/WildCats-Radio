package com.wildcastradio.Announcement;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AnnouncementRepository extends JpaRepository<AnnouncementEntity, Long> {
    
    /**
     * Find published announcements (pinned first, then by date)
     */
    @Query("SELECT a FROM AnnouncementEntity a WHERE a.status = 'PUBLISHED' " +
           "ORDER BY a.pinned DESC, a.pinnedAt DESC, a.publishedAt DESC, a.createdAt DESC")
    Page<AnnouncementEntity> findPublishedAnnouncements(Pageable pageable);

    /**
     * Find all announcements by status
     */
    Page<AnnouncementEntity> findByStatusOrderByCreatedAtDesc(AnnouncementStatus status, Pageable pageable);

    /**
     * Find announcements created by a specific user
     */
    Page<AnnouncementEntity> findByCreatedByIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /**
     * Find scheduled announcements that are ready to publish
     */
    @Query("SELECT a FROM AnnouncementEntity a WHERE a.status = 'SCHEDULED' " +
           "AND a.scheduledFor <= :now")
    List<AnnouncementEntity> findScheduledAnnouncementsReadyToPublish(@Param("now") LocalDateTime now);

    /**
     * Find published announcements that have expired
     */
    @Query("SELECT a FROM AnnouncementEntity a WHERE a.status = 'PUBLISHED' " +
           "AND a.expiresAt IS NOT NULL AND a.expiresAt <= :now")
    List<AnnouncementEntity> findExpiredAnnouncements(@Param("now") LocalDateTime now);

    /**
     * Count pinned announcements
     */
    long countByPinnedTrue();
}