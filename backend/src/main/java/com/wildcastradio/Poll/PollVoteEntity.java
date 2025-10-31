package com.wildcastradio.Poll;

import java.time.LocalDateTime;

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
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "poll_votes", 
    indexes = {
        @Index(name = "idx_poll_vote_user", columnList = "user_id"),
        @Index(name = "idx_poll_vote_poll", columnList = "poll_id"),
        @Index(name = "idx_poll_vote_option", columnList = "option_id"),
        @Index(name = "idx_poll_vote_timestamp", columnList = "timestamp")
    },
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "poll_id"})
    })
public class PollVoteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne
    @JoinColumn(name = "poll_id", nullable = false)
    private PollEntity poll;

    @ManyToOne
    @JoinColumn(name = "option_id", nullable = false)
    private PollOptionEntity option;

    // Constructors
    public PollVoteEntity() {
        this.timestamp = LocalDateTime.now();
    }

    public PollVoteEntity(UserEntity user, PollEntity poll, PollOptionEntity option) {
        this.user = user;
        this.poll = poll;
        this.option = option;
        this.timestamp = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public UserEntity getUser() {
        return user;
    }

    public void setUser(UserEntity user) {
        this.user = user;
    }

    public PollEntity getPoll() {
        return poll;
    }

    public void setPoll(PollEntity poll) {
        this.poll = poll;
    }

    public PollOptionEntity getOption() {
        return option;
    }

    public void setOption(PollOptionEntity option) {
        this.option = option;
    }
}