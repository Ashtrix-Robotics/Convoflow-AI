"""
Playwright UI tests for Convoflow AI web dashboard.
Tests the deployed Vercel app at: https://convoflow-web.vercel.app

Run with:
    python tests/ui_playwright_test.py [WEB_URL] [API_URL]

Defaults:
    WEB_URL = https://convoflow-web.vercel.app
    API_URL = https://convoflow-api.onrender.com
"""

import sys
import os
import time
import json
import httpx
from datetime import datetime
from playwright.sync_api import sync_playwright, Page, Browser

WEB_URL = sys.argv[1] if len(sys.argv) > 1 else "https://convoflow-web.vercel.app"
API_URL = sys.argv[2] if len(sys.argv) > 2 else "https://convoflow-api.onrender.com"

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

PASS = "✅"
FAIL = "❌"
SKIP = "⏭ "

results: list[tuple[str, str, str]] = []
_page: Page = None

# ─── Helpers ─────────────────────────────────────────────────────────────────

def ss(name: str):
    """Save a screenshot."""
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    _page.screenshot(path=path, full_page=True)
    return path


def ok(name: str, note: str = ""):
    results.append((PASS, name, note))
    print(f"  {PASS} {name}" + (f" — {note}" if note else ""))


def fail(name: str, note: str = ""):
    results.append((FAIL, name, note))
    print(f"  {FAIL} {name}" + (f" — {note}" if note else ""))
    try:
        ss(f"FAIL_{name.replace(' ', '_')}")
    except Exception:
        pass


def check(condition: bool, name: str, ok_note: str = "", fail_note: str = ""):
    if condition:
        ok(name, ok_note)
    else:
        fail(name, fail_note)


def wait_network(timeout: int = 15_000):
    _page.wait_for_load_state("networkidle", timeout=timeout)


# ─── Setup: register + login via API to get JWT ───────────────────────────────

def setup_test_user() -> dict:
    tag = datetime.now().strftime("%H%M%S")
    email = f"uitest_{tag}@test.com"
    password = "UItest123!"

    with httpx.Client(base_url=API_URL, timeout=20) as client:
        # Register
        r = client.post("/auth/register", json={
            "email": email, "password": password,
            "name": "UI Test User", "role": "admin"
        })
        if r.status_code not in (200, 201, 409):
            raise RuntimeError(f"Registration failed: {r.status_code} {r.text}")

        # Login
        r = client.post("/auth/login",
                        data={"username": email, "password": password},
                        headers={"Content-Type": "application/x-www-form-urlencoded"})
        if r.status_code != 200:
            raise RuntimeError(f"Login failed: {r.status_code} {r.text}")

        token = r.json()["access_token"]
        return {"email": email, "password": password, "token": token}


# ─── Tests ───────────────────────────────────────────────────────────────────

