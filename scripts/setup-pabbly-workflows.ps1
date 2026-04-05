# =============================================================================
# setup-pabbly-workflows.ps1
# Automates Pabbly Connect workflow creation via the Pabbly API.
# Run AFTER pasting your pabbly_session cookie when prompted.
# Usage: .\scripts\setup-pabbly-workflows.ps1 -SessionCookie "your_cookie_here"
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$SessionCookie
)

$baseUrl  = "https://connect.pabbly.com"
$headers  = @{
    "Cookie"       = "pabbly_session=$SessionCookie"
    "Content-Type" = "application/json"
    "X-Requested-With" = "XMLHttpRequest"
}

# ---- Read webhook URL from backend/.env ------------------------------------
$envFile = Join-Path $PSScriptRoot "..\backend\.env"
$pabblyUrl = (Get-Content $envFile | Where-Object { $_ -match "^PABBLY_WEBHOOK_URL=" }) `
             -replace "^PABBLY_WEBHOOK_URL=", ""
Write-Host "Webhook URL: $pabblyUrl"

# ---- Helper: send test event -----------------------------------------------
function Send-TestEvent($eventType, $payload) {
    Write-Host "`nFiring test event: $eventType ..."
    $body = @{
        event     = $eventType
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
        data      = $payload
    } | ConvertTo-Json -Depth 5

    $r = Invoke-RestMethod -Uri $pabblyUrl -Method POST `
         -ContentType "application/json" -Body $body
    Write-Host "  -> $($r.status): $($r.message)"
}

# ---- Fire all event types so Pabbly captures every schema ------------------
$baseLeadData = @{
    call_id              = "demo-call-001"
    lead_id              = "demo-lead-001"
    name                 = "Ramesh Kumar"
    phone                = "+91 98765 43210"
    email                = "ramesh@example.com"
    source_campaign      = "Summer Camp 2026"
    course_interested_in = "Summer STEM Camp"
    agent_name           = "Priya"
    agent_email          = "priya@convoflow.ai"
    summary              = "Parent showed strong interest and asked about fees and batch schedule."
    next_action          = "Send course brochure and fee structure"
    sentiment            = "positive"
    payment_link_url     = $null
}

Send-TestEvent "call.analyzed"          ($baseLeadData + @{ intent_category="interested"; interest_level="high"; action_items=@("Send brochure","Call back tomorrow") })
Send-TestEvent "lead.interested"        ($baseLeadData + @{ intent_category="interested"; interest_level="high"; payment_ready=$false })
Send-TestEvent "lead.callback_scheduled" ($baseLeadData + @{ intent_category="callback_requested"; callback_time="2026-04-05T10:00:00" })
Send-TestEvent "lead.not_interested"    ($baseLeadData + @{ intent_category="not_interested"; interest_level="none"; objections=@("Too expensive","No time") })
Send-TestEvent "lead.future_planning"   ($baseLeadData + @{ intent_category="future_planning"; interest_level="medium"; callback_time="2026-06-01T00:00:00" })

Write-Host "`nAll 5 event schemas sent to Pabbly. Open your workflow and proceed with Path Router setup."
