@echo off
REM Serves this folder on your local network so you can play on your phone.
REM Your phone and this PC must be on the same Wi-Fi.
REM The first time, Windows may ask about the firewall: choose "Private networks" and Allow.
cd /d "%~dp0"
echo.
echo  Gossip Gardens - local server
echo.
echo  On this PC:      http://localhost:8080/
echo  On your phone, open ONE of these (usually the one starting 192.168 or 10.):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo      http://%%a:8080/
echo.
echo  Leave this window open while you play. Press Ctrl+C to stop.
echo.
where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py 8080
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  py serve.py 8080
  goto :eof
)
echo  Python was not found, trying Node instead...
npx --yes serve -l 8080 .
