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
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * WebSocket handler for audio streaming to Shoutcast server via FFmpeg transcoding.
 * This handler receives binary audio data from the client, processes it through FFmpeg,
 * and sends it to the Shoutcast DNAS server.
 */
@Component
public class AudioStreamHandler extends BinaryWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(AudioStreamHandler.class);
    
    // Store active streaming sessions (sessionId -> Process)
    private final ConcurrentHashMap<String, Process> ffmpegProcesses = new ConcurrentHashMap<>();
    
    @Value("${shoutcast.server.url:localhost}")
    private String serverUrl;

    @Value("${shoutcast.server.port:8000}")
    private String serverPort;

    @Value("${shoutcast.server.source.password:hackme}")
    private String sourcePassword;
    
    @Value("${shoutcast.server.mount:/stream}")
    private String mountPoint;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        logger.info("WebSocket connection established for audio streaming: {}", sessionId);
        
        try {
            // Create the FFmpeg process to transcode WebM audio to MP3 for Shoutcast
            String streamUrl = "icecast://source:" + sourcePassword + "@" + serverUrl + ":" + serverPort + mountPoint;
            
            List<String> command = new ArrayList<>();
            command.add("ffmpeg");
            command.add("-y");                 // Overwrite output files
            command.add("-f");                // Format
            command.add("webm");              // WebM input format
            command.add("-i");                // Input file
            command.add("pipe:0");            // Read from stdin
            command.add("-c:a");              // Audio codec
            command.add("libmp3lame");        // MP3 codec
            command.add("-b:a");              // Audio bitrate
            command.add("128k");              // 128kbps
            command.add("-ac");               // Audio channels
            command.add("2");                 // Stereo
            command.add("-ar");               // Audio sample rate
            command.add("44100");             // 44.1kHz
            command.add("-f");                // Output format
            command.add("mp3");               // MP3
            command.add(streamUrl);           // Output URL
            
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);     // Redirect error stream to output stream
            
            logger.info("Starting FFmpeg process with command: {}", String.join(" ", command));
            Process ffmpeg = pb.start();
            ffmpegProcesses.put(sessionId, ffmpeg);
            
            // Start a thread to log FFmpeg output
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(ffmpeg.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        logger.info("FFmpeg [{}]: {}", sessionId, line);
                    }
                } catch (IOException e) {
                    logger.error("Error reading FFmpeg output for session {}", sessionId, e);
                }
            }).start();
            
            logger.info("FFmpeg process started successfully for session {}", sessionId);
            
        } catch (Exception e) {
            logger.error("Failed to start FFmpeg process for session {}", sessionId, e);
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws IOException {
        String sessionId = session.getId();
        Process ffmpeg = ffmpegProcesses.get(sessionId);
        
        if (ffmpeg != null && ffmpeg.isAlive()) {
            try {
                // Write audio data to FFmpeg's stdin
                ffmpeg.getOutputStream().write(message.getPayload().array());
                ffmpeg.getOutputStream().flush();
            } catch (IOException e) {
                logger.error("Error writing to FFmpeg process for session {}", sessionId, e);
                session.close(CloseStatus.SERVER_ERROR);
            }
        } else {
            logger.warn("Received message for session {} but FFmpeg process is not active", sessionId);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        logger.info("WebSocket connection closed for session {}: {}", sessionId, status);
        
        Process ffmpeg = ffmpegProcesses.remove(sessionId);
        if (ffmpeg != null) {
            logger.info("Stopping FFmpeg process for session {}", sessionId);
            
            try {
                // Gracefully close stdin to signal EOF to FFmpeg
                ffmpeg.getOutputStream().close();
                
                // Wait for process to terminate
                boolean terminated = ffmpeg.waitFor(5, TimeUnit.SECONDS);
                if (!terminated) {
                    logger.warn("FFmpeg process did not terminate gracefully for session {}, forcing shutdown", sessionId);
                    ffmpeg.destroyForcibly();
                }
            } catch (IOException | InterruptedException e) {
                logger.error("Error stopping FFmpeg process for session {}", sessionId, e);
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                ffmpeg.destroyForcibly();
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String sessionId = session.getId();
        logger.error("Transport error for session {}", sessionId, exception);
        Process ffmpeg = ffmpegProcesses.remove(sessionId);
        if (ffmpeg != null) {
            ffmpeg.destroyForcibly();
        }
        super.handleTransportError(session, exception);
    }
} 