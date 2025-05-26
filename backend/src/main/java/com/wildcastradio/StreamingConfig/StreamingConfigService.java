package com.wildcastradio.StreamingConfig;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class StreamingConfigService {

    @Value("${icecast.server.url:localhost}")
    private String serverUrl;
    
    @Value("${icecast.port:8000}")
    private int serverPort;
    
    @Value("${icecast.admin.password:hackme}")
    private String adminPassword;
    
    @Value("${icecast.source.password:hackme}")
    private String sourcePassword;
    
    @Value("${icecast.mount.point:/live.ogg}")
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
                sourcePassword,      // Source password from properties
                "ICECAST"            // Protocol
        );
        
        return streamingConfigRepository.save(defaultConfig);
    }
} 