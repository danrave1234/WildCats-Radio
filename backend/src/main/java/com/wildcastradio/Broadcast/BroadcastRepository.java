package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.Broadcast.BroadcastEntity.BroadcastStatus;
import com.wildcastradio.User.UserEntity;

@Repository
public interface BroadcastRepository extends JpaRepository<BroadcastEntity, Long> {
    
    List<BroadcastEntity> findByCreatedBy(UserEntity dj);
    
    List<BroadcastEntity> findByStatus(BroadcastStatus status);
    
    List<BroadcastEntity> findByCreatedByAndStatus(UserEntity dj, BroadcastStatus status);
    
    List<BroadcastEntity> findByScheduledStartAfter(LocalDateTime date);
    
    List<BroadcastEntity> findByScheduledStartBetween(LocalDateTime start, LocalDateTime end);
    
    List<BroadcastEntity> findByStatusAndScheduledStartAfter(BroadcastStatus status, LocalDateTime date);
} 