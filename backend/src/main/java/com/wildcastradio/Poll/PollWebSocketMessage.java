package com.wildcastradio.Poll;

import com.wildcastradio.Poll.DTO.PollDTO;
import com.wildcastradio.Poll.DTO.PollResultDTO;

public class PollWebSocketMessage {
    private String type;
    private PollDTO poll;
    private PollResultDTO results;
    private Long pollId;
    private Object vote;

    public PollWebSocketMessage() {}

    public PollWebSocketMessage(String type, PollDTO poll, PollResultDTO results, Object vote) {
        this.type = type;
        this.poll = poll;
        this.results = results;
        this.vote = vote;
        this.pollId = poll != null ? poll.getId() : null;
    }

    public PollWebSocketMessage(String type, Long pollId, PollResultDTO results) {
        this.type = type;
        this.pollId = pollId;
        this.results = results;
    }

    // Getters and setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public PollDTO getPoll() {
        return poll;
    }

    public void setPoll(PollDTO poll) {
        this.poll = poll;
    }

    public PollResultDTO getResults() {
        return results;
    }

    public void setResults(PollResultDTO results) {
        this.results = results;
    }

    public Long getPollId() {
        return pollId;
    }

    public void setPollId(Long pollId) {
        this.pollId = pollId;
    }

    public Object getVote() {
        return vote;
    }

    public void setVote(Object vote) {
        this.vote = vote;
    }
} 