package com.wildcastradio.ChatMessage;

/**
 * Request object for sending chat messages
 */
public class ChatMessageRequest {
    private String content;

    public ChatMessageRequest() {
        // Default constructor needed for Jackson deserialization
    }

    public ChatMessageRequest(String content) {
        this.content = content;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
} 