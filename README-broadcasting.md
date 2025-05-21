# WildCats Radio Broadcasting System

This document explains how the real-time broadcasting system works in WildCats Radio and how to set it up for development and production environments.

## Overview

The broadcasting system integrates with ShoutCast DNAS server to allow DJs to broadcast live audio directly from their browser to listeners. The system consists of:

1. **Backend components** for handling audio streaming and ShoutCast server integration
2. **Frontend components** for the DJ dashboard and listener experience
3. **WebSocket communication** for real-time audio data transfer

## Requirements

To use the broadcasting system, you need:

- **ShoutCast DNAS Server**: Version 2.x recommended
- **FFmpeg**: Required on the backend server for audio transcoding
- **Modern browser**: Chrome, Firefox, Safari, or Edge that supports WebAudio API

## Setup Instructions

### 1. ShoutCast Server Configuration

#### Running the ShoutCast DNAS Server

Our application requires a ShoutCast DNAS (Distributed Network Audio Server) to handle the audio streaming. Follow these steps to set up the server:

#### Windows Setup

1. Download the ShoutCast DNAS server if you don't have it already:
   - Go to https://download.nullsoft.com/shoutcast/tools/sc_serv2_win64-latest.exe
   - Save the file to your project root directory

2. Run the server:
   - Double-click the `start-shoutcast.bat` file in the project root
   - This will create the necessary directories and start the server with our configuration

3. Verify the server is running:
   - Open a browser and go to http://localhost:8000
   - You should see the ShoutCast server interface
   - Check the console window for any error messages

#### Configuration

The ShoutCast server is configured in the `sc_serv.conf` file. The main settings are:

```
portbase=8000                # Main port
adminpassword=admin          # Admin password
password=pass123             # Source password
streampath_1=/stream         # Stream mount point
```

Make sure these match the settings in `application.properties`:

```
shoutcast.server.url=localhost
shoutcast.server.port=8000
shoutcast.server.admin.password=admin
shoutcast.server.source.password=pass123
shoutcast.server.mount=/stream
```

### 2. Backend Configuration

Configure the application properties to match your ShoutCast server settings:

```properties
# ShoutCast Server Configuration
shoutcast.server.url=localhost
shoutcast.server.port=8000
shoutcast.server.admin.password=admin
shoutcast.server.source.password=pass123
shoutcast.server.mount=/stream
```

If you're developing without a ShoutCast server, you can enable test mode:

```properties
# For development, enable ShoutCast test mode to simulate the server
shoutcast.test.mode=true
```

### 3. Install FFmpeg

The backend requires FFmpeg for transcoding audio. Install it and ensure it's in your system PATH:

- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
- **Mac**: `brew install ffmpeg`
- **Linux**: `apt install ffmpeg` or equivalent package manager command

### 4. Frontend Configuration

The frontend automatically connects to the backend API to get stream information. No additional configuration is needed unless your backend is on a different domain.

## How It Works

1. **DJ initiates broadcast**:
   - DJ clicks "Start Broadcasting" in the DJ Dashboard
   - Frontend requests microphone access and starts capturing audio
   - Backend creates a broadcast record and starts an FFmpeg process

2. **Audio streaming process**:
   - Browser captures audio from microphone using WebAudio API
   - Audio is sent to backend via WebSocket as raw PCM data
   - Backend uses FFmpeg to transcode to MP3 and forward to ShoutCast
   - Audio levels are monitored and displayed in real-time

3. **Listeners tune in**:
   - Listeners see that a broadcast is live in their dashboard
   - When they click play, their browser connects to the ShoutCast stream
   - Audio is received as MP3 and played through the browser's audio system

## Troubleshooting

### Common Issues

1. **No audio transmission**:
   - Check microphone permissions in browser
   - Ensure correct audio device is selected
   - Verify WebSocket connection is established

2. **FFmpeg errors**:
   - Verify FFmpeg is installed and in PATH
   - Check logs for specific FFmpeg error messages
   - Ensure proper FFmpeg version (4.x or later recommended)

3. **ShoutCast connection issues**:
   - Verify ShoutCast server is running
   - Check ShoutCast logs for connection attempts
   - Ensure passwords and mount points match configuration

### Testing Tools

- Use `curl http://localhost:8000/stream` to check if the ShoutCast stream is accessible
- Check ShoutCast admin panel at `http://localhost:8000/admin.cgi` (login with admin password)
- Use the "Test Microphone" button in DJ Dashboard to verify audio capture

### Empty src attribute error

If you see "MEDIA_ELEMENT_ERROR: Empty src attribute" in the console:

1. Make sure the ShoutCast server is running
2. Check if the broadcast is actually live in the database
3. Verify network connectivity to the ShoutCast server
4. Check browser console for CORS errors

### No sound

If the stream connects but there's no sound:

1. Check if the DJ is actually broadcasting audio
2. Verify volume settings in the player
3. Look for FFmpeg errors in the backend logs

### Server connection issues

If the client can't connect to the ShoutCast server:

1. Verify the server is running by checking http://localhost:8000
2. Ensure your firewall isn't blocking port 8000
3. Check the logs in the `logs` directory for errors
4. Try accessing the stream directly at http://localhost:8000/stream

## Development Mode

During development, you can set `shoutcast.test.mode=true` in application.properties to bypass ShoutCast server checks. This is useful when developing features that don't require actual audio streaming.

## Broadcasting Tools

For DJs to broadcast, they need a tool that can connect to the ShoutCast server. Some recommended options:

1. [BUTT (Broadcast Using This Tool)](https://danielnoethen.de/butt/)
2. [Mixxx](https://www.mixxx.org/)
3. [OBS Studio](https://obsproject.com/) with the Audio Output Capture plugin

Configure these tools with:
- Server: localhost 
- Port: 8000
- Password: pass123
- Mount: /stream

## Production Deployment

For production, ensure the following:

1. Set `shoutcast.test.mode=false` in application.properties
2. Configure a real ShoutCast server with proper security settings
3. Use a secure WebSocket connection (wss://) for audio streaming
4. Consider implementing stream monitoring and auto-restart capabilities 