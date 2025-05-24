package com.wildcastradio.icecast;

import com.wildcastradio.config.NetworkConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

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
    
    @Autowired
    public IcecastStreamHandler(NetworkConfig networkConfig, IcecastService icecastService) {
        this.networkConfig = networkConfig;
        this.icecastService = icecastService;
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

        try {
            logger.info("Starting FFmpeg process with command: {}", String.join(" ", cmd));
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);

            ffmpeg = pb.start();
            logger.info("FFmpeg process started successfully");

            // Notify the Icecast service that a broadcast has started
            icecastService.notifyBroadcastStarted(session.getId());

            // Give FFmpeg time to initialize
            Thread.sleep(500);

            // Start a thread to monitor FFmpeg process output
            new Thread(() -> {
                try {
                    // Create a buffered reader to read FFmpeg's output
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(ffmpeg.getInputStream()))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            logger.info("FFmpeg output: {}", line);
                        }
                    }

                    int exitCode = ffmpeg.waitFor();
                    logger.info("FFmpeg process exited with code: {}", exitCode);
                    if (exitCode != 0) {
                        logger.error("FFmpeg failed with exit code: {}", exitCode);
                    }
                } catch (IOException | InterruptedException e) {
                    Thread.currentThread().interrupt();
                    logger.error("FFmpeg monitoring thread error", e);
                }
            }).start();
        } catch (IOException e) {
            logger.error("Failed to start FFmpeg process", e);
            icecastService.notifyBroadcastFailed(session.getId(), e.getMessage());
            session.close(CloseStatus.SERVER_ERROR);
            throw e;
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
        
        if (ffmpeg != null && ffmpeg.isAlive()) {
            ffmpeg.destroy();
            ffmpeg = null;
        }
        super.handleTransportError(session, exception);
    }
} 