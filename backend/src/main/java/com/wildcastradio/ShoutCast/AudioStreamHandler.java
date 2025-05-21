package com.wildcastradio.ShoutCast;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

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
    
    // Map to store audio level information for each session
    private final ConcurrentHashMap<String, Integer> audioLevels = new ConcurrentHashMap<>();
    
    // Scheduler for regular status updates
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    
    // Dependencies
    private final SimpMessageSendingOperations messagingTemplate;
    private final ShoutcastService shoutcastService;
    
    @Value("${shoutcast.server.url:localhost}")
    private String serverUrl;

    @Value("${shoutcast.server.port:8000}")
    private String serverPort;

    @Value("${shoutcast.server.source.password:1234}")
    private String sourcePassword;

    @Value("${shoutcast.server.mount:/stream}")
    private String mountPoint;
    
    // Stream status
    private boolean isLive = false;

    /**
     * Constructor-based dependency injection for better reliability
     */
    @Autowired
    public AudioStreamHandler(SimpMessageSendingOperations messagingTemplate, ShoutcastService shoutcastService) {
        this.messagingTemplate = messagingTemplate;
        this.shoutcastService = shoutcastService;
        logger.info("AudioStreamHandler initialized with messaging template");
    }
    
    /**
     * Start scheduling tasks after dependencies are injected
     */
    @PostConstruct
    public void init() {
        logger.info("Starting scheduled tasks for stream status updates");
        // Schedule periodic status updates about audio levels and broadcast state
        scheduler.scheduleAtFixedRate(() -> {
            broadcastStreamStatus();
        }, 1, 1, TimeUnit.SECONDS);
    }
    
    /**
     * Broadcast current stream status to all connected clients
     */
    private void broadcastStreamStatus() {
        try {
            Map<String, Object> status = new HashMap<>();
            status.put("isLive", isLive);
            status.put("activeStreams", ffmpegProcesses.size());
            status.put("audioLevels", audioLevels);
            
            // Add ShoutCast server info
            status.put("serverUrl", serverUrl);
            status.put("serverPort", serverPort);
            status.put("mountPoint", mountPoint);
            
            // Broadcast status to all subscribed clients
            if (messagingTemplate != null) {
                try {
                    messagingTemplate.convertAndSend("/topic/stream-status", status);
                } catch (Exception e) {
                    // Handle specific exceptions gracefully - avoid crashing the scheduler
                    logger.warn("Error sending stream status update: {}", e.getMessage());
                    
                    // For debugging purposes only log the full stack trace at debug level
                    if (logger.isDebugEnabled()) {
                        logger.debug("Full exception details:", e);
                    }
                }
            } else {
                logger.warn("SimpMessagingTemplate is not initialized yet. Skipping status broadcast.");
            }
        } catch (Exception e) {
            logger.error("Error preparing stream status for broadcast", e);
        }
    }

    /**
     * Called when a new WebSocket connection is established.
     * Initializes an FFmpeg process to handle audio transcoding.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        logger.info("WebSocket connection established for audio streaming. Session ID: {}", session.getId());
        
        // Initialize audio level for this session
        audioLevels.put(session.getId(), 0);
        
        // Check if FFmpeg is available
        if (!isFFmpegAvailable()) {
            logger.error("FFmpeg is not available in the system PATH");
            session.close(CloseStatus.SERVER_ERROR.withReason("FFmpeg not available"));
            return;
        }
        
        // Check if ShoutCast server is accessible
        if (!shoutcastService.isInTestMode() && !shoutcastService.isServerAccessible()) {
            logger.error("ShoutCast server is not accessible");
            
            // Add more detailed logging about the ShoutCast server status
            logger.error("ShoutCast server details: URL={}, Port={}, Mount={}",
                    serverUrl, serverPort, mountPoint);
            
            // Try to connect to the server with a basic HTTP request to provide better diagnostics
            try {
                String testUrl = String.format("http://%s:%s/7.html", serverUrl, serverPort);
                logger.info("Testing ShoutCast server connection: {}", testUrl);
                
                // Send a test request to the ShoutCast server
                URL url = new URL(testUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                
                int responseCode = connection.getResponseCode();
                logger.info("ShoutCast server test response code: {}", responseCode);
            } catch (Exception e) {
                logger.error("ShoutCast server test connection failed", e);
            }
            
            // In test mode or development, we'll allow the connection anyway
            if (!shoutcastService.isInTestMode()) {
                session.close(CloseStatus.SERVER_ERROR.withReason("ShoutCast server not accessible"));
                return;
            } else {
                logger.warn("Proceeding despite ShoutCast server not being accessible (test mode)");
            }
        }
        
        // Create the streaming URL for Shoutcast
        // For Shoutcast v2.x, the source connection format is:
        // http://source:password@host:port/mountpoint
        String streamUrl = String.format("http://source:%s@%s:%s%s", 
                sourcePassword, serverUrl, serverPort, mountPoint);
        
        logger.info("Connecting to Shoutcast at: {}", 
                String.format("http://*****@%s:%s%s", serverUrl, serverPort, mountPoint)); // Hide password in logs
        
        // Build FFmpeg command with improved settings
        List<String> command = new ArrayList<>();
        command.add("ffmpeg");
        command.add("-y");                      // Overwrite output files without asking
        command.add("-loglevel");
        command.add("verbose");                 // Verbose logging
        command.add("-f");
        command.add("s16le");                   // PCM 16-bit little-endian format
        command.add("-ar");
        command.add("44100");                   // Input sample rate
        command.add("-ac");
        command.add("2");                       // Input channels
        command.add("-i");
        command.add("pipe:0");                  // Read from stdin
        command.add("-map_metadata");
        command.add("-1");                      // Remove metadata
        command.add("-acodec");
        command.add("libmp3lame");              // MP3 codec
        command.add("-b:a");
        command.add("128k");                    // Bitrate
        command.add("-ac");
        command.add("2");                       // Output channels
        command.add("-ar");
        command.add("44100");                   // Output sample rate
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
                isLive = true; // Set broadcast state to live
                
                // Inform client that connection is successful
                session.sendMessage(new TextMessage("{\"status\":\"connected\",\"message\":\"Broadcasting started\"}"));
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
                // Get the audio data
                ByteBuffer buffer = message.getPayload();
                byte[] audioData = buffer.array();
                
                // Calculate the audio level (simple RMS of the audio samples)
                int audioLevel = calculateAudioLevel(audioData);
                audioLevels.put(sessionId, audioLevel);
                
                // Write the audio data to FFmpeg's stdin
                ffmpeg.getOutputStream().write(audioData);
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
     * Calculate audio level from PCM data
     * Converts 16-bit PCM data to an audio level percentage
     * 
     * @param audioData The raw PCM audio data
     * @return Audio level as percentage (0-100)
     */
    private int calculateAudioLevel(byte[] audioData) {
        // We expect 16-bit PCM data (2 bytes per sample)
        if (audioData.length < 2) {
            return 0;
        }
        
        // Calculate RMS (Root Mean Square) of the audio samples
        long sumSquares = 0;
        int sampleCount = 0;
        
        // Process stereo 16-bit PCM (4 bytes per frame - 2 channels, 2 bytes per sample)
        for (int i = 0; i < audioData.length; i += 4) {
            if (i + 3 >= audioData.length) {
                break; // Not enough data for a complete frame
            }
            
            // Get left and right channel samples (16-bit, little-endian)
            short leftSample = (short) ((audioData[i+1] << 8) | (audioData[i] & 0xFF));
            short rightSample = (short) ((audioData[i+3] << 8) | (audioData[i+2] & 0xFF));
            
            // Sum squares of both channels
            sumSquares += (long) leftSample * leftSample;
            sumSquares += (long) rightSample * rightSample;
            sampleCount += 2;
        }
        
        if (sampleCount == 0) {
            return 0;
        }
        
        // Calculate RMS
        double rms = Math.sqrt(sumSquares / (double) sampleCount);
        
        // Convert to percentage of maximum possible value (32767 for 16-bit PCM)
        double percentage = (rms / 32767.0) * 100.0;
        
        // Scale to make the meter more responsive (logarithmic scaling)
        double scaledLevel;
        if (percentage == 0) {
            scaledLevel = 0;
        } else {
            // Apply logarithmic scaling to make low levels more visible
            scaledLevel = 20 * Math.log10(percentage / 10.0) + 40;
            
            // Constrain to 0-100
            scaledLevel = Math.max(0, Math.min(100, scaledLevel));
        }
        
        return (int) Math.round(scaledLevel);
    }

    /**
     * Called when a WebSocket connection is closed.
     * Cleans up the FFmpeg process associated with the session.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        logger.info("WebSocket connection closed for session {}. Status: {}", sessionId, status);
        
        // Get the FFmpeg process associated with this session
        Process ffmpeg = ffmpegProcesses.remove(sessionId);
        
        if (ffmpeg != null) {
            try {
                // Close FFmpeg's input stream to signal EOF
                ffmpeg.getOutputStream().close();
                
                // Give FFmpeg a moment to finish gracefully
                boolean exited = ffmpeg.waitFor(5, TimeUnit.SECONDS);
                
                if (!exited) {
                    logger.warn("FFmpeg process did not exit gracefully, forcing termination");
                    ffmpeg.destroyForcibly();
                }
                
                logger.info("FFmpeg process terminated for session {}", sessionId);
            } catch (Exception e) {
                logger.error("Error terminating FFmpeg process for session {}", sessionId, e);
                ffmpeg.destroyForcibly();
            }
        }
        
        // Remove the audio level entry
        audioLevels.remove(sessionId);
        
        // Check if we still have any active streams
        if (ffmpegProcesses.isEmpty()) {
            isLive = false;
            logger.info("All streams ended, broadcast is now OFF");
        }
        
        // Broadcast updated status
        broadcastStreamStatus();
    }
    
    /**
     * Check if FFmpeg is available on the system
     */
    private boolean isFFmpegAvailable() {
        try {
            Process process = Runtime.getRuntime().exec(new String[] {"ffmpeg", "-version"});
            int exitCode = process.waitFor();
            return exitCode == 0;
        } catch (Exception e) {
            logger.error("Error checking FFmpeg availability", e);
            return false;
        }
    }
    
    /**
     * Check if a broadcast is currently active
     * 
     * @return true if any DJ is broadcasting, false otherwise
     */
    public boolean isBroadcasting() {
        return isLive && !ffmpegProcesses.isEmpty();
    }
    
    /**
     * Get current broadcast status information
     * 
     * @return Map with status details
     */
    public Map<String, Object> getBroadcastStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("isLive", isLive);
        status.put("activeStreams", ffmpegProcesses.size());
        
        if (!audioLevels.isEmpty()) {
            // Calculate average audio level across all sessions
            int totalLevel = 0;
            for (int level : audioLevels.values()) {
                totalLevel += level;
            }
            int averageLevel = totalLevel / audioLevels.size();
            status.put("audioLevel", averageLevel);
        } else {
            status.put("audioLevel", 0);
        }
        
        // Add listener count from ShoutCast server
        int listenerCount = 0;
        try {
            listenerCount = shoutcastService.getCurrentListeners();
        } catch (Exception e) {
            logger.warn("Failed to get listener count from ShoutCast", e);
        }
        status.put("listenerCount", listenerCount);
        
        return status;
    }

    /**
     * Clean up resources when bean is destroyed
     */
    @PreDestroy
    public void cleanup() {
        logger.info("Shutting down AudioStreamHandler");
        // Shutdown the scheduler
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        // Close any remaining FFmpeg processes
        for (Process process : ffmpegProcesses.values()) {
            if (process.isAlive()) {
                process.destroy();
            }
        }
        ffmpegProcesses.clear();
        audioLevels.clear();
        
        logger.info("AudioStreamHandler resources cleaned up");
    }
} 