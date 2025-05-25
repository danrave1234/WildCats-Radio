 package com.wildcastradio.icecast;

import org.springframework.context.ApplicationEvent;

/**
 * Event published when stream status changes (starts or stops).
 * Used to trigger listener status updates without circular dependencies.
 */
public class StreamStatusChangeEvent extends ApplicationEvent {
    private final boolean isLive;
    
    public StreamStatusChangeEvent(Object source, boolean isLive) {
        super(source);
        this.isLive = isLive;
    }
    
    public boolean isLive() {
        return isLive;
    }
} 