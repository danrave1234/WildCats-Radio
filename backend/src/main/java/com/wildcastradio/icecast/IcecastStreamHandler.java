package com.wildcastradio.icecast;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
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

import com.wildcastradio.config.NetworkConfig;

/**
 * WebSocket handler for streaming audio from DJ's browser to Icecast.
 * Receives binary WebSocket messages containing audio data and pipes them
 * through FFmpeg to Icecast server.
 */
@Component
public class IcecastStreamHandler extends BinaryWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(IcecastStreamHandler.class);
    private Process ffmpeg;
    
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
        
        String serverIp = networkConfig.getServerIp();
        logger.info("Using server IP: {}", serverIp);

        // Build FFmpeg command for Icecast
        List<String> cmd = new ArrayList<>(Arrays.asList(
                "ffmpeg",
                "-f", "webm", "-i", "pipe:0",  // Read WebM from stdin
                "-c:a", "libvorbis", "-b:a", "128k",  // Convert to Ogg Vorbis
                "-content_type", "application/ogg",
                "-ice_name", "WildCats Radio Live",
                "-ice_description", "Live audio broadcast",
                "-f", "ogg"
        ));

        // Add Icecast URL with dynamic IP and source credentials
        cmd.add("icecast://source:hackme@" + serverIp + ":" + networkConfig.getIcecastPort() + "/live.ogg");

        logger.info("Starting FFmpeg with command: {}", String.join(" ", cmd));

        // Try to start FFmpeg with retry logic for 403 errors
        boolean started = false;
        final int[] attempts = {0}; // Use array to make it effectively final
        int maxAttempts = 3;
        
        while (!started && attempts[0] < maxAttempts) {
            attempts[0]++;
            try {
                // Start FFmpeg process
                ProcessBuilder pb = new ProcessBuilder(cmd);
                pb.redirectErrorStream(true);
                ffmpeg = pb.start();

                // Start a thread to monitor FFmpeg output and detect errors
                Thread loggingThread = new Thread(() -> {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(ffmpeg.getInputStream()))) {
                        String line;
                        boolean connectionSuccessful = false;
                        
                        while ((line = reader.readLine()) != null) {
                            logger.info("FFmpeg: {}", line);
                            
                            // Check for successful connection indicators
                            if (line.contains("Opening") && line.contains("for writing")) {
                                connectionSuccessful = true;
                                logger.info("FFmpeg successfully connected to Icecast");
                            }
                            
                            // Check for 403 Forbidden error
                            if (line.contains("403") && line.contains("Forbidden")) {
                                logger.warn("FFmpeg received 403 Forbidden from Icecast (attempt {})", attempts[0]);
                                break;
                            }
                        }
                        
                        if (!connectionSuccessful) {
                            logger.warn("FFmpeg connection may have failed");
                        }
                        
                    } catch (IOException e) {
                        logger.warn("Error reading FFmpeg output: {}", e.getMessage());
                    }
                });
                loggingThread.setDaemon(true);
                loggingThread.start();

                // Give FFmpeg a moment to establish connection
                Thread.sleep(1000);
                
                // Check if process is still alive (not immediately failed)
                if (ffmpeg.isAlive()) {
                    started = true;
                    logger.info("FFmpeg process started successfully for session: {} (attempt {})", session.getId(), attempts[0]);
                    
                    // Notify service that broadcast started
                    icecastService.notifyBroadcastStarted(session.getId());
                    
                    // Publish event to trigger status update
                    eventPublisher.publishEvent(new StreamStatusChangeEvent(this, true));
                    
                } else {
                    logger.warn("FFmpeg process failed immediately (attempt {})", attempts[0]);
                    if (attempts[0] < maxAttempts) {
                        logger.info("Retrying FFmpeg connection in 500ms...");
                        Thread.sleep(500);
                    }
                }

            } catch (IOException e) {
                logger.error("Failed to start FFmpeg process (attempt {}): {}", attempts[0], e.getMessage());
                if (attempts[0] < maxAttempts) {
                    logger.info("Retrying FFmpeg connection in 500ms...");
                    try {
                        Thread.sleep(500);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.error("Interrupted while starting FFmpeg process");
                break;
            }
        }
        
        if (!started) {
            logger.error("Failed to start FFmpeg after {} attempts", maxAttempts);
            session.close(new CloseStatus(1011, "Failed to start streaming process after multiple attempts"));
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
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        logger.info("WebSocket connection closed with status: {}", status);
        
        // Notify the Icecast service that the broadcast has ended
        icecastService.notifyBroadcastEnded(session.getId());
        
        // Publish event to trigger status update
        eventPublisher.publishEvent(new StreamStatusChangeEvent(this, false));
        
        if (ffmpeg != null) {
            logger.info("Terminating FFmpeg process");
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
        
        if (ffmpeg != null && ffmpeg.isAlive()) {
            ffmpeg.destroy();
            ffmpeg = null;
        }
        super.handleTransportError(session, exception);
    }
} 