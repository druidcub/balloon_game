@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the offline game instead.
  start "" "%~dp0index.html"
  pause
  exit /b
)
echo Open http://127.0.0.1:4189 in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
node server.cjs
pause
