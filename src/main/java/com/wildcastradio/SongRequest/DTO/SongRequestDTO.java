package com.wildcastradio.SongRequest.DTO;

import com.wildcastradio.SongRequest.SongRequestEntity;
import com.wildcastradio.User.DTO.UserDTO;

import java.time.LocalDateTime;

public class SongRequestDTO {
    private Long id;
    private String songTitle;
    private String artist;
    private LocalDateTime timestamp;
    private UserDTO requestedBy;
    private Long broadcastId;
    
    // Constructors
    public SongRequestDTO() {
    }
    
    public SongRequestDTO(Long id, String songTitle, String artist, LocalDateTime timestamp,
                         UserDTO requestedBy, Long broadcastId) {
        this.id = id;
        this.songTitle = songTitle;
        this.artist = artist;
        this.timestamp = timestamp;
        this.requestedBy = requestedBy;
        this.broadcastId = broadcastId;
    }
    
    // Convert from Entity to DTO
    public static SongRequestDTO fromEntity(SongRequestEntity songRequest) {
        if (songRequest == null) {
            return null;
        }
        
        return new SongRequestDTO(
            songRequest.getId(),
            songRequest.getSongTitle(),
            songRequest.getArtist(),
            songRequest.getTimestamp(),
            UserDTO.fromEntity(songRequest.getRequestedBy()),
            songRequest.getBroadcast().getId()
        );
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getSongTitle() {
        return songTitle;
    }
    
    public void setSongTitle(String songTitle) {
        this.songTitle = songTitle;
    }
    
    public String getArtist() {
        return artist;
    }
    
    public void setArtist(String artist) {
        this.artist = artist;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
    
    public UserDTO getRequestedBy() {
        return requestedBy;
    }
    
    public void setRequestedBy(UserDTO requestedBy) {
        this.requestedBy = requestedBy;
    }
    
    public Long getBroadcastId() {
        return broadcastId;
    }
    
    public void setBroadcastId(Long broadcastId) {
        this.broadcastId = broadcastId;
    }
} 