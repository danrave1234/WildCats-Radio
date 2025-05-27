# Audio Streaming Troubleshooting Guide

## Current Issues & Solutions

### 1. Audio Error: "Event {type: 'error'}" 

**Problem:** Audio element fires error events when trying to load stream.

**Possible Causes:**
- CORS issues between frontend and Icecast server
- Incorrect stream URL (IP mismatch)
- Icecast server not running or not configured correctly
- Network connectivity issues

**Solutions Applied:**

#### A. Dynamic IP Detection
- ✅ Updated `frontend/vite.config.js` to use dynamic IP detection (same as backend)
- ✅ Updated `backend NetworkConfig` to provide network information
- ✅ Updated CORS configuration to support dynamic IPs

#### B. Better Error Handling
- ✅ Improved audio error handling in `AudioStreamContext.jsx`
- ✅ Added stream URL construction helper
- ✅ Added automatic reconnection with exponential backoff

#### C. Network Debug Panel
- ✅ Added `NetworkDebugPanel.jsx` component for development debugging
- ✅ Accessible via `Ctrl+Shift+D` in development mode
- ✅ Shows actual IP addresses and URLs being used

### 2. WebSocket Connection Errors

**Problem:** "An established connection was aborted by the software in your host machine"

**Possible Causes:**
- IP address mismatch between frontend and backend
- Proxy configuration pointing to wrong IP
- CORS policy blocking WebSocket connections

**Solutions Applied:**
- ✅ Dynamic CORS configuration in `SecurityConfig.java`
- ✅ Updated proxy in `vite.config.js` to use dynamic IP detection
- ✅ Added network information endpoint for debugging

## Testing Steps

### Step 1: Check Network Configuration
1. Open your browser and go to the listener dashboard
2. Press `Ctrl+Shift+D` to open the Network Debug Panel
3. Verify that:
   - Server IP matches your actual network IP
   - All URLs are consistent (same IP used everywhere)
   - Frontend and backend can communicate

### Step 2: Verify Services Are Running
```bash
# Check if backend is running
curl http://localhost:8080/api/stream/network-info

# Check if Icecast is accessible
curl http://localhost:8000/live.ogg

# Check WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost:8080/ws-radio/
```

### Step 3: Test Audio Stream
1. Start a broadcast from DJ Dashboard
2. Check browser console for any errors
3. Use Network Debug Panel to verify stream URL
4. Try loading the stream URL directly in browser: `http://[DETECTED_IP]:8000/live.ogg`

## Configuration Files Changed

### Frontend Changes:
- `frontend/vite.config.js` - Dynamic proxy configuration
- `frontend/src/context/AudioStreamContext.jsx` - Better error handling
- `frontend/src/services/api.js` - Added network info endpoint
- `frontend/src/components/NetworkDebugPanel.jsx` - Debug utility (NEW)
- `frontend/src/pages/ListenerDashboard.jsx` - Added debug panel integration

### Backend Changes:
- `backend/src/main/java/com/wildcastradio/config/SecurityConfig.java` - Dynamic CORS
- `backend/src/main/java/com/wildcastradio/controller/StreamController.java` - Network info endpoint

## Expected Behavior

### When Everything Works:
1. **DJ Dashboard:** Starts broadcast successfully, shows "LIVE" status
2. **Listener Dashboard:** Audio plays without error, persistent red bar appears
3. **Network Debug Panel:** Shows consistent IP addresses across all URLs
4. **Browser Console:** No CORS errors, minimal WebSocket logging

### If Still Experiencing Issues:

#### Check IP Address Consistency
```javascript
// In browser console, verify these match:
console.log('Frontend Host:', window.location.hostname);
// Should match the Server IP shown in Network Debug Panel
```

#### Manual IP Override (Temporary Fix)
If dynamic detection fails, you can temporarily hardcode your IP:

1. Find your actual IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Update `frontend/vite.config.js`:
```javascript
// Replace the dynamic detection with your actual IP
const LOCAL_IP = '192.168.1.XXX'; // Your actual IP
```

#### Icecast Configuration Check
Ensure `icecast.xml` has correct network settings:
```xml
<listen-socket>
    <port>8000</port>
    <bind-address>0.0.0.0</bind-address>  <!-- Listen on all interfaces -->
</listen-socket>
```

## Debug Commands

### Check Current Network Configuration:
```bash
# Windows
ipconfig | findstr "IPv4"

# Mac/Linux  
ifconfig | grep "inet "
```

### Test Backend Endpoints:
```bash
# Get network info
curl http://localhost:8080/api/stream/network-info

# Get stream config
curl http://localhost:8080/api/stream/config

# Get stream status
curl http://localhost:8080/api/stream/status
```

### Test Direct Audio Access:
```bash
# Should return audio data or Icecast error page
curl -v http://localhost:8000/live.ogg
```

## Network Debug Panel Usage

**Access:** Press `Ctrl+Shift+D` in development mode on Listener Dashboard

**Information Displayed:**
- **Server IP:** The IP address the backend detected
- **Server Port:** Backend port (should be 8080)
- **Icecast Port:** Audio server port (should be 8000)
- **Frontend Host/Port:** Your browser's current location
- **URLs:** All the URLs being used for streaming and WebSockets

**What to Look For:**
- All IPs should be the same (your network IP, not localhost)
- URLs should be accessible when clicked
- No localhost/127.0.0.1 mixed with network IPs

## Next Steps if Issues Persist

1. **Share Network Debug Panel Info:** Take a screenshot and share the network information
2. **Check Console Logs:** Share any browser console errors
3. **Backend Logs:** Share the backend startup logs showing detected IP
4. **Test Connectivity:** Try accessing the URLs shown in debug panel directly

## Quick Fix Command Summary

```bash
# Restart everything with fresh network detection
# Terminal 1: Start backend
cd backend && mvn spring-boot:run

# Terminal 2: Start frontend  
cd frontend && npm run dev

# Terminal 3: Start Icecast (if using local Icecast)
icecast -c icecast.xml
```

The dynamic IP detection should now automatically handle network changes and ensure all components use the same IP address for communication. 