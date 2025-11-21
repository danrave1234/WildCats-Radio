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
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/auth/oauth2")
public class OAuth2Controller {

    private static final Logger logger = LoggerFactory.getLogger(OAuth2Controller.class);

    @Autowired
    private UserService userService;

    @Value("${app.security.cookie.secure:false}")
    private boolean useSecureCookies;

    @Value("${app.frontend.domain:http://localhost:5173}")
    private String frontendDomain;

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
            HttpServletResponse response) {
        
        // This endpoint is kept as a fallback but primary OAuth handling is done in SecurityConfig success handler
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
            if (!frontendDomain.contains("localhost")) {
                try {
                    java.net.URL url = new java.net.URL(frontendDomain);
                    String domain = url.getHost();
                    if (domain != null && !domain.startsWith("localhost")) {
                        tokenCookie.setDomain(domain);
                    }
                } catch (Exception e) {
                    // Ignore domain extraction errors
                }
            }
            tokenCookie.setPath("/");
            tokenCookie.setMaxAge(7 * 24 * 60 * 60);
            tokenCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
            response.addCookie(tokenCookie);
            
            String redirectUrl;
            if (frontendDomain.contains("localhost")) {
                redirectUrl = frontendDomain + "/?oauth=success&token=" + 
                    java.net.URLEncoder.encode(loginResponse.getToken(), java.nio.charset.StandardCharsets.UTF_8) +
                    "&userId=" + loginResponse.getUser().getId() +
                    "&userRole=" + loginResponse.getUser().getRole();
            } else {
                redirectUrl = frontendDomain + "/?oauth=success";
            }
            
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
}

