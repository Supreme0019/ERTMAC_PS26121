@echo off
title eRTMAC-NWIS Triple Server Launcher
echo ===================================================================
echo Starting all 3 eRTMAC-NWIS Servers:
echo 1) AI Microservice    : http://localhost:8000
echo 2) Backend API Server : http://localhost:4001
echo 3) Frontend Web App   : http://localhost:5173
echo ===================================================================

echo [1/3] Launching AI Microservice (Port 8000)...
start "eRTMAC AI Service [8000]" /d "%~dp0final ai\ai_service" cmd /k "call .venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app"

ping 127.0.0.1 -n 3 >nul

echo [2/3] Launching Node Backend (Port 4001)...
start "eRTMAC Backend [4001]" /d "%~dp0eRTMAC-NWIS-Final\Wells\nwis-backend" cmd /k "npm start"

ping 127.0.0.1 -n 3 >nul

echo [3/3] Launching React Frontend (Port 5173)...
start "eRTMAC Frontend [5173]" /d "%~dp0eRTMAC-NWIS-Final\Wells\nwis-frontend" cmd /k "npm run dev"

echo.
echo All 3 servers have been launched in separate terminal windows!
echo - Frontend: http://localhost:5173
echo - Backend:  http://localhost:4001/api/health
echo - AI:       http://localhost:8000/health
pause
