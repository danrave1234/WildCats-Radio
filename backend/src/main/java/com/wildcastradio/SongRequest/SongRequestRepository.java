package com.wildcastradio.SongRequest;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.UserEntity;

@Repository
public interface SongRequestRepository extends JpaRepository<SongRequestEntity, Long> {
    List<SongRequestEntity> findByBroadcast(BroadcastEntity broadcast);
    List<SongRequestEntity> findByBroadcastOrderByTimestampDesc(BroadcastEntity broadcast);
    List<SongRequestEntity> findByRequestedBy(UserEntity requestedBy);
    long countByBroadcast(BroadcastEntity broadcast);
    
    // Bulk count: Count all song requests for broadcasts created by a specific DJ
    @Query("SELECT COUNT(s) FROM SongRequestEntity s WHERE s.broadcast.createdBy.id = :userId")
    long countByBroadcast_CreatedBy_Id(@Param("userId") Long userId);
    
    // Batch aggregation: Get song request counts grouped by broadcast ID for multiple broadcasts
    @Query("SELECT s.broadcast.id, COUNT(s) FROM SongRequestEntity s WHERE s.broadcast.id IN :broadcastIds GROUP BY s.broadcast.id")
    List<Object[]> countSongRequestsByBroadcastIds(@Param("broadcastIds") List<Long> broadcastIds);
} 