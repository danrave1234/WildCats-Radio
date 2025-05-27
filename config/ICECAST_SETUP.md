# Icecast Setup Instructions

This document provides instructions for setting up the Icecast streaming server for WildCats Radio.

## Prerequisites

1. **Icecast Server** - Download from [Icecast.org](https://icecast.org/download/)
2. **FFmpeg** - Install from [FFmpeg.org](https://ffmpeg.org/download.html)
3. **Java 17** or higher
4. **Spring Boot** application (WildCats Radio backend)

## Installation Steps

### 1. Install Icecast

#### Windows
1. Download the Windows installer from [Icecast.org](https://icecast.org/download/)
2. Run the installer and follow the prompts
3. This will install Icecast as a Windows service

#### Linux
```bash
# Debian/Ubuntu
sudo apt-get update
sudo apt-get install icecast2

# CentOS/RHEL
sudo yum install icecast
```

### 2. Configure Icecast

1. Copy the `icecast.xml` file from this directory to your Icecast configuration directory
   - Windows: `C:\Program Files (x86)\Icecast\icecast.xml`
   - Linux: `/etc/icecast2/icecast.xml`

2. Update the following settings in the XML file if needed:
   - Authentication credentials (admin & source passwords)
   - Port number (default: 8000)
   - Connection limits

3. Make sure the values in your `icecast.xml` match those in the Spring Boot application's `application.properties`

### 3. Open Firewall Ports

Make sure port 8000 (or your configured port) is open in your firewall:

```bash
# Linux
sudo ufw allow 8000

# Windows (PowerShell as Administrator)
New-NetFirewallRule -DisplayName "Icecast" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### 4. Start Icecast Server

#### Windows
1. Open Services (services.msc)
2. Find the Icecast service and start it
3. Or run manually: `C:\Program Files (x86)\Icecast\icecast.exe -c C:\Program Files (x86)\Icecast\icecast.xml`

#### Linux
```bash
# Debian/Ubuntu
sudo service icecast2 start

# Or directly
icecast -c /etc/icecast2/icecast.xml
```

### 5. Verify Icecast is Running

Open a browser and go to `http://localhost:8000`
You should see the Icecast status page.

## Testing the Streaming Setup

1. Start the WildCats Radio backend application
2. Make sure the application connects to the Icecast server
3. Open the DJ dashboard and test broadcasting
4. Listen to the stream through the application or direct Icecast URL: `http://localhost:8000/live.ogg`

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure Icecast is running and port 8000 is open
2. **Authentication Failed**: Verify that source password in Spring Boot matches Icecast config
3. **FFmpeg Not Found**: Ensure FFmpeg is installed and in system PATH
4. **No Audio**: Check that your audio input device is working correctly

### Logs

Check the Icecast logs for error messages:
- Windows: `C:\Program Files (x86)\Icecast\logs`
- Linux: `/var/log/icecast2` or check the path in `icecast.xml`

### Network Discovery

The application automatically detects the server's IP address for network access.
If you have issues with other devices connecting, check the following:

1. Verify the Spring Boot application correctly detected your IP address
2. Ensure all devices are on the same network
3. Check firewall settings on the server

## Security Considerations

The default configuration is for development environments. For production:

1. Change all default passwords in `icecast.xml`
2. Update the same passwords in `application.properties`
3. Consider using HTTPS for secure connections
4. Restrict admin access to trusted IPs

## Reference

- [Icecast Documentation](http://icecast.org/docs/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Spring Boot WebSocket Documentation](https://docs.spring.io/spring-framework/reference/web/websocket.html) 