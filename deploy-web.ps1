# deploy-web.ps1
# Re-deploys the Convoflow AI web dashboard to Vercel production.
# Always deploys to the 'convoflow-web' project (ashtrix/convoflow-web).
# Usage: .\deploy-web.ps1

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$webDir = Join-Path $projectRoot "web"

Write-Host "Building & deploying Convoflow AI web dashboard to Vercel..."
Push-Location $webDir
$env:VERCEL_ORG_ID = "team_5DFCjy6cGDgOt6V3nqdFLtDI"
$env:VERCEL_PROJECT_ID = "prj_5RLQkJkv5MxcJbfXoLuuAsVIEb48"
npx vercel deploy --prod --yes
Pop-Location
