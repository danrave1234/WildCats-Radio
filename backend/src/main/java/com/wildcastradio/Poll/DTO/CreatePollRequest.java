package com.wildcastradio.Poll.DTO;

import java.util.List;

public class CreatePollRequest {
    private String question;
    private Long broadcastId;
    private List<String> options;

    // Constructors
    public CreatePollRequest() {
    }

    public CreatePollRequest(String question, Long broadcastId, List<String> options) {
        this.question = question;
        this.broadcastId = broadcastId;
        this.options = options;
    }

    // Getters and Setters
    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public Long getBroadcastId() {
        return broadcastId;
    }

    public void setBroadcastId(Long broadcastId) {
        this.broadcastId = broadcastId;
    }

    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
    }
}