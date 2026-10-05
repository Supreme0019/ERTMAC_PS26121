Write-Host "Starting Final AI Service on http://localhost:8000..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\..\..\final ai\ai_service"
& ".\.venv\Scripts\Activate.ps1"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
