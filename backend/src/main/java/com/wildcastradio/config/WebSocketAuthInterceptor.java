package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import com.wildcastradio.User.UserService;

/**
 * WebSocket interceptor to handle JWT authentication
 */
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserService userService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            // Extract JWT token from headers
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                
                try {
                    // Extract username from JWT token
                    String username = jwtUtil.extractUsername(token);
                    
                    if (username != null) {
                        // Load user details
                        UserDetails userDetails = userService.loadUserByUsername(username);
                        
                        // Validate token
                        if (jwtUtil.validateToken(token, userDetails)) {
                            // Create authentication token
                            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());
                            
                            // Set authentication in context
                            SecurityContextHolder.getContext().setAuthentication(authentication);
                            accessor.setUser(authentication);
                        }
                    }
                } catch (Exception e) {
                    // Token is invalid, but we'll let the connection proceed
                    // The individual message handlers can check authentication
                    System.err.println("WebSocket authentication failed: " + e.getMessage());
                }
            }
        }
        
        return message;
    }
} 