package com.wildcastradio.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web configuration for the application.
 * 
 * CORS configuration has been moved to SecurityConfig.java to avoid conflicts.
 * Spring Security's CORS configuration takes precedence, so we disable the 
 * WebMvcConfigurer CORS configuration to prevent conflicts.
 * 
 * If you need to customize CORS settings, modify SecurityConfig.corsConfigurationSource().
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    // CORS configuration disabled - handled by SecurityConfig
    // @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173,http://localhost:5174,https://wildcat-radio.vercel.app,https://api.wildcat-radio.live}")
    // private String allowedOrigins;

    // @Override
    // public void addCorsMappings(CorsRegistry registry) {
    //     registry.addMapping("/**")
    //             .allowedOriginPatterns(allowedOrigins.split(","))
    //             .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
    //             .allowedHeaders("*")
    //             .allowCredentials(true)
    //             .maxAge(3600);
    // }
} 
