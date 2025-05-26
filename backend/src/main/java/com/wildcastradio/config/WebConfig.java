package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web configuration for the application.
 * 
 * This class configures Cross-Origin Resource Sharing (CORS) settings to allow
 * requests from specified origins. By default, it allows requests from the local
 * development server and the Heroku deployed application.
 * 
 * To customize allowed origins:
 * 1. Set the CORS_ALLOWED_ORIGINS environment variable with a comma-separated list of origins
 * 2. Example: CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-app.herokuapp.com
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173,http://localhost:5174,https://wildcat-radio-f05d362144e6.herokuapp.com,https://wildcat-radio.vercel.app,https://wildcat-radio-f05d362144e6.autoidleapp.com,http://wildcat-radio-f05d362144e6.autoidleapp.com}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins.split(","))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
} 
