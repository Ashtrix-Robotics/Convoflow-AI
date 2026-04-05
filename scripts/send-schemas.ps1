$webhookUrl = "https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjcwNTZmMDYzMTA0MzE1MjZlNTUzNjUxMzQi_pc"

$schemas = @(
    @{
        event = "lead.callback_scheduled"
        body = '{"event":"lead.callback_scheduled","data":{"name":"Sunita Rao","phone":"+91 91234 56789","email":"sunita@test.com","intent_category":"callback_scheduled","interest_level":"medium","course_interested_in":"Robotics","agent_name":"Raj","sentiment":"neutral","summary":"Wants callback Thursday 10am","next_action":"Schedule calendar event","payment_ready":false,"callback_time":"2025-07-03T10:00:00"}}'
    },
    @{
        event = "lead.not_interested"
        body = '{"event":"lead.not_interested","data":{"name":"Mohan Das","phone":"+91 88888 77777","email":"mohan@test.com","intent_category":"not_interested","interest_level":"low","course_interested_in":"STEM","agent_name":"Priya","sentiment":"negative","summary":"Budget constraint cited","next_action":"Tag in CRM as not interested","payment_ready":false,"reason":"too_expensive"}}'
    },
    @{
        event = "lead.future_planning"
        body = '{"event":"lead.future_planning","data":{"name":"Kavitha Nair","phone":"+91 77777 66666","email":"kavitha@test.com","intent_category":"future_planning","interest_level":"medium","course_interested_in":"AI Bootcamp","agent_name":"Arun","sentiment":"positive","summary":"Interested but batch starts in 3 months","next_action":"Add to nurture sequence","payment_ready":false,"follow_up_date":"2025-09-01"}}'
    }
)

foreach ($s in $schemas) {
    Write-Host "Sending $($s.event)..."
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri $webhookUrl -Method POST -ContentType "application/json" -Body $s.body -TimeoutSec 10
        Write-Host "  OK: $($r.Content)"
    } catch {
        Write-Host "  ERR: $_"
    }
    Start-Sleep -Milliseconds 500
}
Write-Host "All schemas sent!"
