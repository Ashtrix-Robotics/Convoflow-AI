# ConvoFlow AI — E2E Test Script
$BASE = if ($args[0]) { $args[0] } else { "https://convoflow-api.onrender.com" }
$pass = 0; $fail = 0

function Test-API {
    param($Name, $Method, $Uri, $Body, $ContentType, $Token, $ExpectStatus)
    try {
        $headers = @{}
        if ($Token) { $headers["Authorization"] = "Bearer $Token" }
        $params = @{ Uri = $Uri; Method = $Method; UseBasicParsing = $true; Headers = $headers }
        if ($Body) { $params["Body"] = $Body; $params["ContentType"] = $ContentType }
        $r = Invoke-WebRequest @params -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq $ExpectStatus) {
            Write-Host "  PASS  $Name ($($r.StatusCode))" -ForegroundColor Green
            $script:pass++
            return $r.Content
        } else {
            Write-Host "  FAIL  $Name (expected $ExpectStatus, got $($r.StatusCode))" -ForegroundColor Red
            $script:fail++
            return $null
        }
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq $ExpectStatus) {
            Write-Host "  PASS  $Name ($status)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "  FAIL  $Name - $($_.Exception.Message)" -ForegroundColor Red
            $script:fail++
        }
        return $null
    }
}

Write-Host ""
Write-Host "=== ConvoFlow AI E2E Test Suite ===" -ForegroundColor Cyan
Write-Host ""

# ── T01: Health ──────────────────────────────────────────────────────────────
$r = Test-API "T01 Health" GET "$BASE/health" -ExpectStatus 200
Write-Host "       $r"

# ── T02: Admin Login ─────────────────────────────────────────────────────────
$r = Test-API "T02 Admin Login" POST "$BASE/auth/login" "username=admin@convoflow.ai&password=ConvoFlow@123" "application/x-www-form-urlencoded" -ExpectStatus 200
$adminToken = ($r | ConvertFrom-Json).access_token
Write-Host "       Token: $($adminToken.Substring(0,25))..."

# ── T03: Agent Login ─────────────────────────────────────────────────────────
$r = Test-API "T03 Agent Login" POST "$BASE/auth/login" "username=agent@convoflow.ai&password=Agent@123" "application/x-www-form-urlencoded" -ExpectStatus 200
$agentToken = ($r | ConvertFrom-Json).access_token
Write-Host "       Agent token: $($agentToken.Substring(0,25))..."

# ── T04: Auth/Me (admin) ─────────────────────────────────────────────────────
$r = Test-API "T04 Auth/Me" GET "$BASE/auth/me" -Token $adminToken -ExpectStatus 200
$me = $r | ConvertFrom-Json
Write-Host "       Name: $($me.name) | Email: $($me.email)"

# ── T05: List Calls ───────────────────────────────────────────────────────────
$r = Test-API "T05 List Calls" GET "$BASE/calls" -Token $adminToken -ExpectStatus 200
Write-Host "       Calls: $($r)"

# ── T06: List Leads ───────────────────────────────────────────────────────────
$r = Test-API "T06 List Leads" GET "$BASE/leads" -Token $adminToken -ExpectStatus 200
$leads = $r | ConvertFrom-Json
Write-Host "       Lead count: $($leads.Count)"

# ── T07: Analytics Overview ──────────────────────────────────────────────────
$r = Test-API "T07 Analytics" GET "$BASE/analytics/overview" -Token $adminToken -ExpectStatus 200
$an = $r | ConvertFrom-Json
Write-Host "       Total leads: $($an.total_leads) | Conversion rate: $($an.conversion_rate)"

# ── T08: Create Lead ─────────────────────────────────────────────────────────
$leadBody = '{"name":"E2E Test Lead","phone":"9876543210","source":"inbound","campaign":"test-campaign","intent":"high"}'
$r = Test-API "T08 Create Lead" POST "$BASE/leads/inbound" $leadBody "application/json" $adminToken -ExpectStatus 201
$leadId = ($r | ConvertFrom-Json).id
Write-Host "       Lead ID: $leadId"

# ── T09: Get Lead By ID ──────────────────────────────────────────────────────
$r = Test-API "T09 Get Lead" GET "$BASE/leads/$leadId" -Token $adminToken -ExpectStatus 200
$lead = $r | ConvertFrom-Json
Write-Host "       Lead: $($lead.name) | Status: $($lead.status)"

# ── T10: Update Lead Status ──────────────────────────────────────────────────
$r = Test-API "T10 Update Lead" PATCH "$BASE/leads/$leadId" '{"status":"qualified"}' "application/json" $adminToken -ExpectStatus 200
$updated = $r | ConvertFrom-Json
Write-Host "       Updated status: $($updated.status)"

# ── T11: Web App HTML ────────────────────────────────────────────────────────
$r = Test-API "T11 Web App" GET "https://convoflow-web.vercel.app" -ExpectStatus 200
$hasTitle = $r -match "Convoflow AI"
Write-Host "       Has title: $hasTitle"

# ── T12: Web Login Page ──────────────────────────────────────────────────────
$r = Test-API "T12 Web Login" GET "https://convoflow-web.vercel.app/login" -ExpectStatus 200
$hasCss = $r -match '\.css'
Write-Host "       Has CSS: $hasCss"

# ── T13: Invalid Auth Rejected ───────────────────────────────────────────────
$r = Test-API "T13 Bad Auth" POST "$BASE/auth/login" "username=bad@test.com&password=wrong" "application/x-www-form-urlencoded" -ExpectStatus 401
Write-Host "       Bad credentials properly rejected"

# ── T14: Supabase Storage (with service key) ─────────────────────────────────
$supabaseUrl = "https://dwswmirwfsqkerybszsg.supabase.co"
$envFile = "e:\Ashtrix\Project Works\Sales-Autotmation\backend\.env"
$serviceKey = ((Get-Content $envFile) -match "^SUPABASE_SERVICE_KEY=") -replace "^SUPABASE_SERVICE_KEY=",""
$r14status = 0
try {
    $r14 = Invoke-WebRequest -Uri "$supabaseUrl/storage/v1/bucket" -Headers @{apikey=$serviceKey; Authorization="Bearer $serviceKey"} -UseBasicParsing -ErrorAction Stop
    $allBuckets = $r14.Content | ConvertFrom-Json
    $matchBucket = @($allBuckets | Where-Object { $_.name -eq "recordings" })
    if ($matchBucket.Count -gt 0) {
        Write-Host "  PASS  T14 Supabase Storage ($r14status)" -ForegroundColor Green; $pass++
        Write-Host "       Recordings bucket confirmed"
    } else {
        Write-Host "  FAIL  T14 Supabase Storage - recordings bucket missing" -ForegroundColor Red; $fail++
    }
} catch {
    Write-Host "  FAIL  T14 Supabase Storage - $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# ── T15: Protected Route (no token) ─────────────────────────────────────────
$r = Test-API "T15 Protected Route" GET "$BASE/calls" -ExpectStatus 401
Write-Host "       Unauthenticated access blocked"

# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Results: $pass passed | $fail failed ===" -ForegroundColor $(if ($fail -eq 0) {"Green"} else {"Yellow"})
Write-Host ""
