<#
.SYNOPSIS
    Updates Supabase Auth SMTP settings, email templates, and redirect URLs
    for the Convoflow AI project.

.DESCRIPTION
    Fixes the SMTP username, updates sender name, sets beautiful branded
    email templates for all auth events, and configures redirect URLs.

.NOTES
    Run from project root: .\scripts\update-supabase-email-templates.ps1
    Requires: SUPABASE_ACCESS_TOKEN env var or pass as parameter
#>

param(
    [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN,
    [string]$ProjectRef = "dwswmirwfsqkerybszsg"
)

if (-not $AccessToken) {
    Write-Error "SUPABASE_ACCESS_TOKEN is required. Set it as env var or pass -AccessToken"
    exit 1
}

$headers = @{
    Authorization  = "Bearer $AccessToken"
    "Content-Type" = "application/json"
}

# ─────────────────────────────────────────────────────────────────────
# Shared email wrapper function
# ─────────────────────────────────────────────────────────────────────
function Build-EmailTemplate {
    param(
        [string]$IconEmoji,
        [string]$Heading,
        [string]$BodyHtml,
        [string]$FooterNote = ""
    )

    $footer = ""
    if ($FooterNote) {
        $footer = @"
                <tr>
                  <td style="padding:20px 40px 0;text-align:center;">
                    <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">$FooterNote</p>
                  </td>
                </tr>
"@
    }

    return @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>Convoflow AI</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="max-width:480px;width:100%;">

          <!-- Logo / Brand Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#002147;border-radius:12px;padding:10px 20px;">
                    <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                      <span style="color:#FF6600;">&#9679;</span>&nbsp;Convoflow AI
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

                <!-- Accent Bar -->
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#002147,#FF6600);border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Icon -->
                <tr>
                  <td align="center" style="padding:32px 40px 0;">
                    <div style="width:56px;height:56px;line-height:56px;font-size:28px;text-align:center;background-color:#f1f5f9;border-radius:50%;">$IconEmoji</div>
                  </td>
                </tr>

                <!-- Heading -->
                <tr>
                  <td style="padding:16px 40px 0;text-align:center;">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#002147;line-height:30px;">$Heading</h1>
                  </td>
                </tr>

                <!-- Body Content -->
                <tr>
                  <td style="padding:16px 40px 32px;">
                    $BodyHtml
                  </td>
                </tr>

                $footer

                <!-- Divider -->
                <tr>
                  <td style="padding:0 40px;">
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"/>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:20px 40px 24px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
                      &copy; 2026 Convoflow AI &mdash; Sales Intelligence Platform
                    </p>
                    <p style="margin:0;font-size:11px;color:#cbd5e1;">
                      Powered by <a href="https://ashtrix.in" style="color:#FF6600;text-decoration:none;">Ashtrix</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Sub-footer -->
          <tr>
            <td align="center" style="padding:20px 0 0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                This is an automated message. Please do not reply directly.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"@
}

# ─────────────────────────────────────────────────────────────────────
# Build all email templates
# ─────────────────────────────────────────────────────────────────────

Write-Host "`n[1/4] Building email templates..." -ForegroundColor Cyan

# --- Signup Confirmation ---
$confirmationBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      Welcome aboard! Please verify your email address to activate your Convoflow AI account.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0 16px;">
                          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#FF6600;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.3px;">
                            Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;text-align:center;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:4px 0 0;font-size:12px;line-height:18px;color:#FF6600;word-break:break-all;text-align:center;">
                      {{ .ConfirmationURL }}
                    </p>
"@
$confirmationTemplate = Build-EmailTemplate -IconEmoji "&#9989;" -Heading "Verify Your Email" -BodyHtml $confirmationBody -FooterNote "This link expires in 1 hour. If you didn't create this account, you can safely ignore this email."

# --- Password Recovery ---
$recoveryBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      We received a request to reset the password for your account. Click the button below to choose a new password.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0 16px;">
                          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#FF6600;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.3px;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;text-align:center;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:4px 0 0;font-size:12px;line-height:18px;color:#FF6600;word-break:break-all;text-align:center;">
                      {{ .ConfirmationURL }}
                    </p>
"@
$recoveryTemplate = Build-EmailTemplate -IconEmoji "&#128274;" -Heading "Reset Your Password" -BodyHtml $recoveryBody -FooterNote "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email."

# --- Invite ---
$inviteBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      You've been invited to join <strong style="color:#002147;">Convoflow AI</strong> &#8212; the sales intelligence platform that helps your team close more deals.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0 16px;">
                          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#FF6600;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.3px;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;text-align:center;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:4px 0 0;font-size:12px;line-height:18px;color:#FF6600;word-break:break-all;text-align:center;">
                      {{ .ConfirmationURL }}
                    </p>
"@
$inviteTemplate = Build-EmailTemplate -IconEmoji "&#127881;" -Heading "You're Invited!" -BodyHtml $inviteBody -FooterNote "This invitation expires in 24 hours."

# --- Magic Link ---
$magicLinkBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      Click the button below to securely sign in to your Convoflow AI dashboard. No password needed.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0 16px;">
                          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#FF6600;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.3px;">
                            Sign In to Dashboard
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;text-align:center;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:4px 0 0;font-size:12px;line-height:18px;color:#FF6600;word-break:break-all;text-align:center;">
                      {{ .ConfirmationURL }}
                    </p>
"@
$magicLinkTemplate = Build-EmailTemplate -IconEmoji "&#10024;" -Heading "Your Magic Link" -BodyHtml $magicLinkBody -FooterNote "This link expires in 1 hour and can only be used once. If you didn't request this, ignore this email."

# --- Email Change ---
$emailChangeBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      Please confirm the update of your email address from <strong style="color:#002147;">{{ .Email }}</strong> to <strong style="color:#002147;">{{ .NewEmail }}</strong>.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0 16px;">
                          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#FF6600;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.3px;">
                            Confirm Email Change
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;text-align:center;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:4px 0 0;font-size:12px;line-height:18px;color:#FF6600;word-break:break-all;text-align:center;">
                      {{ .ConfirmationURL }}
                    </p>
"@
$emailChangeTemplate = Build-EmailTemplate -IconEmoji "&#9993;" -Heading "Confirm Email Change" -BodyHtml $emailChangeBody -FooterNote "If you didn't request this change, please contact support immediately."

# --- Reauthentication ---
$reauthBody = @"
                    <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      Enter the following verification code to confirm your identity:
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:0 0 20px;">
                          <div style="display:inline-block;background-color:#f1f5f9;border:2px solid #e2e8f0;border-radius:12px;padding:16px 40px;">
                            <p style="margin:0;font-size:32px;font-weight:700;color:#002147;letter-spacing:8px;font-family:'Courier New',monospace;">{{ .Token }}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;text-align:center;">
                      This code is valid for a limited time. Do not share it with anyone.
                    </p>
"@
$reauthTemplate = Build-EmailTemplate -IconEmoji "&#128272;" -Heading "Confirm Your Identity" -BodyHtml $reauthBody -FooterNote "If you didn't initiate this request, your account may be compromised. Please change your password immediately."

# --- Password Changed Notification ---
$pwdChangedBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      The password for your account <strong style="color:#002147;">{{ .Email }}</strong> has been successfully changed.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <div style="display:inline-block;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 24px;">
                            <p style="margin:0;font-size:14px;color:#16a34a;font-weight:600;">&#9989; Password updated successfully</p>
                          </div>
                        </td>
                      </tr>
                    </table>
"@
$pwdChangedTemplate = Build-EmailTemplate -IconEmoji "&#128275;" -Heading "Password Changed" -BodyHtml $pwdChangedBody -FooterNote "If you did not make this change, please reset your password immediately and contact support."

# --- Email Changed Notification ---
$emailChangedBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      The email address for your Convoflow AI account has been changed from <strong style="color:#002147;">{{ .OldEmail }}</strong> to <strong style="color:#002147;">{{ .Email }}</strong>.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <div style="display:inline-block;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 24px;">
                            <p style="margin:0;font-size:14px;color:#16a34a;font-weight:600;">&#9989; Email address updated</p>
                          </div>
                        </td>
                      </tr>
                    </table>
"@
$emailChangedTemplate = Build-EmailTemplate -IconEmoji "&#9993;" -Heading "Email Address Changed" -BodyHtml $emailChangedBody -FooterNote "If you did not make this change, please contact support immediately."

# --- Phone Changed Notification ---
$phoneChangedBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      The phone number for your account <strong style="color:#002147;">{{ .Email }}</strong> has been changed from <strong>{{ .OldPhone }}</strong> to <strong>{{ .Phone }}</strong>.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <div style="display:inline-block;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 24px;">
                            <p style="margin:0;font-size:14px;color:#16a34a;font-weight:600;">&#9989; Phone number updated</p>
                          </div>
                        </td>
                      </tr>
                    </table>
"@
$phoneChangedTemplate = Build-EmailTemplate -IconEmoji "&#128241;" -Heading "Phone Number Changed" -BodyHtml $phoneChangedBody -FooterNote "If you did not make this change, please contact support immediately."

# --- MFA Factor Enrolled Notification ---
$mfaEnrolledBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      A new multi-factor authentication method (<strong style="color:#002147;">{{ .FactorType }}</strong>) has been enrolled for your account <strong style="color:#002147;">{{ .Email }}</strong>.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <div style="display:inline-block;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 24px;">
                            <p style="margin:0;font-size:14px;color:#2563eb;font-weight:600;">&#128737; MFA factor added</p>
                          </div>
                        </td>
                      </tr>
                    </table>
"@
$mfaEnrolledTemplate = Build-EmailTemplate -IconEmoji "&#128737;" -Heading "MFA Factor Enrolled" -BodyHtml $mfaEnrolledBody -FooterNote "If you did not make this change, please contact support immediately and review your security settings."

# --- MFA Factor Unenrolled Notification ---
$mfaUnenrolledBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      A multi-factor authentication method (<strong style="color:#002147;">{{ .FactorType }}</strong>) has been removed from your account <strong style="color:#002147;">{{ .Email }}</strong>.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <div style="display:inline-block;background-color:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 24px;">
                            <p style="margin:0;font-size:14px;color:#d97706;font-weight:600;">&#9888; MFA factor removed</p>
                          </div>
                        </td>
                      </tr>
                    </table>
"@
$mfaUnenrolledTemplate = Build-EmailTemplate -IconEmoji "&#128737;" -Heading "MFA Factor Removed" -BodyHtml $mfaUnenrolledBody -FooterNote "If you did not make this change, please contact support immediately."

# --- Identity Linked Notification ---
$identityLinkedBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      A new identity (<strong style="color:#002147;">{{ .Provider }}</strong>) has been linked to your account <strong style="color:#002147;">{{ .Email }}</strong>.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <div style="display:inline-block;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 24px;">
                            <p style="margin:0;font-size:14px;color:#16a34a;font-weight:600;">&#128279; Identity linked</p>
                          </div>
                        </td>
                      </tr>
                    </table>
"@
$identityLinkedTemplate = Build-EmailTemplate -IconEmoji "&#128279;" -Heading "New Identity Linked" -BodyHtml $identityLinkedBody -FooterNote "If you did not make this change, please contact support immediately."

# --- Identity Unlinked Notification ---
$identityUnlinkedBody = @"
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;text-align:center;">
                      An identity (<strong style="color:#002147;">{{ .Provider }}</strong>) has been unlinked from your account <strong style="color:#002147;">{{ .Email }}</strong>.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <div style="display:inline-block;background-color:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 24px;">
                            <p style="margin:0;font-size:14px;color:#d97706;font-weight:600;">&#9888; Identity unlinked</p>
                          </div>
                        </td>
                      </tr>
                    </table>
"@
$identityUnlinkedTemplate = Build-EmailTemplate -IconEmoji "&#128279;" -Heading "Identity Unlinked" -BodyHtml $identityUnlinkedBody -FooterNote "If you did not make this change, please contact support immediately."


# ─────────────────────────────────────────────────────────────────────
# Build the API payload
# ─────────────────────────────────────────────────────────────────────

Write-Host "[2/4] Building API payload..." -ForegroundColor Cyan

$payload = @{
    # ── SMTP fix ──
    smtp_user                          = "no-reply@ashtrix.in"
    smtp_admin_email                   = "no-reply@ashtrix.in"
    smtp_sender_name                   = "Convoflow AI"

    # ── Redirect URLs ──
    uri_allow_list                     = "https://convoflow.ashtrix.in/**,https://convoflow.ashtrix.in/reset-password,http://localhost:5173/**,http://localhost:5173/reset-password"

    # ── Email subjects ──
    mailer_subjects_confirmation       = "Verify your email - Convoflow AI"
    mailer_subjects_recovery           = "Reset your password - Convoflow AI"
    mailer_subjects_invite             = "You're invited to Convoflow AI"
    mailer_subjects_magic_link         = "Your sign-in link - Convoflow AI"
    mailer_subjects_email_change       = "Confirm your email change - Convoflow AI"
    mailer_subjects_reauthentication   = "Verification code - Convoflow AI"
    mailer_subjects_password_changed_notification  = "Password changed - Convoflow AI"
    mailer_subjects_email_changed_notification     = "Email address changed - Convoflow AI"
    mailer_subjects_phone_changed_notification     = "Phone number changed - Convoflow AI"
    mailer_subjects_mfa_factor_enrolled_notification    = "New MFA factor enrolled - Convoflow AI"
    mailer_subjects_mfa_factor_unenrolled_notification  = "MFA factor removed - Convoflow AI"
    mailer_subjects_identity_linked_notification        = "New identity linked - Convoflow AI"
    mailer_subjects_identity_unlinked_notification      = "Identity unlinked - Convoflow AI"

    # ── Email templates ──
    mailer_templates_confirmation_content                = $confirmationTemplate
    mailer_templates_recovery_content                    = $recoveryTemplate
    mailer_templates_invite_content                      = $inviteTemplate
    mailer_templates_magic_link_content                  = $magicLinkTemplate
    mailer_templates_email_change_content                = $emailChangeTemplate
    mailer_templates_reauthentication_content             = $reauthTemplate
    mailer_templates_password_changed_notification_content  = $pwdChangedTemplate
    mailer_templates_email_changed_notification_content     = $emailChangedTemplate
    mailer_templates_phone_changed_notification_content     = $phoneChangedTemplate
    mailer_templates_mfa_factor_enrolled_notification_content    = $mfaEnrolledTemplate
    mailer_templates_mfa_factor_unenrolled_notification_content  = $mfaUnenrolledTemplate
    mailer_templates_identity_linked_notification_content        = $identityLinkedTemplate
    mailer_templates_identity_unlinked_notification_content      = $identityUnlinkedTemplate

    # ── Enable all notification emails ──
    mailer_notifications_password_changed_enabled  = $true
    mailer_notifications_email_changed_enabled     = $true
} | ConvertTo-Json -Depth 5

# ─────────────────────────────────────────────────────────────────────
# Apply via Management API
# ─────────────────────────────────────────────────────────────────────

Write-Host "[3/4] Applying config to Supabase project $ProjectRef..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$ProjectRef/config/auth" `
        -Method PATCH `
        -Headers $headers `
        -Body $payload

    Write-Host "`n[4/4] SUCCESS! All settings applied." -ForegroundColor Green
    Write-Host ""
    Write-Host "  SMTP:" -ForegroundColor White
    Write-Host "    Host:        $($response.smtp_host)" -ForegroundColor Gray
    Write-Host "    Port:        $($response.smtp_port)" -ForegroundColor Gray
    Write-Host "    User:        $($response.smtp_user)" -ForegroundColor Gray
    Write-Host "    From:        $($response.smtp_admin_email)" -ForegroundColor Gray
    Write-Host "    Sender Name: $($response.smtp_sender_name)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Templates Updated:" -ForegroundColor White
    Write-Host "    - Signup confirmation" -ForegroundColor Gray
    Write-Host "    - Password recovery" -ForegroundColor Gray
    Write-Host "    - User invitation" -ForegroundColor Gray
    Write-Host "    - Magic link" -ForegroundColor Gray
    Write-Host "    - Email change" -ForegroundColor Gray
    Write-Host "    - Reauthentication (OTP)" -ForegroundColor Gray
    Write-Host "    - Password changed notification" -ForegroundColor Gray
    Write-Host "    - Email changed notification" -ForegroundColor Gray
    Write-Host "    - Phone changed notification" -ForegroundColor Gray
    Write-Host "    - MFA enrolled notification" -ForegroundColor Gray
    Write-Host "    - MFA unenrolled notification" -ForegroundColor Gray
    Write-Host "    - Identity linked notification" -ForegroundColor Gray
    Write-Host "    - Identity unlinked notification" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Redirect URLs:" -ForegroundColor White
    Write-Host "    $($response.uri_allow_list)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Notifications Enabled:" -ForegroundColor White
    Write-Host "    Password changed: $($response.mailer_notifications_password_changed_enabled)" -ForegroundColor Gray
    Write-Host "    Email changed:    $($response.mailer_notifications_email_changed_enabled)" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Error "Failed to update Supabase auth config:"
    Write-Error $_.Exception.Message
    if ($_.Exception.Response) {
        $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $body = $sr.ReadToEnd()
        Write-Error "Response: $body"
    }
    exit 1
}
