@echo off
cd /d "%~dp0"
start "After Office — servidor local" /MIN cmd /c "python -m http.server 8080"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080/index.html"
