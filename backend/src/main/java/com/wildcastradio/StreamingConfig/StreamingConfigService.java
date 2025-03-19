package com.wildcastradio.StreamingConfig;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class StreamingConfigService {

    @Value("${shoutcast.server.url:localhost}")
    private String serverUrl;
    
    @Value("${shoutcast.server.port:8000}")
    private int serverPort;
    
    @Value("${shoutcast.server.admin.password:admin}")
    private String adminPassword;
    
    @Value("${shoutcast.server.source.password:hackme}")
    private String sourcePassword;
    
    @Value("${shoutcast.server.mount:/stream/1}")
    private String mountPoint;

    private final StreamingConfigRepository streamingConfigRepository;

    public StreamingConfigService(StreamingConfigRepository streamingConfigRepository) {
        this.streamingConfigRepository = streamingConfigRepository;
    }

    public StreamingConfigEntity getConfig() {
        // Simply get the first config (there should only be one)
        return streamingConfigRepository.findAll().stream()
                .findFirst()
                .orElseGet(() -> createDefaultConfig());
    }

    public StreamingConfigEntity updateConfig(StreamingConfigEntity updatedConfig) {
        // Get the existing config or create new one if none exists
        Optional<StreamingConfigEntity> existingConfigOpt = streamingConfigRepository.findAll().stream().findFirst();
        
        StreamingConfigEntity configToSave;
        if (existingConfigOpt.isPresent()) {
            // Update fields of existing config
            StreamingConfigEntity existingConfig = existingConfigOpt.get();
            existingConfig.setServerUrl(updatedConfig.getServerUrl());
            existingConfig.setPort(updatedConfig.getPort());
            existingConfig.setMountPoint(updatedConfig.getMountPoint());
            existingConfig.setPassword(updatedConfig.getPassword());
            existingConfig.setProtocol(updatedConfig.getProtocol());
            configToSave = existingConfig;
        } else {
            // Just save the new config
            configToSave = updatedConfig;
        }
        
        return streamingConfigRepository.save(configToSave);
    }

    // Create a default configuration if none exists
    private StreamingConfigEntity createDefaultConfig() {
        StreamingConfigEntity defaultConfig = new StreamingConfigEntity(
                serverUrl,           // Server URL from properties
                serverPort,          // Port from properties
                mountPoint,          // Mount point from properties
                adminPassword,       // Admin password from properties
                "SHOUTCAST"          // Protocol
        );
        
        return streamingConfigRepository.save(defaultConfig);
    }
} 