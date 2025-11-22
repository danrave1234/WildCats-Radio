package com.wildcastradio.Poll;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "poll_options", indexes = {
    @Index(name = "idx_poll_option_poll", columnList = "poll_id")
})
public class PollOptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String text;

    @ManyToOne
    @JoinColumn(name = "poll_id", nullable = false)
    private PollEntity poll;

    @OneToMany(mappedBy = "option", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PollVoteEntity> votes = new ArrayList<>();

    // Constructors
    public PollOptionEntity() {
    }

    public PollOptionEntity(String text) {
        this.text = text;
    }

    public PollOptionEntity(String text, PollEntity poll) {
        this.text = text;
        this.poll = poll;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public PollEntity getPoll() {
        return poll;
    }

    public void setPoll(PollEntity poll) {
        this.poll = poll;
    }

    public List<PollVoteEntity> getVotes() {
        return votes;
    }

    public void setVotes(List<PollVoteEntity> votes) {
        this.votes = votes;
    }

    // Helper methods
    public void addVote(PollVoteEntity vote) {
        votes.add(vote);
        vote.setOption(this);
    }

    public void removeVote(PollVoteEntity vote) {
        votes.remove(vote);
        vote.setOption(null);
    }

    public int getVoteCount() {
        return votes.size();
    }
}