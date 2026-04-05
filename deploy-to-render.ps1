#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Push to GitHub and deploy backend to Render (one-time setup).

.DESCRIPTION
    Run this script ONCE to:
      1. Create a GitHub repo for this codebase
      2. Push the committed codebase to GitHub
      3. Set VITE_API_URL in Vercel pointing to Render
      4. Redeploy the Vercel web dashboard

    Prerequisites:
      - GitHub CLI (gh) installed and authenticated: gh auth login
      - Vercel CLI installed: npm install -g vercel

.EXAMPLE
    # Authenticate GitHub first:
    gh auth login

    # Then run this script:
    .\deploy-to-render.ps1

    # After deployment, complete these manual steps in the Render Dashboard:
    # 1. New → Blueprint Instance → connect this GitHub repo
    # 2. Set all env vars from render-env-reference.txt
#>

param(
    [string]$GithubOrg    = "Ashtrix-Robotics",
    [string]$GithubRepo   = "convoflow-ai",
    [string]$RenderUrl    = "https://convoflow-api.onrender.com"
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot

Write-Host ""
Write-Host "=== Convoflow AI — GitHub + Vercel Deploy ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Push to GitHub ────────────────────────────────────────────────────
Write-Host "[1/4] Creating GitHub repo and pushing code..." -ForegroundColor Yellow

# Check gh auth
$ghStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Not authenticated with GitHub CLI." -ForegroundColor Red
    Write-Host "  Run: gh auth login" -ForegroundColor Red
    exit 1
}

# Create repo (private, skip README since we already have one)
$repoExists = gh repo view "$GithubOrg/$GithubRepo" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Repo $GithubOrg/$GithubRepo already exists, skipping create."
} else {
    gh repo create "$GithubOrg/$GithubRepo" --private --description "Convoflow AI - Sales Call Intelligence Platform"
    Write-Host "  PASS  Created: github.com/$GithubOrg/$GithubRepo" -ForegroundColor Green
}

# Set remote and push
$remoteUrl = "https://github.com/$GithubOrg/$GithubRepo.git"
git remote remove origin 2>$null
git remote add origin $remoteUrl
git push -u origin main --force-with-lease
Write-Host "  PASS  Code pushed to GitHub" -ForegroundColor Green

# ── Step 2: Print Render deploy instructions ──────────────────────────────────
Write-Host ""
Write-Host "[2/4] Render Blueprint Setup (manual — 2 minutes)" -ForegroundColor Yellow
Write-Host "  1. Go to: https://dashboard.render.com" -ForegroundColor White
Write-Host "  2. Open 'Ashtrix' workspace" -ForegroundColor White
Write-Host "  3. Settings → GitHub → Install Render App on '$GithubOrg' org" -ForegroundColor White
Write-Host "  4. New + → Blueprint Instance → select '$GithubOrg/$GithubRepo'" -ForegroundColor White
Write-Host "  5. Render reads render.yaml → creates 'convoflow-api' service" -ForegroundColor White
Write-Host "  6. Fill in the 'sync: false' env vars (see render-env-reference.txt)" -ForegroundColor White
Write-Host ""
Write-Host "  Once deployed, the service will be at: $RenderUrl" -ForegroundColor Cyan
Write-Host ""

$ready = Read-Host "  Press ENTER once 'convoflow-api' shows 'Live' in Render Dashboard..."

# ── Step 3: Verify Render is live ─────────────────────────────────────────────
Write-Host "[3/4] Verifying Render service..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$RenderUrl/health" -TimeoutSec 15
    if ($health.status -eq "ok") {
        Write-Host "  PASS  $RenderUrl/health → $($health.status) ($($health.service))" -ForegroundColor Green
    } else {
        Write-Host "  WARN  Unexpected health response: $($health | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  FAIL  Cannot reach $RenderUrl — check Render logs" -ForegroundColor Red
    Write-Host "  Hint: Free tier has a cold start (~30s). Try again in 1 minute." -ForegroundColor Yellow
    exit 1
}

# ── Step 4: Set Vercel env var and redeploy ───────────────────────────────────
Write-Host "[4/4] Redeploying Vercel web dashboard..." -ForegroundColor Yellow
Push-Location "$RepoRoot\web"
try {
    # Set VITE_API_URL to Render backend (vercel.json already has the rewrite)
    Write-Host "  Setting VITE_API_URL in Vercel..." -ForegroundColor Gray
    echo $RenderUrl | npx vercel env add VITE_API_URL production --force 2>$null
    npx vercel --prod --yes
    Write-Host "  PASS  Web dashboard redeployed" -ForegroundColor Green
} catch {
    Write-Host "  WARN  Vercel deploy failed: $_" -ForegroundColor Yellow
    Write-Host "  Manual: cd web && npx vercel --prod" -ForegroundColor Yellow
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "  Backend:   $RenderUrl" -ForegroundColor Cyan
Write-Host "  Database:  Supabase Postgres (aws-0-ap-south-1.pooler.supabase.com)" -ForegroundColor Cyan
Write-Host "  Web:       https://convoflow-web.vercel.app" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Run E2E tests:" -ForegroundColor White
Write-Host "  .venv\Scripts\python.exe tests\e2e_api_test.py $RenderUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "  Terminate EC2 (once satisfied):" -ForegroundColor White
Write-Host "  aws ec2 terminate-instances --instance-ids i-00f742a3b732f3290 --region ap-south-1" -ForegroundColor Gray
Write-Host ""
