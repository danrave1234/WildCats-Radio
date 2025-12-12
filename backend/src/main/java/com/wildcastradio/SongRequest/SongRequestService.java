package com.wildcastradio.SongRequest;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.SongRequest.DTO.SongRequestDTO;
import com.wildcastradio.User.UserEntity;

@Service
public class SongRequestService {

    private final SongRequestRepository songRequestRepository;
    private final BroadcastRepository broadcastRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public SongRequestService(
            SongRequestRepository songRequestRepository,
            BroadcastRepository broadcastRepository,
            SimpMessagingTemplate messagingTemplate) {
        this.songRequestRepository = songRequestRepository;
        this.broadcastRepository = broadcastRepository;
        this.messagingTemplate = messagingTemplate;
    }

    public SongRequestEntity createSongRequest(Long broadcastId, UserEntity requestedBy, String songTitle, String artist) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        SongRequestEntity songRequest = new SongRequestEntity(songTitle, artist, requestedBy, broadcast);
        SongRequestEntity savedRequest = songRequestRepository.save(songRequest);

        // Create DTO for the song request
        SongRequestDTO requestDTO = SongRequestDTO.fromEntity(savedRequest);

        // Notify all clients about the new song request
        broadcastSongRequestUpdate(broadcastId, requestDTO);

        return savedRequest;
    }

    public List<SongRequestDTO> getSongRequestsForBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        return songRequestRepository.findByBroadcastOrderByTimestampDesc(broadcast).stream()
                .map(SongRequestDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public long countSongRequestsForBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        return songRequestRepository.countByBroadcast(broadcast);
    }

    public List<SongRequestDTO> getAllSongRequests() {
        return songRequestRepository.findAll().stream()
                .map(SongRequestDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public long getTotalSongRequestCount() {
        return songRequestRepository.count();
    }

    public Map<String, Object> getStats() {
        // Return a statistics object with total counts
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRequests", getTotalSongRequestCount());
        stats.put("mostRequestedSongs", getMostRequestedSongs());
        return stats;
    }

    private List<Map<String, Object>> getMostRequestedSongs() {
        // This is a simplified implementation - you might want to implement a more sophisticated query
        // that groups by song title and artist to get actual count statistics
        List<Map<String, Object>> result = new ArrayList<>();

        List<SongRequestEntity> songs = songRequestRepository.findAll().stream()
            .limit(5)  // Just return up to 5 songs for now
            .collect(Collectors.toList());

        for (SongRequestEntity song : songs) {
            Map<String, Object> songData = new HashMap<>();
            songData.put("title", song.getSongTitle());
            songData.put("artist", song.getArtist());
            songData.put("count", 1);
            result.add(songData);
        }

        return result;
    }

    public double getAverageRequestsPerBroadcast() {
        long totalRequests = getTotalSongRequestCount();
        long totalBroadcasts = broadcastRepository.count();

        if (totalBroadcasts == 0) {
            return 0.0;
        }

        return (double) totalRequests / totalBroadcasts;
    }

    public void deleteSongRequest(Long broadcastId, Long requestId, UserEntity user) {
        // Check if the song request exists
        SongRequestEntity songRequest = songRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Song request not found"));

        // Check if the song request belongs to the specified broadcast
        if (!songRequest.getBroadcast().getId().equals(broadcastId)) {
            throw new RuntimeException("Song request does not belong to the specified broadcast");
        }

        // Check if the user has permission to delete the song request (must be a DJ or admin)
        if (user.getRole() != UserEntity.UserRole.DJ && user.getRole() != UserEntity.UserRole.ADMIN) {
            throw new AccessDeniedException("Only DJs and admins can delete song requests");
        }

        // Delete the song request
        songRequestRepository.delete(songRequest);

        // Create a deletion notification
        Map<String, Object> deletionNotification = new HashMap<>();
        deletionNotification.put("type", "SONG_REQUEST_DELETED");
        deletionNotification.put("requestId", requestId);

        // Notify all clients about the deletion
        broadcastSongRequestUpdate(broadcastId, deletionNotification);
    }

    /**
     * Broadcast song request update to all subscribers
     * Centralized messaging method for controller-based pattern
     * 
     * @param broadcastId The broadcast ID for the topic
     * @param message The song request message to broadcast (can be DTO or Map)
     */
    public void broadcastSongRequestUpdate(Long broadcastId, Object message) {
        messagingTemplate.convertAndSend(
                "/topic/broadcast/" + broadcastId + "/song-requests",
                message
        );
    }

    public void broadcastSongRequestsCleared(Long broadcastId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "SONG_REQUESTS_CLEARED");
        payload.put("broadcastId", broadcastId);
        try {
            messagingTemplate.convertAndSend(
                    "/topic/broadcast/" + broadcastId + "/song-requests",
                    payload
            );
        } catch (Exception e) {
            // Do not fail broadcast end on notification issues
        }
    }
}
