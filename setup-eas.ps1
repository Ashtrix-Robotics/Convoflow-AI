# setup-eas.ps1
# One-time setup: links this project to your Expo account for EAS builds.
# Run this ONCE before your first build.
#
# Steps it performs:
#   1. Installs eas-cli locally
#   2. Logs you in to Expo (opens browser)
#   3. Initializes EAS project (creates project on your Expo account)
#   4. Updates app.json with the real EAS project ID

$mobileDir = Join-Path $PSScriptRoot "mobile"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Convoflow AI — EAS First-Time Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: You need a FREE Expo account."
Write-Host "        Create one at: https://expo.dev/signup (takes 30 seconds)"
Write-Host ""
Read-Host "Press Enter when you have an Expo account to continue"

Push-Location $mobileDir

Write-Host ""
Write-Host "Step 2: Logging in to Expo..." -ForegroundColor Green
npx eas-cli login

Write-Host ""
Write-Host "Step 3: Initializing EAS project (links this codebase to your Expo account)..." -ForegroundColor Green
npx eas-cli init --id convoflow-ai

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "To build the APK for your sales team, run:"
Write-Host "  .\build-apk.ps1" -ForegroundColor White
Write-Host ""
Write-Host "This will take ~10 minutes on Expo's cloud servers."
Write-Host "You'll get a download link to share with your sales team."
Write-Host ""

Pop-Location
