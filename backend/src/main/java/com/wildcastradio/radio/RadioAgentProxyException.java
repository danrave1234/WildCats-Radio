package com.wildcastradio.radio;

public class RadioAgentProxyException extends RuntimeException {
    private final int statusCode;
    private final String body;

    public RadioAgentProxyException(int statusCode, String body, Throwable cause) {
        super("Agent error: " + statusCode, cause);
        this.statusCode = statusCode;
        this.body = body;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getBody() {
        return body;
    }
}


