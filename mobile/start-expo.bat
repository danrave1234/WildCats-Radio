@echo off
echo Starting Expo development server with different connection options...
echo.
echo Choose connection method:
echo 1. Local network (default)
echo 2. Tunnel mode (for restricted networks)
echo 3. LAN mode (for local network)
echo 4. Localhost mode (for emulator)
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo Starting with local network...
    npx expo start --clear
) else if "%choice%"=="2" (
    echo Starting with tunnel mode...
    npx expo start --tunnel --clear
) else if "%choice%"=="3" (
    echo Starting with LAN mode...
    npx expo start --lan --clear
) else if "%choice%"=="4" (
    echo Starting with localhost mode...
    npx expo start --localhost --clear
) else (
    echo Invalid choice. Starting with default...
    npx expo start --clear
)

pause


