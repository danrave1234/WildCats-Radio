# Icecast TCP Proxy Setup Guide

## Note
Deployment uses HTTPS on `https://icecast.software` (443). Port 8000 is not used externally.

## Solution
Configure the backend to use port 443 as an alternate streaming port and set up a TCP stream proxy on the Icecast VM.

## Backend Configuration (Already Applied)

The `.env` file has been updated with:
```bash
ICECAST_ALT_PORT=443
```

This tells the backend to prefer port 443 for FFmpeg connections when available.

## Icecast VM Configuration

### Option 1: Nginx Stream Proxy (Recommended)

1. **Install Nginx with stream module** (if not already installed):
```bash
sudo apt update
sudo apt install nginx-full
```

2. **Create stream configuration** (`/etc/nginx/nginx.conf`):
```nginx
# Add this to the main nginx.conf (outside http block)
stream {
    # TCP proxy for Icecast source connections
    upstream icecast_source {
        server 127.0.0.1:8000;
    }
    
    server {
        listen 443;
        proxy_pass icecast_source;
        proxy_timeout 1s;
        proxy_responses 1;
        error_log /var/log/nginx/icecast_stream.log;
    }
}

# Keep existing http block for HTTPS reverse proxy
http {
    # Your existing HTTPS configuration for web interface
    server {
        listen 443 ssl http2;
        server_name icecast.software;
        
        # SSL configuration
        ssl_certificate /path/to/your/certificate.crt;
        ssl_certificate_key /path/to/your/private.key;
        
        location / {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

3. **Test and reload Nginx**:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Simple Port Forward with iptables

If you prefer a simpler approach:

```bash
# Forward TCP traffic from port 443 to port 8000
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8000

# Make the rule persistent
sudo iptables-save > /etc/iptables/rules.v4
```

**Note**: This approach conflicts with HTTPS web access, so Option 1 is recommended.

### Option 3: Use a Different Port

If port 443 conflicts with HTTPS, use another port:

1. **Update backend .env**:
```bash
ICECAST_ALT_PORT=8443
```

2. **Configure firewall to allow port 8443**:
```bash
sudo ufw allow 8443/tcp
```

3. **No proxy needed** - FFmpeg will connect directly to port 8443.

## Testing the Configuration

1. **Restart the backend** to load the new ICECAST_ALT_PORT setting
2. **Check diagnostics**:
```bash
curl http://localhost:8080/api/icecast/diagnostics
```
3. **Attempt a broadcast** - the logs should show:
   - "Testing connectivity to Icecast server at icecast.software:443"
   - "Alternate port 443 reachable. Proceeding with streaming via alt port."

## Verification

The backend will now prefer port 443 for source publishing. There is no implicit fallback to 8000.

## Troubleshooting

- **Port 443 still blocked**: Check firewall rules on the Icecast VM
- **Nginx conflicts**: Ensure stream and http blocks don't conflict on port 443
- **SSL certificate issues**: Make sure certificates are valid for icecast.software
- **Backend not using alt port**: Restart the backend after updating .env

## Production Recommendation

Use **Option 1 (Nginx Stream Proxy)** as it:
- Maintains HTTPS web access on port 443
- Provides TCP streaming on the same port
- Offers better logging and monitoring
- Is more maintainable than iptables rules