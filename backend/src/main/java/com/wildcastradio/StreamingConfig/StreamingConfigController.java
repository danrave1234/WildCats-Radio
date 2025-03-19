package com.wildcastradio.StreamingConfig;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/config/streaming")
public class StreamingConfigController {

    private final StreamingConfigService streamingConfigService;

    public StreamingConfigController(StreamingConfigService streamingConfigService) {
        this.streamingConfigService = streamingConfigService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<StreamingConfigEntity> getStreamingConfig() {
        StreamingConfigEntity config = streamingConfigService.getConfig();
        return ResponseEntity.ok(config);
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StreamingConfigEntity> updateStreamingConfig(@RequestBody StreamingConfigEntity updatedConfig) {
        StreamingConfigEntity savedConfig = streamingConfigService.updateConfig(updatedConfig);
        return ResponseEntity.ok(savedConfig);
    }
} 