@echo off
echo Stopping ShoutCast DNAS Server for WildCats Radio...
echo.

rem Check if PID file exists
if not exist ShoutcastV2\sc_serv_8000.pid (
  echo ShoutCast server PID file not found!
  echo The server might not be running.
  echo.
  pause
  exit /b
)

rem Read PID from file
set /p PID=<ShoutcastV2\sc_serv_8000.pid

rem Check if PID is not empty
if "%PID%"=="" (
  echo Could not read PID from PID file.
  echo.
  pause
  exit /b
)

echo Found ShoutCast server with PID: %PID%
echo Stopping server...

rem Stop the process
taskkill /PID %PID% /F

if %ERRORLEVEL% EQU 0 (
  echo ShoutCast server stopped successfully!
) else (
  echo Failed to stop the ShoutCast server. Try stopping it manually.
)

echo.
echo Press any key to close this window...
pause 