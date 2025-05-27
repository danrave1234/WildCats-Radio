@echo off
echo Testing FFmpeg connection to Icecast server...
echo.

REM Test if we can reach the Icecast server
echo [1/3] Testing network connectivity...
ping -n 1 34.142.131.206
if %errorlevel% neq 0 (
    echo ERROR: Cannot reach Icecast server
    pause
    exit /b 1
)

echo.
echo [2/3] Testing HTTP connection to Icecast...
curl -I http://34.142.131.206:8000/ 2>nul
if %errorlevel% neq 0 (
    echo WARNING: HTTP connection to Icecast may have issues
) else (
    echo ✓ Icecast HTTP server is responding
)

echo.
echo [3/3] Testing FFmpeg streaming to Icecast...
echo Creating a test 5-second silence stream...

REM Create a short test stream using FFmpeg
ffmpeg -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" -t 5 -c:a libvorbis -b:a 128k -content_type "application/ogg" -ice_name "Test Stream" -ice_description "Test broadcast" -f ogg "icecast://source:hackme@34.142.131.206:8000/live.ogg"

if %errorlevel% equ 0 (
    echo ✓ FFmpeg successfully connected to Icecast server
    echo The streaming configuration is working properly
) else (
    echo ✗ FFmpeg failed to connect to Icecast server
    echo.
    echo Possible issues:
    echo 1. Icecast credentials are incorrect (current: source/hackme)
    echo 2. Mount point /live.ogg is not configured on Icecast
    echo 3. Icecast server is not accepting source connections
    echo 4. Network firewall is blocking the connection
)

echo.
echo Test complete.
pause 