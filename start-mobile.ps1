# start-mobile.ps1
# Starts the Convoflow AI mobile app via Expo
# Usage: .\start-mobile.ps1

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$mobileDir = Join-Path $projectRoot "mobile"

if (-not (Test-Path (Join-Path $mobileDir "node_modules"))) {
    Write-Host "Installing mobile dependencies..."
    Push-Location $mobileDir
    npm install --legacy-peer-deps
    Pop-Location
}

$envFile = Join-Path $mobileDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Warning "mobile/.env not found. Create it with EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:8000"
}

Write-Host "Starting Expo dev server..."
Write-Host "Scan the QR code with Expo Go on your phone."
Push-Location $mobileDir
npx expo start --clear
Pop-Location
