package com.wildcastradio.SongRequest;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.UserEntity;

@Repository
public interface SongRequestRepository extends JpaRepository<SongRequestEntity, Long> {
    List<SongRequestEntity> findByBroadcast(BroadcastEntity broadcast);
    List<SongRequestEntity> findByBroadcastOrderByTimestampDesc(BroadcastEntity broadcast);
    List<SongRequestEntity> findByRequestedBy(UserEntity requestedBy);
    long countByBroadcast(BroadcastEntity broadcast);
} 