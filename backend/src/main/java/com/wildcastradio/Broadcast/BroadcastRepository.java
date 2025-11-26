package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;

import com.wildcastradio.Broadcast.BroadcastEntity.BroadcastStatus;
import com.wildcastradio.User.UserEntity;

@Repository
public interface BroadcastRepository extends JpaRepository<BroadcastEntity, Long> {
    
    List<BroadcastEntity> findByCreatedBy(UserEntity dj);
    
    // Find broadcasts where DJ was active (as creator, startedBy, currentActiveDJ, or via handovers)
    @Query("SELECT DISTINCT b FROM BroadcastEntity b " +
           "WHERE b.createdBy = :dj " +
           "OR b.startedBy = :dj " +
           "OR b.currentActiveDJ = :dj " +
           "OR EXISTS (SELECT 1 FROM DJHandoverEntity h WHERE h.broadcast = b AND h.newDJ = :dj)")
    List<BroadcastEntity> findByActiveDJ(@Param("dj") UserEntity dj);
    
    List<BroadcastEntity> findByStatusOrderByActualStartDesc(BroadcastStatus status);
    
    // Backward compatibility method - returns broadcasts ordered by actual start time (newest first)
    default List<BroadcastEntity> findByStatus(BroadcastStatus status) {
        return findByStatusOrderByActualStartDesc(status);
    }
    
    List<BroadcastEntity> findByCreatedByAndStatus(UserEntity dj, BroadcastStatus status);

    Optional<BroadcastEntity> findByCurrentActiveDJAndStatus(UserEntity dj, BroadcastStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM BroadcastEntity b WHERE b.id = :id")
    Optional<BroadcastEntity> findByIdForUpdate(@Param("id") Long id);
    
    // Query methods that work with embedded schedule fields
    @Query("SELECT b FROM BroadcastEntity b WHERE b.scheduledStart > :date")
    List<BroadcastEntity> findByScheduledStartAfter(@Param("date") LocalDateTime date);

    @Query("SELECT b FROM BroadcastEntity b WHERE b.scheduledStart BETWEEN :start AND :end")
    List<BroadcastEntity> findByScheduledStartBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT b FROM BroadcastEntity b WHERE b.status = :status AND b.scheduledStart > :date")
    List<BroadcastEntity> findByStatusAndScheduledStartAfter(@Param("status") BroadcastStatus status, @Param("date") LocalDateTime date);

    // Optimized DTO projection query - eliminates N+1 queries by selecting only needed columns
    // Returns only SCHEDULED broadcasts (excludes COMPLETED, CANCELLED)
    // Uses single query with embedded schedule fields, ~15-25x faster
    @Query("SELECT new com.wildcastradio.Broadcast.DTO.UpcomingBroadcastDTO(" +
           "b.id, b.title, b.description, " +
           "b.scheduledStart, b.scheduledEnd, " +
           "CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, '')) " +
           ") FROM BroadcastEntity b " +
           "JOIN b.createdBy u " +
           "WHERE b.status = :status AND b.scheduledStart > :date " +
           "ORDER BY b.scheduledStart ASC")
    List<com.wildcastradio.Broadcast.DTO.UpcomingBroadcastDTO> findUpcomingBroadcastsDTO(
        @Param("status") BroadcastStatus status,
        @Param("date") LocalDateTime date
    );

    // Optimized projection using embedded schedule fields
    @Query("SELECT new com.wildcastradio.Broadcast.DTO.UpcomingBroadcastDTO(" +
           "b.id, b.title, b.description, " +
           "b.scheduledStart, b.scheduledEnd, " +
           "CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, '')) " +
           ") FROM BroadcastEntity b " +
           "JOIN b.createdBy u " +
           "WHERE b.status = :status AND b.scheduledStart > :date " +
           "ORDER BY b.scheduledStart ASC")
    List<com.wildcastradio.Broadcast.DTO.UpcomingBroadcastDTO> findUpcomingFromScheduleDTO(
        @Param("status") BroadcastStatus status,
        @Param("date") LocalDateTime date,
        Pageable pageable
    );

    @Query("SELECT b FROM BroadcastEntity b WHERE b.status = :status AND b.scheduledStart BETWEEN :start AND :end")
    List<BroadcastEntity> findByStatusAndScheduledStartBetween(@Param("status") BroadcastStatus status, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // History helpers
    @Query("SELECT b FROM BroadcastEntity b WHERE b.status = com.wildcastradio.Broadcast.BroadcastEntity$BroadcastStatus.ENDED AND (b.actualEnd IS NOT NULL OR b.actualStart IS NOT NULL) AND (COALESCE(b.actualEnd, b.actualStart) >= :since) ORDER BY COALESCE(b.actualEnd, b.actualStart) DESC")
    List<BroadcastEntity> findEndedSince(@Param("since") LocalDateTime since);

    @Query("SELECT b FROM BroadcastEntity b WHERE b.status = com.wildcastradio.Broadcast.BroadcastEntity$BroadcastStatus.ENDED AND (b.actualEnd IS NOT NULL OR b.actualStart IS NOT NULL) AND (COALESCE(b.actualEnd, b.actualStart) >= :since) ORDER BY COALESCE(b.actualEnd, b.actualStart) DESC")
    Page<BroadcastEntity> findEndedSince(@Param("since") LocalDateTime since, Pageable pageable);
    
    // Analytics count methods
    long countByStatus(BroadcastStatus status);
    
    @Query("SELECT COUNT(b) FROM BroadcastEntity b WHERE b.status = :status AND b.scheduledStart > :date")
    long countByStatusAndScheduledStartAfter(@Param("status") BroadcastStatus status, @Param("date") LocalDateTime date);
    
    // Fetch broadcasts with chat messages only (for sorting by interactions)
    @Query("SELECT DISTINCT b FROM BroadcastEntity b LEFT JOIN FETCH b.chatMessages")
    List<BroadcastEntity> findAllWithChatMessages();
    
    // Fetch broadcasts by DJ with chat messages only
    @Query("SELECT DISTINCT b FROM BroadcastEntity b LEFT JOIN FETCH b.chatMessages WHERE b.createdBy = :dj")
    List<BroadcastEntity> findByCreatedByWithChatMessages(@Param("dj") com.wildcastradio.User.UserEntity dj);
    
    // Idempotency key lookups
    Optional<BroadcastEntity> findByStartIdempotencyKey(String startIdempotencyKey);
    
    Optional<BroadcastEntity> findByEndIdempotencyKey(String endIdempotencyKey);

    // Search broadcasts by title (paginated)
    Page<BroadcastEntity> findByTitleContainingIgnoreCase(String title, Pageable pageable);

    // Search broadcasts by title and status (paginated)
    Page<BroadcastEntity> findByTitleContainingIgnoreCaseAndStatus(String title, BroadcastStatus status, Pageable pageable);
} 