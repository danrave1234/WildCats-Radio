package com.wildcastradio.icecast;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import com.wildcastradio.config.NetworkConfig;

/**
 * WebSocket handler for streaming audio from DJ's browser to Icecast.
 * Receives binary WebSocket messages containing audio data and pipes them
 * through FFmpeg to Icecast server with dual output (OGG + MP3).
 * Also handles text messages for connection health monitoring (ping/pong).
 */
@Component
public class IcecastStreamHandler extends AbstractWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(IcecastStreamHandler.class);
    private Process ffmpeg;
    private volatile boolean isConnected = false;
    private Thread loggingThread;
    private volatile boolean shouldStopLogging = false;
    
    private final NetworkConfig networkConfig;
    private final IcecastService icecastService;
    private final ApplicationEventPublisher eventPublisher;
    
    @Autowired
    public IcecastStreamHandler(NetworkConfig networkConfig, IcecastService icecastService,
                                ApplicationEventPublisher eventPublisher) {
        this.networkConfig = networkConfig;
        this.icecastService = icecastService;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        logger.info("WebSocket connection established with session ID: {}", session.getId());
        
        // Add delay to prevent rapid connection attempts during audio source switching
        // This helps avoid race conditions where new FFmpeg processes try to connect
        // before the old process has fully released the Icecast mount point
        try {
            Thread.sleep(500); // Increased to 500ms for better race condition prevention
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.warn("Interrupted during connection establishment delay");
        }

        // FIXED: Use the actual Icecast server hostname, not the Spring Boot app domain
        String icecastHostname = networkConfig.getIcecastHostname();
        logger.info("Using Icecast hostname for FFmpeg: {}", icecastHostname);

        // Build FFmpeg command for dual streaming (OGG + MP3) to support both web and mobile
        List<String> cmd = new ArrayList<>(Arrays.asList(
                "ffmpeg",
                // Low-latency flags
                "-probesize", "32",
                "-analyzeduration", "0",
                "-fflags", "+nobuffer",
                "-f", "webm", "-i", "pipe:0"  // Read WebM from stdin
        ));

        // Add reconnection settings if enabled
        if (networkConfig.isFfmpegReconnectEnabled()) {
            cmd.addAll(Arrays.asList(
                    "-reconnect", "1",           // Enable reconnection
                    "-reconnect_at_eof", "1",    // Reconnect at end of file
                    "-reconnect_streamed", "1",  // Reconnect for streaming protocols
                    "-reconnect_delay_max", String.valueOf(networkConfig.getFfmpegReconnectDelayMax()), // Max delay between reconnect attempts
                    "-rw_timeout", String.valueOf(networkConfig.getFfmpegRwTimeout())    // Read/write timeout (in microseconds)
            ));
        }

        // CRITICAL FIX: Build Icecast URLs with the actual Icecast server hostname and port
        // FFmpeg must connect directly to Icecast server on port 8000, not through reverse proxy
        String oggIcecastUrl = "icecast://source:hackme@" + icecastHostname + ":8000/live.ogg";
        String mp3IcecastUrl = "icecast://source:hackme@" + icecastHostname + ":8000/live.mp3";

        // Use FFmpeg's tee muxer to output to both OGG and MP3 simultaneously
        cmd.addAll(Arrays.asList(
                // Map the input audio stream twice
                "-map", "0:a", "-map", "0:a",
                
                // First output: OGG Vorbis (for web compatibility)
                "-c:a:0", "libvorbis", "-b:a:0", "128k",
                "-tune", "zerolatency",
                "-content_type", "application/ogg",
                "-ice_name", "WildCats Radio Live (OGG)",
                "-ice_description", "Live audio broadcast in OGG format",
                "-f", "ogg", oggIcecastUrl,
                
                // Second output: MP3 (for mobile compatibility)
                "-c:a:1", "libmp3lame", "-b:a:1", "128k",
                "-tune", "zerolatency",
                "-content_type", "audio/mpeg", 
                "-ice_name", "WildCats Radio Live (MP3)",
                "-ice_description", "Live audio broadcast in MP3 format",
                "-f", "mp3", mp3IcecastUrl
        ));

        logger.info("Starting FFmpeg with dual streaming command: {}", String.join(" ", cmd));
        logger.info("OGG Icecast URL: {}", oggIcecastUrl);
        logger.info("MP3 Icecast URL: {}", mp3IcecastUrl);
        logger.info("Icecast hostname resolved to: {}", icecastHostname);
        
        // Test Icecast server connectivity before starting FFmpeg
        try {
            logger.info("Testing connectivity to Icecast server at {}:8000", icecastHostname);
            java.net.Socket testSocket = new java.net.Socket();
            testSocket.connect(new java.net.InetSocketAddress(icecastHostname, 8000), 5000);
            testSocket.close();
            logger.info("Successfully connected to Icecast server on port 8000");
        } catch (IOException e) {
            logger.error("Cannot connect to Icecast server at {}:8000 - {}", icecastHostname, e.getMessage());
            session.close(new CloseStatus(1011, "Cannot connect to Icecast server: " + e.getMessage()));
            return;
        }

        // Try to start FFmpeg with enhanced retry logic for race conditions
        boolean started = false;
        final int[] attempts = {0}; // Use array to make it effectively final
        int maxAttempts = networkConfig.getFfmpegRetryAttempts();

        while (!started && attempts[0] < maxAttempts) {
            attempts[0]++;
            
            // Exponential backoff delay with jitter for race condition prevention
            if (attempts[0] > 1) {
                int baseDelay = 1000; // 1 second base delay
                int exponentialDelay = baseDelay * (int) Math.pow(2, attempts[0] - 2); // Exponential backoff
                int jitter = (int) (Math.random() * 500); // Add up to 500ms jitter
                int totalDelay = Math.min(exponentialDelay + jitter, 8000); // Cap at 8 seconds
                
                logger.info("Waiting {}ms before FFmpeg retry attempt {} (exponential backoff with jitter)", totalDelay, attempts[0]);
                try {
                    Thread.sleep(totalDelay);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    logger.error("Interrupted during retry delay");
                    break;
                }
            }
            
            // Check mount point availability before attempting connection (race condition prevention)
            if (attempts[0] > 1) {
                logger.info("Checking mount point availability before attempt {}", attempts[0]);
                boolean mountPointAvailable = checkMountPointAvailability(icecastHostname);
                if (!mountPointAvailable) {
                    logger.warn("Mount point still occupied, extending delay for attempt {}", attempts[0]);
                    try {
                        Thread.sleep(2000); // Additional 2 second delay if mount point busy
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
            
            try {
                // Start FFmpeg process
                ProcessBuilder pb = new ProcessBuilder(cmd);
                pb.redirectErrorStream(true);
                ffmpeg = pb.start();

                // Reset the logging flag
                shouldStopLogging = false;

                // Enhanced FFmpeg monitoring with race condition detection
                final boolean[] connectionSuccessful = {false};
                final boolean[] raceConditionDetected = {false};

                // Start a thread to monitor FFmpeg output and detect errors
                loggingThread = new Thread(() -> {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(ffmpeg.getInputStream()))) {
                        String line;

                        while ((line = reader.readLine()) != null && !shouldStopLogging) {
                            // Break immediately if we should stop logging
                            if (shouldStopLogging) {
                                break;
                            }

                            logger.info("FFmpeg: {}", line);

                            // Check for successful connection indicators (for both streams)
                            if (line.contains("Opening") && line.contains("for writing")) {
                                connectionSuccessful[0] = true;
                                isConnected = true;
                                if (line.contains("live.ogg")) {
                                    logger.info("FFmpeg successfully connected to Icecast OGG stream");
                                } else if (line.contains("live.mp3")) {
                                    logger.info("FFmpeg successfully connected to Icecast MP3 stream");
                                } else {
                                    logger.info("FFmpeg successfully connected to Icecast");
                                }
                            }

                            // ENHANCED: Check for 403 Forbidden error with race condition detection
                            if (line.contains("403") && line.contains("Forbidden")) {
                                logger.warn("FFmpeg received 403 Forbidden from Icecast (attempt {})", attempts[0]);
                                logger.warn("This indicates a race condition - mount point likely still occupied by previous FFmpeg process");
                                raceConditionDetected[0] = true;
                                
                                if (line.contains("live.ogg")) {
                                    logger.warn("OGG stream mount point access denied - race condition detected");
                                } else if (line.contains("live.mp3")) {
                                    logger.warn("MP3 stream mount point access denied - race condition detected");
                                }
                                
                                // Force break to trigger retry with longer delay
                                break;
                            }
                            
                            // Check for authentication errors
                            if (line.contains("401") && line.contains("Unauthorized")) {
                                logger.error("FFmpeg authentication failed - check source credentials");
                                break;
                            }

                            // Check for connection errors
                            if (line.contains("Error number -10053") ||
                                    line.contains("Connection aborted") ||
                                    line.contains("WSAECONNABORTED")) {
                                logger.warn("FFmpeg connection aborted (attempt {}): {}", attempts[0], line);
                                isConnected = false;
                                break;
                            }

                            // Check for other network errors
                            if (line.contains("Connection refused") ||
                                    line.contains("Network is unreachable") ||
                                    line.contains("Connection timed out")) {
                                logger.warn("FFmpeg network error (attempt {}): {}", attempts[0], line);
                                logger.warn("Check if Icecast server is running and accessible on port 8000");
                                break;
                            }

                            // Check for URL/protocol errors
                            if (line.contains("Invalid argument") ||
                                    line.contains("Port missing in uri") ||
                                    line.contains("Protocol not found")) {
                                logger.error("FFmpeg URL/protocol error (attempt {}): {}", attempts[0], line);
                                logger.error("Check Icecast URL format: {}", oggIcecastUrl);
                                break;
                            }
                            
                            // Check for mount point errors
                            if (line.contains("mount point") && line.contains("not found")) {
                                logger.error("FFmpeg mount point error: {}", line);
                                if (line.contains("live.ogg")) {
                                    logger.error("Mount point /live.ogg may not exist or be configured on Icecast server");
                                } else if (line.contains("live.mp3")) {
                                    logger.error("Mount point /live.mp3 may not exist or be configured on Icecast server");
                                } else {
                                    logger.error("Mount point may not exist or be configured on Icecast server");
                                }
                                break;
                            }
                            
                            // Check for server not running
                            if (line.contains("No such host") || line.contains("Name resolution failed")) {
                                logger.error("FFmpeg hostname resolution failed: {}", line);
                                logger.error("Cannot resolve hostname: {}", icecastHostname);
                                break;
                            }
                        }

                        if (!connectionSuccessful[0] && !shouldStopLogging) {
                            if (raceConditionDetected[0]) {
                                logger.warn("FFmpeg connection failed due to race condition (attempt {})", attempts[0]);
                            } else {
                                logger.warn("FFmpeg connection may have failed for other reasons (attempt {})", attempts[0]);
                            }
                        }

                        logger.debug("FFmpeg logging thread terminated");

                    } catch (IOException e) {
                        if (!shouldStopLogging) {
                            logger.warn("Error reading FFmpeg output: {}", e.getMessage());
                        }
                    }
                });
                loggingThread.setName("FFmpeg-Logger-" + session.getId());
                loggingThread.setDaemon(true);
                loggingThread.start();

                // Give FFmpeg more time to establish connection, especially for retry attempts
                int connectionTimeout = attempts[0] == 1 ? 1000 : 2000; // Longer timeout for retries
                Thread.sleep(connectionTimeout);

                // Check if process is still alive and connection was successful
                if (ffmpeg.isAlive() && !raceConditionDetected[0]) {
                    // Give a bit more time for connection to be established
                    Thread.sleep(500);
                    
                    if (connectionSuccessful[0] || ffmpeg.isAlive()) {
                        started = true;
                        logger.info("FFmpeg process started successfully for session: {} (attempt {})", session.getId(), attempts[0]);

                        // Notify service that broadcast started
                        icecastService.notifyBroadcastStarted(session.getId());

                        // Publish event to trigger status update
                        eventPublisher.publishEvent(new StreamStatusChangeEvent(this, true));
                    } else {
                        logger.warn("FFmpeg process alive but connection not confirmed (attempt {})", attempts[0]);
                        // Let it continue to retry
                        ffmpeg.destroyForcibly();
                    }
                } else {
                    logger.warn("FFmpeg process failed or race condition detected (attempt {})", attempts[0]);
                    if (ffmpeg.isAlive()) {
                        ffmpeg.destroyForcibly();
                    }
                    
                    if (raceConditionDetected[0] && attempts[0] < maxAttempts) {
                        logger.info("Race condition detected, will retry with exponential backoff delay");
                    } else if (attempts[0] < maxAttempts) {
                        logger.info("FFmpeg failed, retrying...");
                    }
                }

            } catch (IOException e) {
                logger.error("Failed to start FFmpeg process (attempt {}): {}", attempts[0], e.getMessage());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.error("Interrupted while starting FFmpeg process");
                break;
            }
        }

        if (!started) {
            logger.error("Failed to start FFmpeg after {} attempts", maxAttempts);
            session.close(new CloseStatus(1011, "Failed to start streaming process after multiple attempts. This may be due to mount point race conditions."));
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws IOException {
        if (ffmpeg != null && ffmpeg.isAlive()) {
            try {
                OutputStream outputStream = ffmpeg.getOutputStream();
                if (outputStream != null) {
                    outputStream.write(message.getPayload().array());
                    outputStream.flush();
                } else {
                    logger.error("FFmpeg output stream is null");
                    session.close(new CloseStatus(1011, "FFmpeg output stream not available"));
                }
            } catch (IOException e) {
                logger.error("Error writing to FFmpeg process: {}", e.getMessage(), e);
                try {
                    session.close(CloseStatus.SERVER_ERROR);
                } catch (IOException closeEx) {
                    logger.error("Error closing WebSocket session", closeEx);
                }
                throw e;
            }
        } else {
            logger.warn("FFmpeg process is not running, cannot write data");
            try {
                session.close(new CloseStatus(1011, "FFmpeg process not available"));
            } catch (IOException e) {
                logger.error("Error closing WebSocket session", e);
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        logger.debug("Received text message: {}", payload);
        
        // Handle ping/pong for connection health monitoring
        if ("ping".equals(payload)) {
            logger.debug("Received ping, sending pong response");
            session.sendMessage(new TextMessage("pong"));
        } else {
            logger.warn("Received unexpected text message: {}", payload);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        logger.info("WebSocket connection closed with status: {}", status);
        
        // Notify the Icecast service that the broadcast has ended
        icecastService.notifyBroadcastEnded(session.getId());
        
        // Publish event to trigger status update
        eventPublisher.publishEvent(new StreamStatusChangeEvent(this, false));
        
        // Stop the logging thread first
        if (loggingThread != null && loggingThread.isAlive()) {
            shouldStopLogging = true;
            loggingThread.interrupt();
            try {
                loggingThread.join(2000); // Wait max 2 seconds for logging thread to finish
                if (loggingThread.isAlive()) {
                    logger.warn("Logging thread did not terminate gracefully");
                }
            } catch (InterruptedException e) {
                logger.warn("Interrupted while waiting for logging thread to terminate");
                Thread.currentThread().interrupt();
            }
            loggingThread = null;
        }
        
        if (ffmpeg != null) {
            logger.info("Terminating FFmpeg process");
            isConnected = false;
            ffmpeg.destroy();
            try {
                // Wait for process to terminate and check exit value
                boolean terminated = ffmpeg.waitFor(5, TimeUnit.SECONDS);
                if (terminated) {
                    logger.info("FFmpeg process terminated with exit code: {}", ffmpeg.exitValue());
                } else {
                    logger.warn("FFmpeg process did not terminate gracefully, forcing destruction");
                    ffmpeg.destroyForcibly();
                }
            } catch (InterruptedException e) {
                logger.warn("Interrupted while waiting for FFmpeg process to terminate", e);
                Thread.currentThread().interrupt();
            } finally {
                ffmpeg = null;
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("Transport error in WebSocket session: {}", session.getId(), exception);
        
        // Notify the Icecast service of the error
        icecastService.notifyBroadcastFailed(session.getId(), exception.getMessage());
        
        // Publish event to trigger status update
        eventPublisher.publishEvent(new StreamStatusChangeEvent(this, false));
        
        // Stop the logging thread first
        if (loggingThread != null && loggingThread.isAlive()) {
            shouldStopLogging = true;
            loggingThread.interrupt();
        }
        
        if (ffmpeg != null && ffmpeg.isAlive()) {
            ffmpeg.destroy();
            ffmpeg = null;
        }
        super.handleTransportError(session, exception);
    }

    /**
     * Check if Icecast mount points are available (not occupied by another source)
     * This helps prevent race conditions during audio source switching
     */
    private boolean checkMountPointAvailability(String icecastHostname) {
        try {
            URL statusUrl = new URL("http://" + icecastHostname + ":8000/status-json.xsl");
            HttpURLConnection connection = (HttpURLConnection) statusUrl.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);

            if (connection.getResponseCode() == 200) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }

                    String jsonResponse = response.toString();
                    
                    // Check if mount points are currently occupied
                    boolean oggOccupied = jsonResponse.contains("\"mount\":\"/live.ogg\"") && jsonResponse.contains("\"source_ip\"");
                    boolean mp3Occupied = jsonResponse.contains("\"mount\":\"/live.mp3\"") && jsonResponse.contains("\"source_ip\"");
                    
                    if (oggOccupied || mp3Occupied) {
                        logger.warn("Mount points still occupied - OGG: {}, MP3: {}", oggOccupied, mp3Occupied);
                        return false;
                    }
                    
                    logger.debug("Mount points appear available for new connection");
                    return true;
                }
            } else {
                logger.warn("Could not check mount point status, HTTP response: {}", connection.getResponseCode());
                return true; // Assume available if we can't check
            }
        } catch (Exception e) {
            logger.warn("Error checking mount point availability: {}", e.getMessage());
            return true; // Assume available if check fails
        }
    }
}
//hehe
