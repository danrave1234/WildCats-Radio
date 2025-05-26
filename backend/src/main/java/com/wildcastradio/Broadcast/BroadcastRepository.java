package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.wildcastradio.Broadcast.BroadcastEntity.BroadcastStatus;
import com.wildcastradio.User.UserEntity;

@Repository
public interface BroadcastRepository extends JpaRepository<BroadcastEntity, Long> {
    
    List<BroadcastEntity> findByCreatedBy(UserEntity dj);
    
    List<BroadcastEntity> findByStatus(BroadcastStatus status);
    
    List<BroadcastEntity> findByCreatedByAndStatus(UserEntity dj, BroadcastStatus status);
    
    // Query methods that work with the schedule relationship
    @Query("SELECT b FROM BroadcastEntity b WHERE b.schedule.scheduledStart > :date")
    List<BroadcastEntity> findByScheduledStartAfter(@Param("date") LocalDateTime date);
    
    @Query("SELECT b FROM BroadcastEntity b WHERE b.schedule.scheduledStart BETWEEN :start AND :end")
    List<BroadcastEntity> findByScheduledStartBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    @Query("SELECT b FROM BroadcastEntity b WHERE b.status = :status AND b.schedule.scheduledStart > :date")
    List<BroadcastEntity> findByStatusAndScheduledStartAfter(@Param("status") BroadcastStatus status, @Param("date") LocalDateTime date);

    @Query("SELECT b FROM BroadcastEntity b WHERE b.status = :status AND b.schedule.scheduledStart BETWEEN :start AND :end")
    List<BroadcastEntity> findByStatusAndScheduledStartBetween(@Param("status") BroadcastStatus status, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
} 