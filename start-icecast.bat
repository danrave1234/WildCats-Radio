@echo off
echo Starting Icecast Server...
echo.
cd /d "%~dp0"
"C:\Program Files (x86)\Icecast\bin\icecast.exe" -c "%~dp0config\icecast.xml"
pause 