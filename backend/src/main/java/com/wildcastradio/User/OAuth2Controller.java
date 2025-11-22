package com.wildcastradio.User;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.User.DTO.LoginResponse;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/auth/oauth2")
public class OAuth2Controller {

    private static final Logger logger = LoggerFactory.getLogger(OAuth2Controller.class);

    @Autowired
    private UserService userService;

    @Value("${app.security.cookie.secure:false}")
    private boolean useSecureCookies;

    @GetMapping("/login/{provider}")
    public ResponseEntity<?> initiateOAuth2Login(@PathVariable String provider) {
        // Redirect to Spring Security OAuth2 login endpoint
        // Frontend should redirect to: /oauth2/authorization/{provider}
        return ResponseEntity.status(HttpStatus.FOUND)
            .header("Location", "/oauth2/authorization/" + provider)
            .build();
    }

    @GetMapping("/callback/{provider}")
    public ResponseEntity<?> oauth2Callback(
            @PathVariable String provider,
            @AuthenticationPrincipal OAuth2User oauth2User,
            OAuth2AuthenticationToken authentication,
            HttpServletRequest request,
            HttpServletResponse response) {
        
        // This endpoint is kept as a fallback but primary OAuth handling is done in SecurityConfig success handler
        // Note: This should rarely be called as Spring Security handles OAuth callbacks automatically
        String frontendDomain = getFrontendDomain(request);
        
        try {
            if (oauth2User == null || authentication == null) {
                return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", frontendDomain + "/login?oauth_error=auth_failed")
                    .build();
            }

            String registrationId = authentication.getAuthorizedClientRegistrationId();
            String actualProvider = registrationId != null ? registrationId : provider;
            Map<String, Object> attributes = oauth2User.getAttributes();
            
            LoginResponse loginResponse = userService.oauth2Login(attributes, actualProvider);
            
            if (loginResponse.getToken() == null || loginResponse.getToken().isEmpty()) {
                return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", frontendDomain + "/login?oauth_error=token_failed")
                    .build();
            }

            // Set cookies
            Cookie tokenCookie = new Cookie("token", loginResponse.getToken());
            tokenCookie.setHttpOnly(true);
            tokenCookie.setSecure(useSecureCookies);
            setCookieDomain(tokenCookie, request);
            tokenCookie.setPath("/");
            tokenCookie.setMaxAge(7 * 24 * 60 * 60);
            tokenCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
            response.addCookie(tokenCookie);
            
            String redirectUrl = frontendDomain + "/?oauth=success";
            
            return ResponseEntity.status(HttpStatus.FOUND)
                .header("Location", redirectUrl)
                .build();
                
        } catch (Exception e) {
            logger.error("OAuth2 callback error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FOUND)
                .header("Location", frontendDomain + "/login?oauth_error=unexpected_error")
                .build();
        }
    }
    
    /**
     * Auto-detect frontend domain from request headers
     */
    private String getFrontendDomain(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin != null && !origin.isEmpty()) {
            return origin;
        }
        
        String referer = request.getHeader("Referer");
        if (referer != null && !referer.isEmpty()) {
            try {
                java.net.URL url = new java.net.URL(referer);
                String protocol = url.getProtocol();
                String host = url.getHost();
                int port = url.getPort();
                if (port != -1 && port != 80 && port != 443) {
                    return protocol + "://" + host + ":" + port;
                }
                return protocol + "://" + host;
            } catch (Exception e) {
                logger.debug("Could not parse Referer header: {}", e.getMessage());
            }
        }
        
        String host = request.getHeader("Host");
        if (host == null || host.isEmpty()) {
            host = request.getServerName();
            int port = request.getServerPort();
            if (port != 80 && port != 443 && port != -1) {
                host += ":" + port;
            }
        }
        
        if (host.contains("localhost") || host.contains("127.0.0.1")) {
            return "http://localhost:5173";
        }
        
        String domain = host.split(":")[0];
        // Simple root domain extraction for this fallback
        String[] parts = domain.split("\\.");
        if (parts.length > 2) {
            domain = parts[parts.length - 2] + "." + parts[parts.length - 1];
        }
        return "https://" + domain;
    }
    
    /**
     * Set cookie domain for cross-subdomain sharing
     */
    private void setCookieDomain(Cookie cookie, HttpServletRequest request) {
        String host = request.getHeader("Host");
        if (host == null || host.isEmpty()) {
            host = request.getServerName();
        }
        
        String domain = host.split(":")[0];
        if (domain != null && !domain.contains("localhost") && !domain.contains("127.0.0.1")) {
            String[] parts = domain.split("\\.");
            if (parts.length > 2) {
                String rootDomain = parts[parts.length - 2] + "." + parts[parts.length - 1];
                cookie.setDomain("." + rootDomain);
            }
        }
    }
}

