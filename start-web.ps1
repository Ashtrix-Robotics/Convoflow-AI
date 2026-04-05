# start-web.ps1
# Starts the Convoflow AI web dashboard dev server
# Usage: .\start-web.ps1

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$webDir = Join-Path $projectRoot "web"

if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
    Write-Host "Installing web dependencies..."
    Push-Location $webDir
    npm install --legacy-peer-deps
    Pop-Location
}

Write-Host "Starting Convoflow AI web dashboard on http://localhost:5173 ..."
Write-Host "API proxy → http://localhost:8000  (start backend first with .\start-backend.ps1)"
Push-Location $webDir
npm run dev
Pop-Location
