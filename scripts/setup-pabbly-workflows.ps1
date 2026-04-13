# =============================================================================
# setup-pabbly-workflows.ps1
# Fires sample events to the Pabbly webhook URL so Pabbly captures every
# event schema — run this AFTER creating a fresh "Webhook by Pabbly" trigger
# and updating PABBLY_WEBHOOK_URL in backend/.env.
#
# Usage: .\scripts\setup-pabbly-workflows.ps1
# =============================================================================

# ---- Read webhook URL from backend/.env ------------------------------------
$envFile = Join-Path $PSScriptRoot "..\backend\.env"
$pabblyUrl = (Get-Content $envFile | Where-Object { $_ -match "^PABBLY_WEBHOOK_URL=" }) `
             -replace "^PABBLY_WEBHOOK_URL=", ""

if (-not $pabblyUrl -or $pabblyUrl -like "*YOUR_WEBHOOK*") {
    Write-Error "PABBLY_WEBHOOK_URL is not set in backend/.env. Create a Pabbly workflow first."
    exit 1
}
Write-Host "Webhook URL: $pabblyUrl"

# ---- Verify the URL is alive before firing all events ----------------------
Write-Host "`nChecking webhook URL is reachable..."
try {
    $pingBody = '{"event":"ping","timestamp":"' + (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") + '","data":{"source":"setup-script"}}'
    $pingResult = Invoke-WebRequest -Uri $pabblyUrl -Method POST -ContentType "application/json" -Body $pingBody -UseBasicParsing
    if ($pingResult.StatusCode -eq 200) {
        Write-Host "  -> OK ($($pingResult.StatusCode)) — webhook is live"
    } else {
        Write-Warning "  -> Unexpected status $($pingResult.StatusCode)"
    }
} catch {
    Write-Error "Webhook URL returned an error: $($_.Exception.Message)"
    Write-Error "Create a new 'Webhook by Pabbly' trigger and update PABBLY_WEBHOOK_URL in backend/.env"
    exit 1
}

# ---- Helper: send test event -----------------------------------------------
function Send-TestEvent($eventType, $payload) {
    Write-Host "`nFiring test event: $eventType ..."
    $body = @{
        event     = $eventType
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
        data      = $payload
    } | ConvertTo-Json -Depth 5

    try {
        $r = Invoke-RestMethod -Uri $pabblyUrl -Method POST -ContentType "application/json" -Body $body
        Write-Host "  -> OK: $($r | ConvertTo-Json -Compress)"
    } catch {
        Write-Warning "  -> FAILED for $eventType : $($_.Exception.Message)"
    }
}

# ---- Base sample data (shared across most events) --------------------------
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

# ---- Fire all 8 event types so Pabbly captures every schema ----------------
# 1. call.analyzed — fired after every AI transcription completes
Send-TestEvent "call.analyzed" ($baseLeadData + @{
    intent_category  = "interested"
    interest_level   = "high"
    intent_confidence = 0.92
    action_items     = @("Send brochure", "Call back tomorrow")
    objections       = "[]"
    payment_ready    = $false
    callback_time    = $null
})

# 2. lead.interested — AI classifies lead as interested
Send-TestEvent "lead.interested" ($baseLeadData + @{
    intent_category = "interested"
    interest_level  = "high"
    payment_ready   = $false
    payment_link_url = "https://pay.example.com/robotics-camp"
})

# 3. lead.callback_scheduled — AI detects callback request
Send-TestEvent "lead.callback_scheduled" ($baseLeadData + @{
    intent_category = "callback_requested"
    callback_time   = "2026-04-20T10:00:00"
})

# 4. lead.not_interested — lead opts out or is cold
Send-TestEvent "lead.not_interested" ($baseLeadData + @{
    intent_category = "not_interested"
    interest_level  = "none"
    objections      = '["Too expensive","No time"]'
})

# 5. lead.future_planning — interested but wants next batch
Send-TestEvent "lead.future_planning" ($baseLeadData + @{
    intent_category = "future_planning"
    interest_level  = "medium"
    callback_time   = "2026-06-01T00:00:00"
})

# 6. transcription.completed — legacy event (kept for backward compat)
Send-TestEvent "transcription.completed" ($baseLeadData + @{
    status      = "completed"
    duration_s  = 180
    transcript  = "Sample transcript text"
})

# 7. followup.scheduled — agent creates a manual follow-up
Send-TestEvent "followup.scheduled" ($baseLeadData + @{
    followup_id  = "demo-followup-001"
    followup_due = "2026-04-21T09:00:00"
    followup_note = "Call parent to confirm batch registration"
})

# 8. class.schedule_shared — agent clicks 'Share Schedule' in lead detail
#    Used by Pabbly to send WhatsApp message with class details to parent
#    NOTE: field names match classes.py share_schedule() payload exactly
Send-TestEvent "class.schedule_shared" @{
    lead_id         = "demo-lead-001"
    lead_name       = "Ramesh Kumar"
    lead_phone      = "+91 98765 43210"
    lead_email      = "ramesh@example.com"
    center_name     = "Velachery"
    center_address  = "45 Anna Salai, Velachery, Chennai 600042"
    center_map_url  = "https://maps.google.com/?q=Velachery+Chennai"
    batch_id        = "demo-batch-001"
    batch_label     = "Batch 2 — May 5-16"
    start_date      = "2026-05-05"
    end_date        = "2026-05-16"
    time_slot       = "5:30 PM - 6:30 PM"
    mode            = "offline"
    agent_name      = "Priya"
    agent_email     = "priya@convoflow.ai"
}

Write-Host "`n============================================================"
Write-Host "All 8 event schemas sent to Pabbly."
Write-Host ""
Write-Host "NEXT STEPS in Pabbly Connect:"
Write-Host "  1. Open the workflow -> click 'Replay' on each captured event"
Write-Host "  2. Add a Path Router after the webhook trigger"
Write-Host "  3. Create paths based on event field: call.analyzed, lead.interested, etc."
Write-Host "  4. For class.schedule_shared: connect to AiSensy / WhatsApp to send batch details"
Write-Host "  5. Save + activate the workflow"
Write-Host "============================================================"
