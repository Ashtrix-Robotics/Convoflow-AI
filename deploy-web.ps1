# deploy-web.ps1
# Re-deploys the Convoflow AI web dashboard to Vercel production.
# Usage: .\deploy-web.ps1

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$webDir = Join-Path $projectRoot "web"

Write-Host "Building & deploying Convoflow AI web dashboard to Vercel..."
Push-Location $webDir
npx vercel deploy --prod --yes
Pop-Location
