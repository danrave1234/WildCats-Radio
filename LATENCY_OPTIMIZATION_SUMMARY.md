# WildCats Radio - Latency Optimization Summary

## Issue
When turning on the broadcast, listeners experienced an 8-second delay before hearing the audio stream.

## Root Causes Identified
1. **Icecast Server Buffering**: Large queue-size (512KB) and burst-size (32KB) settings
2. **Frontend Audio Buffering**: Large audio buffer size (4096) and slow MediaRecorder capture interval (500ms)
3. **Backend WebSocket Buffering**: Large buffer sizes (256KB binary, 128KB text)
4. **Network Latency**: Long heartbeat intervals and disconnect delays

## Optimizations Implemented

### 1. Icecast Configuration (`Icecast/icecast.xml`)
- **queue-size**: 524288 → 65536 (reduced by 87.5%, from 512KB to 64KB)
- **burst-size**: 32768 → 8192 (reduced by 75%, from 32KB to 8KB)
- **burst-on-connect**: 1 → 0 (disabled initial burst buffering)

### 2. Frontend Configuration (`frontend/src/config.js`)
- **audioBufferSize**: 4096 → 2048 (reduced by 50% for deployed environments)

### 3. Frontend Streaming (`frontend/src/context/StreamingContext.jsx`)
- **MediaRecorder interval**: 500ms → 250ms (reduced by 50%)
- Applied to all MediaRecorder instances (3 locations updated)

### 4. Backend WebSocket Configuration (`backend/src/main/resources/application.properties`)
- **max-binary-message-buffer-size**: 262144 → 65536 (reduced by 75%, from 256KB to 64KB)
- **max-text-message-buffer-size**: 131072 → 32768 (reduced by 75%, from 128KB to 32KB)
- **sockjs.heartbeat-time**: 25000 → 15000 (reduced by 40%, from 25s to 15s)
- **sockjs.disconnect-delay**: 5000 → 2000 (reduced by 60%, from 5s to 2s)

## Expected Results
- **Estimated latency reduction**: From ~8 seconds to ~2-3 seconds
- **Improved responsiveness**: Faster audio data transmission through the entire pipeline
- **Better real-time experience**: Listeners will hear broadcasts much closer to real-time

## Testing Instructions

### For DJs (Broadcasters):
1. Start a new broadcast session
2. Speak into the microphone or play audio
3. Note the time when you start speaking

### For Listeners:
1. Join the broadcast stream
2. Measure the time between when the DJ speaks and when you hear it
3. Compare with previous 8-second delay

### Technical Testing:
1. Monitor browser developer console for MediaRecorder chunk timing logs
2. Check WebSocket message frequency (should be every 250ms instead of 500ms)
3. Verify Icecast server status shows reduced buffer usage

## Deployment Notes
- **Icecast server restart required** for configuration changes to take effect
- **Frontend rebuild required** for config.js changes
- **Backend restart required** for application.properties changes
- All changes are backward compatible and safe to deploy

## Monitoring
- Watch for any audio quality degradation due to reduced buffering
- Monitor WebSocket connection stability with reduced buffer sizes
- Check Icecast server performance with smaller queue sizes

## Rollback Plan
If issues occur, revert the following key settings:
- Icecast queue-size back to 524288
- MediaRecorder interval back to 500ms
- WebSocket buffer sizes back to original values

## Additional Optimizations (Future)
- Consider implementing adaptive bitrate streaming
- Explore WebRTC for even lower latency
- Implement client-side buffer size adjustment based on network conditions