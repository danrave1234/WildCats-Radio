package com.wildcastradio.Poll.DTO;

public class PollOptionDTO {
    private Long id;
    private String text;
    private long votes;

    // Constructors
    public PollOptionDTO() {
    }

    public PollOptionDTO(Long id, String text, long votes) {
        this.id = id;
        this.text = text;
        this.votes = votes;
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

    public long getVotes() {
        return votes;
    }

    public void setVotes(long votes) {
        this.votes = votes;
    }
}