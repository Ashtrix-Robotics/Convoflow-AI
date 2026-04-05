# start-backend.ps1
# Starts the Convoflow AI FastAPI backend using the project venv
# Usage: .\start-backend.ps1

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyExe = Join-Path $projectRoot ".venv\Scripts\python.exe"
$backendDir = Join-Path $projectRoot "backend"

if (-not (Test-Path $pyExe)) {
    Write-Error "Python venv not found at $pyExe. Run: python -m venv .venv and pip install -r backend/requirements.txt"
    exit 1
}

$envFile = Join-Path $backendDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Warning "backend/.env not found — copy backend/.env.example and fill in your API keys."
}

Write-Host "Starting Convoflow AI backend on http://localhost:8000 ..."
Push-Location $backendDir
& $pyExe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Pop-Location
