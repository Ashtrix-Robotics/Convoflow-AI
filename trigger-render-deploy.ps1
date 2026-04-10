#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Manually trigger a Render deploy using the Deploy Hook URL.

.DESCRIPTION
    Since Render auto-deploy appears to be broken, use this script to
    manually trigger a deployment. You need the Deploy Hook URL from:
    
    Render Dashboard → Services → convoflow-api → Settings → Deploy Hook
    
    Copy the full URL and pass it as a parameter.

.EXAMPLE
    .\trigger-render-deploy.ps1 -DeployHookUrl "https://api.render.com/deploy/srv-xxx?key=yyy"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$DeployHookUrl
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Triggering Render Deploy ===" -ForegroundColor Cyan
Write-Host ""

# Trigger the deploy
Write-Host "[1/3] Triggering deploy..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri $DeployHookUrl -Method Post -TimeoutSec 30
    Write-Host "  Deploy triggered successfully!" -ForegroundColor Green
    Write-Host "  Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "  Error triggering deploy: $_" -ForegroundColor Red
    exit 1
}

# Wait and poll health endpoint
Write-Host ""
Write-Host "[2/3] Waiting for deploy to complete (this may take 5-10 min on free tier)..." -ForegroundColor Yellow

$healthUrl = "https://convoflow-api.onrender.com/health"
$maxAttempts = 60
$targetVersion = "3"

for ($i = 1; $i -le $maxAttempts; $i++) {
    try {
        $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 10
        $version = $health.version
        Write-Host "  Attempt $i/$maxAttempts`: version=$version" -ForegroundColor Gray
        
        if ($version -eq $targetVersion) {
            Write-Host ""
            Write-Host "  Deploy successful! Version $version is live." -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "  Attempt $i/$maxAttempts`: server not ready..." -ForegroundColor Gray
    }
    Start-Sleep -Seconds 10
}

# Verify security
Write-Host ""
Write-Host "[3/3] Verifying security..." -ForegroundColor Yellow

# Test unauthenticated access to /agents/
try {
    $agentsResponse = Invoke-WebRequest -Uri "https://convoflow-api.onrender.com/agents/" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "  FAIL: /agents/ accessible without auth (HTTP $($agentsResponse.StatusCode))!" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "  OK:   /agents/ properly returns 401 without auth" -ForegroundColor Green
    } else {
        Write-Host "  WARN: /agents/ returned HTTP $statusCode" -ForegroundColor Yellow
    }
}

# Test authenticated access
try {
    $loginBody = "username=admin@convoflow.ai&password=Admin@123"
    $loginResponse = Invoke-RestMethod -Uri "https://convoflow-api.onrender.com/auth/login" -Method Post -Body $loginBody -ContentType "application/x-www-form-urlencoded" -TimeoutSec 10
    $token = $loginResponse.access_token
    
    $headers = @{ Authorization = "Bearer $token" }
    
    # Test worksheets
    $ws = Invoke-RestMethod -Uri "https://convoflow-api.onrender.com/admin/sheets/worksheets" -Headers $headers -TimeoutSec 10
    Write-Host "  OK:   /admin/sheets/worksheets -> $($ws.worksheets -join ', ')" -ForegroundColor Green
    
    # Test purge (just check it doesn't 404)
    $purge = Invoke-RestMethod -Uri "https://convoflow-api.onrender.com/admin/leads/purge" -Method Delete -Headers $headers -TimeoutSec 10
    Write-Host "  OK:   /admin/leads/purge -> deleted=$($purge.deleted)" -ForegroundColor Green
    
} catch {
    Write-Host "  Error during authenticated tests: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Deploy Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Add this Deploy Hook URL as a GitHub Secret:" -ForegroundColor White
Write-Host "     Settings → Secrets → New → RENDER_DEPLOY_HOOK" -ForegroundColor Gray
Write-Host "  2. Future pushes to 'main' will auto-deploy via GitHub Actions" -ForegroundColor White
Write-Host ""
