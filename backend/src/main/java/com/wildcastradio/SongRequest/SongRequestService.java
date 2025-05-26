package com.wildcastradio.SongRequest;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

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
        
        // Notify all clients about the new song request
        messagingTemplate.convertAndSend(
                "/topic/broadcast/" + broadcastId + "/song-requests",
                SongRequestDTO.fromEntity(savedRequest)
        );
        
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
} 