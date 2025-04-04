package com.wildcastradio.Poll.DTO;

import java.util.List;

public class PollResultDTO {
    private Long id;
    private String question;
    private boolean active;
    private long totalVotes;
    private List<OptionResult> options;

    // Constructors
    public PollResultDTO() {
    }

    public PollResultDTO(Long id, String question, boolean active, long totalVotes, List<OptionResult> options) {
        this.id = id;
        this.question = question;
        this.active = active;
        this.totalVotes = totalVotes;
        this.options = options;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public long getTotalVotes() {
        return totalVotes;
    }

    public void setTotalVotes(long totalVotes) {
        this.totalVotes = totalVotes;
    }

    public List<OptionResult> getOptions() {
        return options;
    }

    public void setOptions(List<OptionResult> options) {
        this.options = options;
    }

    // Inner class for option results
    public static class OptionResult {
        private Long id;
        private String text;
        private long votes;
        private double percentage;

        // Constructors
        public OptionResult() {
        }

        public OptionResult(Long id, String text, long votes, double percentage) {
            this.id = id;
            this.text = text;
            this.votes = votes;
            this.percentage = percentage;
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

        public double getPercentage() {
            return percentage;
        }

        public void setPercentage(double percentage) {
            this.percentage = percentage;
        }
    }
}