package com.wildcastradio.ActivityLog;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.User.UserEntity;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLogEntity, Long> {
    List<ActivityLogEntity> findByUser(UserEntity user);
    List<ActivityLogEntity> findByUserAndActivityType(UserEntity user, ActivityLogEntity.ActivityType activityType);
    List<ActivityLogEntity> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    List<ActivityLogEntity> findByUserAndTimestampBetween(UserEntity user, LocalDateTime start, LocalDateTime end);
    List<ActivityLogEntity> findTop10ByUserOrderByTimestampDesc(UserEntity user);
    
    // Analytics count methods
    long countByTimestampBetween(LocalDateTime start, LocalDateTime end);
} 