package com.wildcastradio.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "ratelimit")
public class RateLimitProperties {
    private boolean enabled = true;

    public static class AuthLimits {
        private int perUsernamePerMinute = 5;
        private int perIpPerMinute = 50;

        public int getPerUsernamePerMinute() { return perUsernamePerMinute; }
        public void setPerUsernamePerMinute(int perUsernamePerMinute) { this.perUsernamePerMinute = perUsernamePerMinute; }
        public int getPerIpPerMinute() { return perIpPerMinute; }
        public void setPerIpPerMinute(int perIpPerMinute) { this.perIpPerMinute = perIpPerMinute; }
    }

    public static class ApiLimits {
        private int perIpPerMinute = 300;

        public int getPerIpPerMinute() { return perIpPerMinute; }
        public void setPerIpPerMinute(int perIpPerMinute) { this.perIpPerMinute = perIpPerMinute; }
    }

    public static class WebSocketLimits {
        private int handshakePerIpPerMinute = 20;

        public int getHandshakePerIpPerMinute() { return handshakePerIpPerMinute; }
        public void setHandshakePerIpPerMinute(int handshakePerIpPerMinute) { this.handshakePerIpPerMinute = handshakePerIpPerMinute; }
    }

    private AuthLimits auth = new AuthLimits();
    private ApiLimits api = new ApiLimits();
    private WebSocketLimits ws = new WebSocketLimits();
    private boolean useXForwardedFor = true;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public AuthLimits getAuth() { return auth; }
    public void setAuth(AuthLimits auth) { this.auth = auth; }

    public ApiLimits getApi() { return api; }
    public void setApi(ApiLimits api) { this.api = api; }

    public WebSocketLimits getWs() { return ws; }
    public void setWs(WebSocketLimits ws) { this.ws = ws; }

    public boolean isUseXForwardedFor() { return useXForwardedFor; }
    public void setUseXForwardedFor(boolean useXForwardedFor) { this.useXForwardedFor = useXForwardedFor; }
}
