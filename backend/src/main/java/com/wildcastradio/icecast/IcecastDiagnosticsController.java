package com.wildcastradio.icecast;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Profile("diagnostics")
@RestController
@RequestMapping("/api/icecast")
public class IcecastDiagnosticsController {

    private final IcecastService icecastService;

    @Autowired
    public IcecastDiagnosticsController(IcecastService icecastService) {
        this.icecastService = icecastService;
    }

    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping() {
        Map<String, Object> status = icecastService.getStreamStatus(false);
        return ResponseEntity.ok(status);
    }

    @GetMapping("/diagnostics")
    public ResponseEntity<Map<String, Object>> diagnostics() {
        Map<String, Object> diag = icecastService.diagnoseConnectivity();
        return ResponseEntity.ok(diag);
    }
}
