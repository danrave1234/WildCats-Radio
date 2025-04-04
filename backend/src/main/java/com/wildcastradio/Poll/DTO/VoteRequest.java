package com.wildcastradio.Poll.DTO;

public class VoteRequest {
    private Long pollId;
    private Long optionId;

    // Constructors
    public VoteRequest() {
    }

    public VoteRequest(Long pollId, Long optionId) {
        this.pollId = pollId;
        this.optionId = optionId;
    }

    // Getters and Setters
    public Long getPollId() {
        return pollId;
    }

    public void setPollId(Long pollId) {
        this.pollId = pollId;
    }

    public Long getOptionId() {
        return optionId;
    }

    public void setOptionId(Long optionId) {
        this.optionId = optionId;
    }
}