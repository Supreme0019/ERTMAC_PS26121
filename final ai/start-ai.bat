@echo off
title eRTMAC-Smriti AI Service
echo ========================================================
echo Starting eRTMAC-Smriti AI Microservice on http://localhost:8000
echo ========================================================
cd /d "%~dp0ai_service"
call .venv\Scripts\activate.bat
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
