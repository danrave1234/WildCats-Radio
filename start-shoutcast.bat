@echo off
echo Starting ShoutCast DNAS Server for WildCats Radio...
echo.

rem Check if ShoutcastV2 directory exists
if not exist ShoutcastV2 (
  echo ShoutcastV2 directory not found!
  echo Please make sure you have the ShoutCast DNAS server installed.
  echo.
  pause
  exit /b
)

rem Check if server executable exists
if not exist ShoutcastV2\sc_serv2_win64-latest.exe (
  if not exist ShoutcastV2\sc_serv.exe (
    echo ShoutCast server executable not found!
    echo Please make sure you have the ShoutCast DNAS server installed.
    echo.
    pause
    exit /b
  )
)

rem Start the ShoutCast server with the config
echo Server logs will appear in ShoutcastV2\logs\sc_serv.log
echo.
echo Starting server...
echo.

cd ShoutcastV2
if exist sc_serv2_win64-latest.exe (
  start sc_serv2_win64-latest.exe sc_serv.conf
) else (
  start sc_serv.exe sc_serv.conf
)

echo ShoutCast server started! You can access the admin interface at http://localhost:8000/admin.cgi
echo Username: admin
echo Password: admin
echo.
echo Press any key to close this window...
pause 