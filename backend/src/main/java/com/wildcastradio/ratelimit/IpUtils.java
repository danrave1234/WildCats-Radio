package com.wildcastradio.ratelimit;

import jakarta.servlet.http.HttpServletRequest;

public class IpUtils {
    public static String extractClientIp(HttpServletRequest request, boolean useXff) {
        if (useXff) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                int comma = xff.indexOf(',');
                return comma > 0 ? xff.substring(0, comma).trim() : xff.trim();
            }
        }
        String ip = request.getRemoteAddr();
        return ip != null ? ip : "unknown";
    }
}
