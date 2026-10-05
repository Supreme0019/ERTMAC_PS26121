Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting eRTMAC-Smriti AI Microservice on http://localhost:8000" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\ai_service"
& ".\.venv\Scripts\Activate.ps1"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