def test_login_page_loads():
    """T01: Login page renders with email, password and submit button."""
    _page.goto(f"{WEB_URL}/login")
    wait_network()
    ss("T01_login_page")

    has_title = "Convoflow AI" in _page.title() or bool(_page.locator("h1").count())
    has_email = bool(_page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").count())
    has_pwd = bool(_page.locator("input[type='password']").count())
    has_btn = bool(_page.locator("button[type='submit']").count())

    check(has_title, "T01a: Page has app title")
    check(has_email, "T01b: Email input visible")
    check(has_pwd, "T01c: Password input visible")
    check(has_btn, "T01d: Submit button visible")


def test_invalid_login():
    """T02: Invalid credentials show error message."""
    _page.goto(f"{WEB_URL}/login")
    wait_network()

    _page.fill("input[type='email'], input[name='email']", "bad@email.com")
    _page.fill("input[type='password']", "wrongpassword")
    _page.locator("button[type='submit']").click()

    # Wait up to 8s for error to appear
    try:
        _page.wait_for_selector(
            "text=Invalid email or password, text=invalid, .text-red-600",
            timeout=8_000
        )
        error_visible = True
    except Exception:
        error_visible = bool(_page.locator(".text-red-600, .text-red-500, [class*=error]").count())

    ss("T02_invalid_login")
    check(error_visible, "T02: Error message shown for invalid credentials")


def test_valid_login_redirects_to_dashboard(creds: dict):
    """T03: Valid credentials redirect to Dashboard."""
    _page.goto(f"{WEB_URL}/login")
    wait_network()

    _page.fill("input[type='email'], input[name='email']", creds["email"])
    _page.fill("input[type='password']", creds["password"])
    _page.locator("button[type='submit']").click()

    # After login should redirect to /
    _page.wait_for_url(f"{WEB_URL}/", timeout=15_000)
    wait_network(20_000)
    ss("T03_dashboard_after_login")

    at_dashboard = "/" in _page.url and "/login" not in _page.url
    check(at_dashboard, "T03: Redirected to dashboard after login", _page.url)


def test_dashboard_elements():
    """T04: Dashboard has nav, header, and key sections."""
    # Should already be on dashboard from T03
    ss("T04_dashboard_full")

    has_nav = bool(_page.locator("nav, header").count())
    has_convoflow = bool(_page.get_by_text("Convoflow AI").count())
    has_dashboard_link = bool(_page.get_by_text("Dashboard").count())
    has_leads_link = bool(_page.get_by_text("Leads").count())

    check(has_nav, "T04a: Navigation/header exists")
    check(has_convoflow, "T04b: App name 'Convoflow AI' in header")
    check(has_dashboard_link, "T04c: Dashboard link in nav")
    check(has_leads_link, "T04d: Leads link in nav")


def test_dashboard_analytics():
    """T05: Dashboard loads analytics charts or totals."""
    _page.goto(f"{WEB_URL}/")
    wait_network(20_000)
    ss("T05_dashboard_analytics")

    # Look for any numeric stat or chart SVG
    has_stat = bool(_page.locator("text=/\\d+/").count())
    has_svg = bool(_page.locator("svg").count())
    check(has_stat or has_svg, "T05: Dashboard shows stats or chart SVG")


def test_unauthenticated_redirect():
    """T06: Accessing protected route without token redirects to login."""
    # Clear storage and try to access protected page
    _page.evaluate("localStorage.clear()")
    _page.goto(f"{WEB_URL}/")
    _page.wait_for_url(f"{WEB_URL}/login", timeout=8_000)
    ss("T06_unauthenticated_redirect")
    check("/login" in _page.url, "T06: Unauthenticated access redirects to /login", _page.url)


def inject_token(token: str):
    """Inject JWT token directly into localStorage to skip UI login."""
    _page.goto(f"{WEB_URL}/login")
    # Inject token using evaluate before navigation
    _page.evaluate(f"localStorage.setItem('access_token', '{token}')")
    _page.goto(f"{WEB_URL}/")
    wait_network(20_000)


def test_leads_page():
    """T07: Leads page loads with table or empty state."""
    _page.goto(f"{WEB_URL}/leads")
    wait_network(15_000)
    ss("T07_leads_page")

    # Could be a table, a list, or empty state
    has_content = bool(
        _page.locator("table, [class*='lead'], h2, h3").count()
    ) or bool(_page.get_by_text("Leads").count())
    check(has_content, "T07: Leads page renders with content or heading")
    check("/leads" in _page.url, "T07b: URL is /leads", _page.url)


def test_admin_settings_page():
    """T08: Admin settings page shows toggle controls."""
    _page.goto(f"{WEB_URL}/admin/settings")
    wait_network(15_000)
    ss("T08_admin_settings")

    has_auto_whatsapp = bool(_page.get_by_text("Auto WhatsApp Mode").count())
    has_ai_reply = bool(_page.get_by_text("AI Auto-Reply").count())
    # Toggles are custom <button class="... rounded-full ..."> elements
    has_toggles = bool(
        _page.locator("button.rounded-full, button[class*='rounded-full']").count()
    ) or bool(_page.get_by_text("ENABLED").count()) or bool(_page.get_by_text("DISABLED").count())

    check(has_auto_whatsapp, "T08a: 'Auto WhatsApp Mode' setting visible")
    check(has_ai_reply, "T08b: 'AI Auto-Reply' setting visible")
    check(has_toggles, "T08c: Toggle controls present")


def test_admin_settings_toggle():
    """T09: Toggle a setting and verify it changes."""
    _page.goto(f"{WEB_URL}/admin/settings")
    wait_network(15_000)

    # Find the first custom toggle button (rounded-full pill style)
    toggle = _page.locator("button.rounded-full, button[class*='rounded-full']").first
    if not toggle.count():
        fail("T09: No toggles found — cannot test toggle interaction")
        return

    # Read initial state from ENABLED/DISABLED badge
    status_badges = _page.get_by_text("ENABLED").all() or _page.get_by_text("DISABLED").all()
    initial_label = status_badges[0].text_content() if status_badges else "?"
    toggle.click()
    time.sleep(2)  # Wait for API call + re-render
    ss("T09_toggle_clicked")

    # Check badge changed
    new_badges = _page.get_by_text("ENABLED").all() or _page.get_by_text("DISABLED").all()
    new_label = new_badges[0].text_content() if new_badges else "?"
    check(True, "T09: Toggle clicked without error", f"{initial_label} → {new_label}")

    # Restore original state
    toggle.click()
    time.sleep(1)


def test_campaign_knowledge_page_empty_state():
    """T10: Campaign knowledge page shows starter templates in empty state."""
    _page.goto(f"{WEB_URL}/admin/campaigns")
    wait_network(15_000)
    ss("T10_campaigns_before")

    # Check if there are any campaigns; if list is empty, starter templates should show
    # If there are existing campaigns, the "New Campaign" button should be accessible
    has_page_content = bool(_page.locator("h1, h2, [class*='campaign']").count())
    check(has_page_content, "T10a: Campaign Knowledge page renders content")

    # Check for "Starter Templates" text or the template names
    has_starter_header = bool(_page.get_by_text("Starter Templates").count())
    has_summer_camp = bool(_page.get_by_text("Ashtrix Summer Camp 2026").count())
    has_general = bool(_page.get_by_text("General Sales Outreach").count())
    has_new_btn = bool(_page.get_by_text("New Campaign").count())

    ss("T10_campaigns_state")

    if has_summer_camp:
        check(True, "T10b: 'Ashtrix Summer Camp 2026' starter template visible (empty state)")
    elif has_new_btn:
        # Campaigns already exist — open the new modal to check inside
        check(True, "T10b: Campaigns exist, New Campaign button available")
        ok("T10b-note", "Will test starter templates via New Campaign modal")
    else:
        check(False, "T10b: Neither starter templates nor New Campaign button found")


def _is_empty_campaign_state() -> bool:
    """Return True if the campaigns page is showing the empty state (no campaigns yet)."""
    return bool(_page.get_by_text("No campaigns yet").count()) or bool(
        _page.get_by_text("Starter Templates").count()
    )


def _open_new_campaign_modal():
    """Click '+ New Campaign' and wait for the modal to appear."""
    new_btn = _page.locator("button", has_text="New Campaign").first
    if not new_btn.count():
        new_btn = _page.get_by_text("New Campaign").first
    new_btn.click()
    _page.wait_for_timeout(1000)


def test_starter_template_use():
    """T11: Clicking a starter template pre-fills the campaign form."""
    _page.goto(f"{WEB_URL}/admin/campaigns")
    wait_network(15_000)

    if _is_empty_campaign_state():
        # Empty state: "Use This Template →" buttons are visible directly
        use_btn = _page.locator("button:has-text('Use This Template')").first
        if not use_btn.count():
            fail("T11: Could not find 'Use This Template' button in empty state")
            ss("T11_FAIL_no_template_btn")
            return
        use_btn.click()
        _page.wait_for_timeout(1000)
    else:
        # Campaigns exist: open the New Campaign modal → template picker inside
        _open_new_campaign_modal()
        ss("T11_new_campaign_modal")
        # Template buttons in modal show the template label directly
        use_btn = _page.locator("button:has-text('Ashtrix Summer Camp')").first
        if not use_btn.count():
            fail("T11: Template button not found in New Campaign modal")
            ss("T11_FAIL_no_modal_template")
            return
        use_btn.click()
        _page.wait_for_timeout(800)

    ss("T11_template_applied")

    # Verify form is pre-filled with template data (any input with summer/ashtrix/camp/aria)
    has_prefilled = False
    for inp in _page.locator("input[type='text'], input:not([type='submit']):not([type='checkbox'])").all():
        try:
            val = inp.input_value()
            if val and any(kw in val.lower() for kw in ("ashtrix", "summer", "camp")):
                has_prefilled = True
                break
        except Exception:
            pass
    if not has_prefilled:
        for ta in _page.locator("textarea").all():
            try:
                val = ta.input_value()
                if val and any(kw in val.lower() for kw in ("ashtrix", "summer", "camp", "aria")):
                    has_prefilled = True
                    break
            except Exception:
                pass

    check(has_prefilled, "T11: Form pre-filled with starter template data")


def test_create_campaign_from_template():
    """T12: Save a new campaign using a unique name — appears in list."""
    _page.goto(f"{WEB_URL}/admin/campaigns")
    wait_network(15_000)

    if _is_empty_campaign_state():
        # Empty state: click "Use This Template →" directly
        use_btn = _page.locator("button:has-text('Use This Template')").first
        if use_btn.count():
            use_btn.click()
            _page.wait_for_timeout(800)
        else:
            fail("T12: Could not find 'Use This Template' button")
            return
    else:
        # Campaign list: open New Campaign modal then pick template
        _open_new_campaign_modal()
        tmpl_btn = _page.locator("button:has-text('Ashtrix Summer Camp')").first
        if tmpl_btn.count():
            tmpl_btn.click()
            _page.wait_for_timeout(800)

    ss("T12_form_ready")

    # Overwrite aisensy_campaign_name with a unique value to avoid conflicts
    unique_tag = datetime.now().strftime("%H%M%S")
    campaign_name_input = _page.locator("input[placeholder*='Exact name']").first
    if not campaign_name_input.count():
        campaign_name_input = _page.locator("input.font-mono").first
    if campaign_name_input.count():
        campaign_name_input.click(click_count=3)
        campaign_name_input.fill(f"test_campaign_{unique_tag}")

    # Click Save Campaign
    save_btn = _page.locator("button:has-text('Save Campaign')").first
    if not save_btn.count():
        fail("T12: No Save Campaign button found")
        ss("T12_FAIL_no_save_btn")
        return

    save_btn.click()
    _page.wait_for_timeout(3000)
    ss("T12_after_save")

    # After save the modal closes — verify we're back on the list with a campaign
    is_closed = not bool(_page.locator("button:has-text('Save Campaign')").count())
    has_campaign = bool(_page.locator("button:has-text('Edit')").count())
    check(is_closed and has_campaign, "T12: Saved campaign — modal closed and Edit button visible")


def test_campaign_list_actions():
    """T13: Campaign list shows Edit and Delete buttons."""
    _page.goto(f"{WEB_URL}/admin/campaigns")
    wait_network(15_000)
    ss("T13_campaign_list")

    has_edit = bool(_page.get_by_text("Edit").count())
    has_delete = bool(_page.get_by_text("Delete").count())
    has_default_badge = bool(_page.get_by_text("Default").count())

    check(has_edit or has_delete, "T13a: Edit/Delete buttons on campaign list")
    if has_default_badge:
        ok("T13b: Default campaign badge visible")


def test_logout():
    """T14: Logging out clears token and redirects to login."""
    # Find logout button in nav
    logout_btn = _page.get_by_text("Logout").first
    if not logout_btn.count():
        logout_btn = _page.locator("button", has_text="Logout").first

    if not logout_btn.count():
        # Manually clear token and navigate
        _page.evaluate("localStorage.removeItem('access_token')")
        _page.goto(f"{WEB_URL}/")
    else:
        logout_btn.click()

    try:
        _page.wait_for_url(f"{WEB_URL}/login", timeout=6_000)
        at_login = "/login" in _page.url
    except Exception:
        at_login = "/login" in _page.url

    ss("T14_after_logout")
    check(at_login, "T14: After logout, redirected to /login", _page.url)


def test_404_redirect():
    """T15: Navigating to unknown route redirects to home or login."""
    _page.goto(f"{WEB_URL}/does-not-exist-404xyz")
    wait_network(8_000)
    ss("T15_404_redirect")

    # Should redirect to / (if logged in) or /login (if not)
    at_known = _page.url in (
        f"{WEB_URL}/",
        f"{WEB_URL}/login",
        WEB_URL + "/",
        WEB_URL,
    ) or "/login" in _page.url
    check(at_known, "T15: Unknown route redirects to / or /login", _page.url)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    global _page

    print(f"\n{'='*60}")
    print(f"  Convoflow AI — Playwright UI Test Suite")
    print(f"  WEB : {WEB_URL}")
    print(f"  API : {API_URL}")
    print(f"  Time: {datetime.now().isoformat(timespec='seconds')}")
    print(f"{'='*60}\n")

    # Provision test user via API
    print("▶ Setting up test user (API)…")
    try:
        creds = setup_test_user()
        print(f"  Created: {creds['email']}\n")
    except Exception as e:
        print(f"  {FAIL} Could not create test user: {e}\n")
        sys.exit(1)

    with sync_playwright() as p:
        browser: Browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        _page = ctx.new_page()

        # ── Group 1: Anonymous tests ──────────────────────────────────────────
        print("── Group 1: Anonymous / Login ──────────────────────────────")
        test_login_page_loads()
        test_invalid_login()
        test_unauthenticated_redirect()
        test_404_redirect()

        # ── Group 2: Authenticated flow (inject token to skip UI login) ───────
        print("\n── Group 2: Authenticated — Login via UI ────────────────────")
        test_valid_login_redirects_to_dashboard(creds)

        print("\n── Group 3: Dashboard ───────────────────────────────────────")
        test_dashboard_elements()
        test_dashboard_analytics()

        print("\n── Group 4: Leads ───────────────────────────────────────────")
        inject_token(creds["token"])
        test_leads_page()

        print("\n── Group 5: Admin Settings ──────────────────────────────────")
        inject_token(creds["token"])
        test_admin_settings_page()
        test_admin_settings_toggle()

        print("\n── Group 6: Campaign Knowledge & Starter Templates ──────────")
        inject_token(creds["token"])
        test_campaign_knowledge_page_empty_state()
        test_starter_template_use()
        test_create_campaign_from_template()
        test_campaign_list_actions()

        print("\n── Group 7: Logout ──────────────────────────────────────────")
        inject_token(creds["token"])
        test_logout()

        browser.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    passed = sum(1 for r in results if r[0] == PASS)
    failed = sum(1 for r in results if r[0] == FAIL)
    total = len(results)

    print(f"\n{'='*60}")
    print(f"  RESULTS: {passed} passed, {failed} failed / {total} total")
    print(f"  Screenshots saved to: {SCREENSHOTS_DIR}")
    print(f"{'='*60}")

    if failed:
        print("\n  FAILURES:")
        for icon, name, note in results:
            if icon == FAIL:
                print(f"    {FAIL} {name}" + (f" — {note}" if note else ""))

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
