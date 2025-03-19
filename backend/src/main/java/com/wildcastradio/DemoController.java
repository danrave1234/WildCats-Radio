package com.wildcastradio;

import java.util.HashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/demo")
public class DemoController {
    
    @GetMapping
    public Map<String, Object> getDemoInfo() {
        Map<String, Object> response = new HashMap<>();
        response.put("appName", "WildCats Radio");
        response.put("version", "1.0.0");
        response.put("status", "Development");
        response.put("features", new String[] {
            "User Management",
            "Broadcasting",
            "Chat",
            "Song Requests",
            "Notifications",
            "Activity Logging",
            "Server Scheduling",
            "Streaming Configuration"
        });
        return response;
    }
} 