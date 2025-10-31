package com.wildcastradio.SongRequest;

import java.time.LocalDateTime;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.UserEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "song_requests", indexes = {
    @Index(name = "idx_song_request_broadcast", columnList = "broadcast_id"),
    @Index(name = "idx_song_request_user", columnList = "requested_by_id"),
    @Index(name = "idx_song_request_timestamp", columnList = "timestamp"),
    @Index(name = "idx_song_request_broadcast_timestamp", columnList = "broadcast_id, timestamp")
})
public class SongRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String songTitle;

    @Column
    private String artist;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @ManyToOne
    @JoinColumn(name = "requested_by_id", nullable = false)
    private UserEntity requestedBy;

    @ManyToOne
    @JoinColumn(name = "broadcast_id", nullable = false)
    private BroadcastEntity broadcast;

    // Constructors
    public SongRequestEntity() {
    }

    public SongRequestEntity(String songTitle, String artist, UserEntity requestedBy, BroadcastEntity broadcast) {
        this.songTitle = songTitle;
        this.artist = artist;
        this.requestedBy = requestedBy;
        this.broadcast = broadcast;
        this.timestamp = LocalDateTime.now();
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

    public UserEntity getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(UserEntity requestedBy) {
        this.requestedBy = requestedBy;
    }

    public BroadcastEntity getBroadcast() {
        return broadcast;
    }

    public void setBroadcast(BroadcastEntity broadcast) {
        this.broadcast = broadcast;
    }
} 