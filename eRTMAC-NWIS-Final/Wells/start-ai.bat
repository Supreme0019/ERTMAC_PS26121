@echo off
title eRTMAC-NWIS AI Service
echo Starting eRTMAC Final AI Service on http://localhost:8000...
cd /d "%~dp0..\..\final ai\ai_service"
call .venv\Scripts\activate.bat
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
