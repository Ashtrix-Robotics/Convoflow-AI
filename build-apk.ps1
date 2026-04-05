# build-apk.ps1
# Builds a shareable Android APK using EAS Build (no Android Studio needed).
# The APK is built on Expo's cloud servers and a download link is provided.
#
# Usage:
#   .\build-apk.ps1              # builds "preview" APK (for sales team)
#   .\build-apk.ps1 -Profile dev # builds "development" APK (for testing with Metro)
#
# Requirements:
#   - Expo account: https://expo.dev (free)
#   - Run `npx eas-cli login` once before first build
#
# Build profiles (defined in mobile/eas.json):
#   preview     → Standalone APK, hits production API on Render. Share with sales team.
#   development → APK with DevMenu, hits local PC API. For developers only.
#   production  → AAB for Google Play Store.

param(
    [string]$Profile = "preview"
)

$mobileDir = Join-Path $PSScriptRoot "mobile"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Convoflow AI — EAS Build" -ForegroundColor Cyan
Write-Host "  Profile: $Profile" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This build runs on Expo's cloud servers."
Write-Host "You'll get a download link when it's done (~10 minutes)."
Write-Host ""

if ($Profile -eq "development") {
    Write-Host "NOTE: Dev build connects to http://192.168.31.173:8000" -ForegroundColor Yellow
    Write-Host "      Make sure your backend is running before installing this APK." -ForegroundColor Yellow
    Write-Host ""
}

if ($Profile -eq "preview" -or $Profile -eq "production") {
    Write-Host "NOTE: This build connects to https://convoflow-api.onrender.com" -ForegroundColor Yellow
    Write-Host "      Make sure your backend is deployed to Render before distributing." -ForegroundColor Yellow
    Write-Host ""
}

Push-Location $mobileDir

# Check if logged in to EAS
$whoami = npx eas-cli whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "You need to log in to Expo first:" -ForegroundColor Red
    Write-Host "  npx eas-cli login" -ForegroundColor White
    Pop-Location
    exit 1
}

Write-Host "Building as: $whoami" -ForegroundColor Green
Write-Host ""

npx eas-cli build --platform android --profile $Profile --non-interactive

Pop-Location
