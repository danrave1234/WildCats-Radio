package com.wildcastradio.ShoutCast;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * WebSocket handler for audio streaming.
 * Handles incoming audio data from DJs and sends it to FFmpeg
 * for transcoding and forwarding to the Shoutcast server.
 */
@Component
public class AudioStreamHandler extends BinaryWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(AudioStreamHandler.class);
    
    // Map to store active sessions and their associated FFmpeg processes
    private final ConcurrentHashMap<String, Process> ffmpegProcesses = new ConcurrentHashMap<>();
    
    @Value("${shoutcast.server.url:localhost}")
    private String serverUrl;

    @Value("${shoutcast.server.port:8000}")
    private String serverPort;

    @Value("${shoutcast.server.source.password:1234}")
    private String sourcePassword;

    @Value("${shoutcast.server.mount:/stream}")
    private String mountPoint;

    /**
     * Called when a new WebSocket connection is established.
     * Initializes an FFmpeg process to handle audio transcoding.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        logger.info("WebSocket connection established for audio streaming. Session ID: {}", session.getId());
        
        // Check if FFmpeg is available
        if (!isFFmpegAvailable()) {
            logger.error("FFmpeg is not available in the system PATH");
            session.close(CloseStatus.SERVER_ERROR.withReason("FFmpeg not available"));
            return;
        }
        
        // Create the streaming URL for Shoutcast
        // For Shoutcast DNAS, the correct password format is: password:#streamID
        // For a single stream instance, we can just use the password directly
        String streamUrl = String.format("http://%s:%s/%s", 
                serverUrl, serverPort, sourcePassword);
        
        logger.info("Connecting to Shoutcast at: {}", streamUrl);
        
        // Build FFmpeg command with improved settings
        List<String> command = new ArrayList<>();
        command.add("ffmpeg");
        command.add("-y");                      // Overwrite output files without asking
        command.add("-loglevel");
        command.add("verbose");                 // Verbose logging
        command.add("-f");
        command.add("webm");                    // Specify WebM as input format instead of raw data
        command.add("-re");                     // Read input at native frame rate
        command.add("-i");
        command.add("pipe:0");                  // Read from stdin
        command.add("-map_metadata");
        command.add("-1");                      // Remove metadata
        command.add("-acodec");
        command.add("libmp3lame");              // MP3 codec
        command.add("-b:a");
        command.add("128k");                    // Bitrate
        command.add("-ac");
        command.add("2");                       // 2 audio channels (stereo)
        command.add("-ar");
        command.add("44100");                   // Sample rate
        // Radio station metadata
        command.add("-metadata");               
        command.add("title=WildCats Radio");    // Stream title
        command.add("-f");
        command.add("mp3");                     // Output format
        command.add(streamUrl);                 // Output destination
        
        // Create the process builder and configure it
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(true);     // Merge stderr into stdout
        
        // Log the FFmpeg command for debugging
        logger.info("Starting FFmpeg process with command: {}", String.join(" ", command));
        
        try {
            // Start the FFmpeg process
            Process ffmpeg = pb.start();
            
            // Store the process in our map
            ffmpegProcesses.put(session.getId(), ffmpeg);
            
            // Start a thread to read and log the FFmpeg output
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(ffmpeg.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        logger.info("FFmpeg [{}]: {}", session.getId(), line);
                    }
                } catch (IOException e) {
                    logger.error("Error reading FFmpeg output for session {}", session.getId(), e);
                }
            }).start();
            
            // Check if the process is alive
            if (ffmpeg.isAlive()) {
                logger.info("FFmpeg process started successfully for session: {}", session.getId());
            } else {
                int exitCode = ffmpeg.exitValue();
                logger.error("FFmpeg process failed to start for session {}, exit code: {}", session.getId(), exitCode);
                session.close(CloseStatus.SERVER_ERROR.withReason("Failed to start audio processing"));
            }
        } catch (IOException e) {
            logger.error("Failed to start FFmpeg process for session {}", session.getId(), e);
            session.close(CloseStatus.SERVER_ERROR.withReason("Failed to initialize audio processing"));
        }
    }

    /**
     * Handles binary messages (audio data) sent through the WebSocket.
     * Forwards the data to the FFmpeg process for transcoding.
     */
    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws IOException {
        String sessionId = session.getId();
        Process ffmpeg = ffmpegProcesses.get(sessionId);
        
        if (ffmpeg != null && ffmpeg.isAlive()) {
            try {
                // Write the audio data to FFmpeg's stdin
                ffmpeg.getOutputStream().write(message.getPayload().array());
                ffmpeg.getOutputStream().flush();
            } catch (IOException e) {
                logger.error("Error writing to FFmpeg process for session {}", sessionId, e);
                session.close(CloseStatus.SERVER_ERROR.withReason("Audio processing error"));
            }
        } else {
            logger.warn("Received message for session {} but FFmpeg process is not running", sessionId);
            
            // Try to reconnect FFmpeg if it's not running
            try {
                logger.info("Attempting to restart FFmpeg process for session: {}", sessionId);
                afterConnectionEstablished(session);
            } catch (Exception e) {
                logger.error("Failed to restart FFmpeg process", e);
                session.close(CloseStatus.SERVER_ERROR.withReason("Failed to restart audio processing"));
            }
        }
    }

    /**
     * Called when a WebSocket connection is closed.
     * Cleans up the FFmpeg process associated with the session.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        logger.info("WebSocket connection closed for session {}: {}", sessionId, status);
        
        Process ffmpeg = ffmpegProcesses.remove(sessionId);
        if (ffmpeg != null) {
            try {
                logger.info("Stopping FFmpeg process for session {}", sessionId);
                
                // Try to gracefully close stdin first
                try {
                    ffmpeg.getOutputStream().close();
                } catch (IOException e) {
                    logger.warn("Error closing FFmpeg input for session {}", sessionId, e);
                }
                
                // Destroy the process
                ffmpeg.destroy();
                
                // Wait for the process to terminate
                boolean terminated = ffmpeg.waitFor(5, TimeUnit.SECONDS);
                if (!terminated) {
                    logger.warn("FFmpeg process for session {} did not terminate gracefully, forcing shutdown", sessionId);
                    ffmpeg.destroyForcibly();
                }
                
                logger.info("FFmpeg process for session {} has been terminated", sessionId);
            } catch (InterruptedException e) {
                logger.error("Interrupted while waiting for FFmpeg to terminate for session {}", sessionId, e);
                Thread.currentThread().interrupt();
            }
        }
    }
    
    /**
     * Check if FFmpeg is available in the system PATH
     */
    private boolean isFFmpegAvailable() {
        try {
            ProcessBuilder pb = new ProcessBuilder();
            if (System.getProperty("os.name").toLowerCase().contains("windows")) {
                pb.command("where", "ffmpeg");
            } else {
                pb.command("which", "ffmpeg");
            }
            
            Process process = pb.start();
            int exitCode = process.waitFor();
            
            // If exit code is 0, ffmpeg was found
            if (exitCode == 0) {
                // Try to run ffmpeg -version to confirm it works
                Process check = new ProcessBuilder("ffmpeg", "-version").start();
                BufferedReader reader = new BufferedReader(new InputStreamReader(check.getInputStream()));
                String version = reader.readLine();
                logger.info("FFmpeg found: {}", version);
                return true;
            }
            
            logger.error("FFmpeg not found in PATH");
            return false;
        } catch (IOException | InterruptedException e) {
            logger.error("Error checking for FFmpeg", e);
            return false;
        }
    }
} 