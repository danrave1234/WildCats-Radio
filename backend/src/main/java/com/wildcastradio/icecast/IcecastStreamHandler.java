package com.wildcastradio.icecast;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
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
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
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
    // Prevent repeated warning spam when FFmpeg isn't running
    private volatile boolean dataWritesDisabled = false;
    
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

        // Build Icecast URLs using configured credentials, host, port, and mount
        String username = icecastService.getIcecastUsername();
        String password = icecastService.getIcecastPassword();
        int port = icecastService.getIcecastSourcePort();
        String mount = icecastService.getIcecastMount();
        // Ensure mount starts with '/'
        if (mount == null || mount.isEmpty()) {
            mount = "/live.ogg";
        }
        if (!mount.startsWith("/")) {
            mount = "/" + mount;
        }
        String oggMount = mount;
        String mp3Mount;
        if (oggMount.endsWith(".ogg")) {
            mp3Mount = oggMount.substring(0, oggMount.length() - 4) + ".mp3";
        } else if (oggMount.endsWith(".mp3")) {
            mp3Mount = oggMount;
            oggMount = oggMount.substring(0, oggMount.length() - 4) + ".ogg";
        } else {
            // default to dual mounts
            mp3Mount = oggMount + ".mp3";
            oggMount = oggMount + ".ogg";
        }
        String credentials = (username != null ? username : "source") + ":" + (password != null ? password : "hackme");
        // Build base Icecast URLs; always enable TLS when publishing on port 443
        boolean useHttpsPublish = (port == 443);
        if (useHttpsPublish) {
            logger.info("Enforcing TLS for Icecast publishing on port 443 (adding tls=1)");
        }
        String tlsParam = useHttpsPublish ? (oggMount.contains("?") ? "&tls=1" : "?tls=1") : "";
        String tlsParamMp3 = useHttpsPublish ? (mp3Mount.contains("?") ? "&tls=1" : "?tls=1") : "";
        String oggIcecastUrl = "icecast://" + credentials + "@" + icecastHostname + ":" + port + oggMount + tlsParam;
        String mp3IcecastUrl = "icecast://" + credentials + "@" + icecastHostname + ":" + port + mp3Mount + tlsParamMp3;

        // Warn if default password is in use (do not log the password itself)
        if ("hackme".equals(icecastService.getIcecastPassword())) {
            logger.warn("Icecast source password is using the default value. Set ICECAST_PASSWORD in your environment for security.");
        }

        // Use FFmpeg's tee muxer to output to both OGG and MP3 simultaneously
        cmd.addAll(Arrays.asList(
                // Map the input audio stream twice
                "-map", "0:a", "-map", "0:a",
                
                // First output: OGG Vorbis (for web compatibility)
                "-c:a:0", "libvorbis", "-b:a:0", "128k",
                "-ar:a:0", "48000", "-ac:a:0", "2",
                "-tune", "zerolatency",
                "-content_type", "application/ogg",
                "-ice_name", "WildCats Radio Live (OGG)",
                "-ice_description", "Live audio broadcast in OGG format",
                "-f", "ogg", oggIcecastUrl,
                
                // Second output: MP3 (for mobile compatibility)
                "-c:a:1", "libmp3lame", "-b:a:1", "128k",
                "-ar:a:1", "48000", "-ac:a:1", "2",
                "-tune", "zerolatency",
                "-content_type", "audio/mpeg", 
                "-ice_name", "WildCats Radio Live (MP3)",
                "-ice_description", "Live audio broadcast in MP3 format",
                "-f", "mp3", mp3IcecastUrl
        ));

        // Optional connectivity pre-check with fallback
        int selectedPort = icecastService.getIcecastSourcePort();
        boolean precheckEnabled = false;
        try {
            precheckEnabled = networkConfig.getClass().getMethod("isIcecastPrecheckEnabled").invoke(networkConfig) instanceof Boolean
                    ? (Boolean) networkConfig.getClass().getMethod("isIcecastPrecheckEnabled").invoke(networkConfig)
                    : false;
        } catch (Exception ignore) {
            // Backward compatibility if property/getter doesn't exist
        }

        boolean connectivityOk = true;
        if (precheckEnabled) {
            connectivityOk = TcpProbe.check(icecastHostname, selectedPort, 3000);
            if (!connectivityOk) {
                logger.warn("Connectivity pre-check failed to {}:{}; will attempt fallback if configured", icecastHostname, selectedPort);
                int alt = 0;
                try {
                    alt = networkConfig.getIcecastAltPort();
                } catch (Exception e) {
                    // ignore
                }
                if (alt > 0 && TcpProbe.check(icecastHostname, alt, 3000)) {
                    selectedPort = alt;
                    logger.info("Using fallback Icecast port: {}", selectedPort);
                } else {
                    logger.warn("No working fallback port found during pre-check. Proceeding anyway; FFmpeg may fail to connect.");
                }
            } else {
                logger.info("Connectivity pre-check OK for {}:{}", icecastHostname, selectedPort);
            }
        } else {
            logger.info("Using Icecast server {}:{} without connectivity pre-checks", icecastHostname, selectedPort);
        }
        port = selectedPort;

        // Update URLs with possibly adjusted port and TLS parameter
        useHttpsPublish = (port == 443);
        if (useHttpsPublish) {
            logger.info("Enforcing TLS for Icecast publishing on port 443 (adding tls=1)");
        }
        tlsParam = useHttpsPublish ? (oggMount.contains("?") ? "&tls=1" : "?tls=1") : "";
        tlsParamMp3 = useHttpsPublish ? (mp3Mount.contains("?") ? "&tls=1" : "?tls=1") : "";
        oggIcecastUrl = "icecast://" + credentials + "@" + icecastHostname + ":" + port + oggMount + tlsParam;
        mp3IcecastUrl = "icecast://" + credentials + "@" + icecastHostname + ":" + port + mp3Mount + tlsParamMp3;

        // Log sanitized command and URLs after port selection
        String sanitizedCmd = maskIcecastCredentials(String.join(" ", cmd));
        logger.info("Starting FFmpeg with dual streaming command: {}", sanitizedCmd);
        logger.info("OGG Icecast URL: {}", maskIcecastCredentials(oggIcecastUrl));
        logger.info("MP3 Icecast URL: {}", maskIcecastCredentials(mp3IcecastUrl));
        logger.info("Icecast hostname resolved to: {}", icecastHostname);

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

                // Capture final URLs for inner-thread logging
                final String ffOggUrl = oggIcecastUrl;
                final String ffMp3Url = mp3IcecastUrl;

                // Enhanced FFmpeg monitoring with race condition detection
                final boolean[] connectionSuccessful = {false};
                final boolean[] raceConditionDetected = {false};
                // Input quality detection (sample rate and channels)
                final int[] detectedSampleRate = {0};
                final String[] detectedChannels = {null};
                final boolean[] lowQualityDetected = {false};

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

                            // Detect input audio quality from FFmpeg stream info
                            if (!lowQualityDetected[0] && line.contains("Audio:")) {
                                try {
                                    // Extract sample rate (number before " Hz")
                                    int hzPos = line.indexOf(" Hz");
                                    if (hzPos > 0) {
                                        int start = hzPos - 1;
                                        while (start >= 0 && Character.isDigit(line.charAt(start))) {
                                            start--;
                                        }
                                        String rateStr = line.substring(start + 1, hzPos).trim();
                                        try {
                                            detectedSampleRate[0] = Integer.parseInt(rateStr);
                                        } catch (NumberFormatException ignore) {
                                            detectedSampleRate[0] = 0;
                                        }
                                    }
                                    String lower = line.toLowerCase();
                                    if (lower.contains("stereo")) {
                                        detectedChannels[0] = "stereo";
                                    } else if (lower.contains("mono")) {
                                        detectedChannels[0] = "mono";
                                    }

                                    boolean badRate = detectedSampleRate[0] > 0 && detectedSampleRate[0] < 44100;
                                    boolean badChannels = "mono".equals(detectedChannels[0]);
                                    if (badRate || badChannels) {
                                        lowQualityDetected[0] = true;
                                        logger.error("Rejecting low-quality input audio ({} Hz, {}) — requires >= 44100 Hz and stereo", detectedSampleRate[0], detectedChannels[0] == null ? "unknown" : detectedChannels[0]);
                                        try {
                                            session.close(new CloseStatus(4000, "Low-quality input audio detected (requires stereo and >= 44.1 kHz). Please select a source with system/tab audio."));
                                        } catch (IOException closeEx) {
                                            logger.warn("Error closing session after low-quality detection: {}", closeEx.getMessage());
                                        }
                                        if (ffmpeg != null && ffmpeg.isAlive()) {
                                            ffmpeg.destroy();
                                        }
                                        // Break loop to stop further processing
                                        break;
                                    }
                                } catch (Exception parseEx) {
                                    logger.debug("Could not parse FFmpeg audio stream info: {}", parseEx.getMessage());
                                }
                            }

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
                                logger.warn("Check if Icecast server is running and accessible on the configured port");
                                break;
                            }

                            // Check for URL/protocol errors
                            if (line.contains("Invalid argument") ||
                                    line.contains("Port missing in uri") ||
                                    line.contains("Protocol not found")) {
                                logger.error("FFmpeg URL/protocol error (attempt {}): {}", attempts[0], line);
                                logger.error("Check Icecast URL format: {}", ffOggUrl);
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
            dataWritesDisabled = true;
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
            if (!dataWritesDisabled) {
                dataWritesDisabled = true;
                logger.warn("FFmpeg process is not running, cannot write data");
                try {
                    session.close(new CloseStatus(1011, "FFmpeg process not available"));
                } catch (IOException e) {
                    logger.error("Error closing WebSocket session", e);
                }
            }
            // Drop subsequent binary frames silently to avoid log spam
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

    /** Utility: mask Icecast credentials in any string to avoid leaking secrets in logs */
    private String maskIcecastCredentials(String text) {
        if (text == null || text.isEmpty()) return text;
        String[] markers = new String[] {"icecast://", "icecast+https://", "icecast+http://"};
        String result = text;
        for (String marker : markers) {
            StringBuilder out = new StringBuilder();
            int idx = 0;
            while (true) {
                int start = result.indexOf(marker, idx);
                if (start < 0) {
                    out.append(result.substring(idx));
                    break;
                }
                // Append preceding part
                out.append(result, idx, start);
                int at = result.indexOf('@', start + marker.length());
                if (at > 0) {
                    // Extract user (before ':') if present
                    String credPart = result.substring(start + marker.length(), at); // user:pass or just host if malformed
                    String user = credPart;
                    int colon = credPart.indexOf(':');
                    if (colon >= 0) {
                        user = credPart.substring(0, colon);
                    } else {
                        // No colon found; just mask entire credPart
                        user = "***";
                    }
                    out.append(marker).append(user).append(":****@");
                    idx = at + 1;
                } else {
                    // No '@' → append as-is and break
                    out.append(result.substring(start));
                    idx = result.length();
                    break;
                }
            }
            result = out.toString();
        }
        return result;
    }

    /**
     * Check if Icecast mount points are available (not occupied by another source)
     * This helps prevent race conditions during audio source switching
     */
    private boolean checkMountPointAvailability(String icecastHostname) {
        int port = icecastService.getIcecastSourcePort();
        // Determine primary and alternate mounts based on configured mount
        String primaryMount = icecastService.getIcecastMount();
        if (primaryMount == null || primaryMount.isEmpty()) {
            primaryMount = "/live.ogg";
        }
        if (!primaryMount.startsWith("/")) {
            primaryMount = "/" + primaryMount;
        }
        String altMount;
        if (primaryMount.endsWith(".ogg")) {
            altMount = primaryMount.substring(0, primaryMount.length() - 4) + ".mp3";
        } else if (primaryMount.endsWith(".mp3")) {
            altMount = primaryMount.substring(0, primaryMount.length() - 4) + ".ogg";
        } else {
            altMount = primaryMount + ".mp3";
            primaryMount = primaryMount + ".ogg";
        }

        // Try direct HTTP to Icecast source port first, then HTTPS via reverse proxy
        String[] statusUrls = new String[] {
            "http://" + icecastHostname + ":" + port + "/status-json.xsl",
            "https://" + icecastHostname + "/status-json.xsl"
        };

        for (String urlStr : statusUrls) {
            try {
                URL statusUrl = new URL(urlStr);
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

                        // Check if the configured mounts are currently occupied
                        boolean mountAOpp = (jsonResponse.contains("\"mount\":\"" + primaryMount + "\"") || jsonResponse.contains("\"listenurl\":")) && jsonResponse.contains("\"source_ip\"");
                        boolean mountBOpp = (jsonResponse.contains("\"mount\":\"" + altMount + "\"") || jsonResponse.contains("\"listenurl\":")) && jsonResponse.contains("\"source_ip\"");

                        if (mountAOpp || mountBOpp) {
                            logger.warn("Mount points still occupied ({}): primary={}, alt={}", urlStr, mountAOpp, mountBOpp);
                            return false;
                        }

                        logger.debug("Mount points appear available for new connection (checked via {})", urlStr);
                        return true;
                    }
                } else {
                    logger.debug("Mount status check via {} returned HTTP {}", urlStr, connection.getResponseCode());
                }
            } catch (Exception e) {
                logger.debug("Mount status check via {} failed: {}", urlStr, e.getMessage());
            }
        }

        // If we couldn't confirm occupancy, assume available to avoid blocking start
        logger.warn("Could not confirm mount availability via direct or HTTPS; proceeding optimistically");
        return true;
    }

    // Lightweight TCP connectivity probe
    private static class TcpProbe {
        static boolean check(String host, int port, int timeoutMs) {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), timeoutMs);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
