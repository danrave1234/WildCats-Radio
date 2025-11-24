package com.wildcastradio.DJHandover;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface DJHandoverRepository extends JpaRepository<DJHandoverEntity, Long> {

    // Find all handovers for a specific broadcast, ordered by handover time
    List<DJHandoverEntity> findByBroadcast_IdOrderByHandoverTimeAsc(Long broadcastId);

    // Find handovers for a specific DJ (as new DJ)
    List<DJHandoverEntity> findByNewDJ_IdOrderByHandoverTimeDesc(Long djId);

    // Find handovers for a specific broadcast and DJ
    List<DJHandoverEntity> findByBroadcast_IdAndNewDJ_IdOrderByHandoverTimeAsc(Long broadcastId, Long djId);

    // Find the most recent handover for a broadcast
    Optional<DJHandoverEntity> findFirstByBroadcast_IdOrderByHandoverTimeDesc(Long broadcastId);

    // Find handovers within a time range for a broadcast
    @Query("SELECT h FROM DJHandoverEntity h WHERE h.broadcast.id = :broadcastId AND h.handoverTime BETWEEN :startTime AND :endTime ORDER BY h.handoverTime ASC")
    List<DJHandoverEntity> findByBroadcast_IdAndHandoverTimeBetween(
        @Param("broadcastId") Long broadcastId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime
    );

    // Count handovers for a specific DJ
    long countByNewDJ_Id(Long djId);

    // Count handovers for a specific broadcast
    long countByBroadcast_Id(Long broadcastId);

    // Find recent handovers initiated by a specific user for a broadcast (for permission validation)
    List<DJHandoverEntity> findByBroadcast_IdAndInitiatedBy_IdAndHandoverTimeAfter(
        Long broadcastId, Long initiatorId, LocalDateTime sinceTime);
}

