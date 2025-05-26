# WildCats Radio - Streaming Troubleshooting Guide

## Common Streaming Issues and Solutions

### Issue 1: FFmpeg Connection Aborted (Error -10053)

**Symptoms:**
- Stream starts but disconnects after a few seconds
- FFmpeg logs show "Error number -10053 occurred"
- Icecast logs show "Disconnecting source due to socket timeout"

**Causes:**
- Network connection instability
- Firewall blocking the connection
- Icecast server timeout settings
- FFmpeg timeout settings

**Solutions:**

1. **Check Icecast Configuration:**
   ```xml
   <source-timeout>0</source-timeout>  <!-- Disable source timeout -->
   ```

2. **Enable FFmpeg Reconnection (already implemented):**
   ```properties
   ffmpeg.reconnect.enabled=true
   ffmpeg.reconnect.delay.max=5
   ffmpeg.rw.timeout=5000000
   ffmpeg.retry.attempts=3
   ```

3. **Check Network Configuration:**
   - Ensure firewall allows connections on port 8000
   - Check if antivirus is blocking connections
   - Verify network stability

### Issue 2: Missing Fallback Audio File

**Symptoms:**
- Icecast logs show "unable to open file './web/silence.ogg'"
- Stream fails to fallback when disconnecting

**Solution:**
- The `silence.ogg` file has been created in `Icecast/web/`
- If missing, recreate it with:
  ```bash
  ffmpeg -f lavfi -i "anullsrc=sample_rate=44100:channel_layout=mono" -t 60 -c:a libvorbis -b:a 64k silence.ogg
  ```

### Issue 3: Wrong Request Type from Client

**Symptoms:**
- Icecast error log shows repeated "Wrong request type from client"
- This usually indicates HTTP health checks from the Spring Boot application

**Solution:**
- These are normal health check requests and can be ignored
- The frequency indicates the polling interval from `IcecastService`

### Issue 4: Source Authentication Failure

**Symptoms:**
- FFmpeg receives "403 Forbidden" from Icecast
- Cannot connect to mount point

**Solution:**
- Verify source credentials in `application.properties`:
  ```properties
  icecast.source.username=source
  icecast.source.password=hackme
  ```
- Check Icecast configuration matches:
  ```xml
  <username>source</username>
  <password>hackme</password>
  ```

## Configuration Improvements Made

### 1. Enhanced FFmpeg Command
- Added reconnection settings
- Configurable timeout values
- Better error detection and retry logic

### 2. Icecast Configuration Updates
- Set `source-timeout` to 0 (no timeout)
- Added fallback mount configuration
- Proper CORS headers

### 3. Application Properties
```properties
# FFmpeg Streaming Configuration
ffmpeg.reconnect.enabled=true
ffmpeg.reconnect.delay.max=5
ffmpeg.rw.timeout=5000000
ffmpeg.retry.attempts=3
```

### 4. Connection Monitoring
- Added connection state tracking
- Improved error detection
- Better logging for debugging

## Testing the Fixes

1. **Start Icecast Server:**
   ```bash
   cd Icecast
   icecast -c icecast.xml
   ```

2. **Start Spring Boot Application:**
   ```bash
   mvn spring-boot:run
   ```

3. **Initiate Broadcast:**
   - Create a schedule in the frontend
   - Start broadcasting
   - Monitor logs for connection stability

## Monitoring Commands

1. **Check Icecast Status:**
   ```bash
   curl http://192.168.254.107:8000/status-json.xsl
   ```

2. **Monitor Icecast Logs:**
   ```bash
   tail -f Icecast/log/error.log
   tail -f Icecast/log/access.log
   ```

3. **Check Active Mount Points:**
   ```bash
   curl http://192.168.254.107:8000/admin/stats.xml -u admin:hackme
   ```

## Additional Recommendations

1. **Network Stability:**
   - Use wired connection instead of Wi-Fi if possible
   - Check for bandwidth limitations
   - Monitor network latency

2. **System Resources:**
   - Ensure sufficient CPU and memory
   - Close unnecessary applications during streaming
   - Monitor system performance

3. **Firewall Configuration:**
   - Allow inbound/outbound connections on port 8000
   - Allow FFmpeg through Windows Defender/antivirus
   - Consider disabling Windows Firewall temporarily for testing

4. **Audio Quality Settings:**
   - Current: 128k Vorbis encoding
   - Can be reduced to 96k or 64k for better stability
   - Monitor encoding performance vs quality

## Log Analysis

**Good Connection Indicators:**
- "FFmpeg successfully connected to Icecast"
- "Source logging in at mountpoint '/live.ogg'"
- "seen initial vorbis header"

**Problem Indicators:**
- "Error number -10053 occurred"
- "Disconnecting source due to socket timeout"
- "Connection aborted"
- "Wrong request type from client" (if excessive)

## Contact Information

If issues persist after trying these solutions:
1. Check the specific error messages in logs
2. Verify network configuration
3. Test with minimal configuration
4. Consider using a different network environment 