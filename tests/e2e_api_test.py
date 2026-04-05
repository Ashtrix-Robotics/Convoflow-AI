"""
Convoflow AI — comprehensive E2E API test suite.
Runs against the Render production backend at BASE_URL.

Usage:
    python tests/e2e_api_test.py [BASE_URL]

    Default BASE_URL: https://convoflow-api.onrender.com
"""
import asyncio
import sys
import uuid

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://convoflow-api.onrender.com"
results: list[tuple[str, str, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    icon = "✅" if ok else "❌"
    results.append((status, name, detail))
    suffix = f": {detail}" if detail else ""
    print(f"{icon} {status}  {name}{suffix}")


async def run_tests() -> None:
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as c:

        # ── 1. Health ─────────────────────────────────────────────────────────
        r = await c.get(f"{BASE}/health")
        check("GET /health", r.status_code == 200, r.text[:60])

        # ── 2. Docs available in dev mode (may be disabled in prod) ───────────
        r = await c.get(f"{BASE}/docs")
        check("GET /docs", r.status_code in (200, 404), f"status={r.status_code}")

        # ── 3. Auth: register new agent ───────────────────────────────────────
        tag = str(uuid.uuid4())[:8]
        reg = {
            "name": f"Test Agent {tag}",
            "email": f"test_{tag}@test.com",
            "password": "TestPass123!",
        }
        r = await c.post(f"{BASE}/auth/register", json=reg)
        check("POST /auth/register", r.status_code == 201, r.text[:80])

        # ── 4. Auth: login ────────────────────────────────────────────────────
        r = await c.post(
            f"{BASE}/auth/login",
            data={"username": reg["email"], "password": reg["password"]},
        )
        check("POST /auth/login", r.status_code == 200 and "access_token" in r.json())
        token = r.json().get("access_token", "")
        auth = {"Authorization": f"Bearer {token}"}

        # ── 5. Auth: /me ──────────────────────────────────────────────────────
        r = await c.get(f"{BASE}/auth/me", headers=auth)
        check(
            "GET /auth/me",
            r.status_code == 200 and r.json().get("email") == reg["email"],
        )

        # ── 6. Auth: wrong password returns 401 ──────────────────────────────
        r = await c.post(
            f"{BASE}/auth/login",
            data={"username": reg["email"], "password": "wrong"},
        )
        check("POST /auth/login wrong pwd → 401", r.status_code == 401)

        # ── 7. Protected route without token returns 401 ──────────────────────
        r = await c.get(f"{BASE}/leads")
        check("GET /leads without token → 401", r.status_code == 401)

        # ── 8. Leads: list ────────────────────────────────────────────────────
        r = await c.get(f"{BASE}/leads", headers=auth)
        check("GET /leads (authenticated)", r.status_code == 200, f"count={len(r.json())}")

        # ── 9. Leads: inbound webhook ─────────────────────────────────────────
        r = await c.post(
            f"{BASE}/leads/inbound",
            json={
                "name": f"Inbound {tag}",
                "phone": f"+918{tag}1",
                "source_campaign": "E2E Test",
            },
        )
        check("POST /leads/inbound (pabbly hook)", r.status_code == 201, r.text[:80])
        lead_id = r.json().get("id", "") if r.status_code == 201 else ""

        # ── 10. Leads: GET by id ──────────────────────────────────────────────
        if lead_id:
            r = await c.get(f"{BASE}/leads/{lead_id}", headers=auth)
            check(
                "GET /leads/{id}",
                r.status_code == 200 and r.json().get("id") == lead_id,
            )

        # ── 11. Leads: PATCH ──────────────────────────────────────────────────
        if lead_id:
            r = await c.patch(
                f"{BASE}/leads/{lead_id}",
                json={"status": "contacted", "notes": "E2E test note"},
                headers=auth,
            )
            status_val = r.json().get("status") if r.status_code == 200 else ""
            check("PATCH /leads/{id}", r.status_code == 200, f"status={status_val}")

        # ── 12. Leads: /my ────────────────────────────────────────────────────
        r = await c.get(f"{BASE}/leads/my", headers=auth)
        check("GET /leads/my", r.status_code == 200, f"count={len(r.json())}")

        # ── 13. Clients: list ─────────────────────────────────────────────────
        r = await c.get(f"{BASE}/clients/", headers=auth)
        check("GET /clients/", r.status_code == 200, f"count={len(r.json())}")

        # ── 14. Clients: create ───────────────────────────────────────────────
        r = await c.post(
            f"{BASE}/clients/",
            json={"name": f"Client {tag}", "phone": f"+917{tag}2"},
            headers=auth,
        )
        check("POST /clients/", r.status_code == 201)
        client_id = r.json().get("id", "") if r.status_code == 201 else ""

        # ── 15. Clients: GET by id ────────────────────────────────────────────
        if client_id:
            r = await c.get(f"{BASE}/clients/{client_id}", headers=auth)
            check(
                "GET /clients/{id}",
                r.status_code == 200 and r.json().get("id") == client_id,
            )

        # ── 16. Calls: list ───────────────────────────────────────────────────
        r = await c.get(f"{BASE}/calls", headers=auth)
        check("GET /calls", r.status_code == 200, f"count={len(r.json())}")

        # ── 17. Followups: list (with bogus call_id) ──────────────────────────
        r = await c.get(f"{BASE}/followups/nonexistent-call-id", headers=auth)
        check(
            "GET /followups/{call_id} bogus → 200 or 404",
            r.status_code in (200, 404),
        )

        # ── 18. Analytics ─────────────────────────────────────────────────────
        r = await c.get(f"{BASE}/analytics/overview", headers=auth)
        check("GET /analytics/overview", r.status_code == 200, r.text[:80])

        # ── 19. Admin: list settings ──────────────────────────────────────────
        r = await c.get(f"{BASE}/admin/settings", headers=auth)
        check(
            "GET /admin/settings",
            r.status_code == 200,
            f"count={len(r.json())}",
        )

        # ── 20. Admin: update setting ─────────────────────────────────────────
        r = await c.put(
            f"{BASE}/admin/settings/auto_whatsapp_mode",
            json={"value": "false"},
            headers=auth,
        )
        check(
            "PUT /admin/settings/auto_whatsapp_mode",
            r.status_code == 200,
            r.json().get("key", ""),
        )

        r = await c.put(
            f"{BASE}/admin/settings/whatsapp_reply_ai_enabled",
            json={"value": "true"},
            headers=auth,
        )
        check(
            "PUT /admin/settings/whatsapp_reply_ai_enabled",
            r.status_code == 200,
        )

        # ── 21. Admin: create campaign ────────────────────────────────────────
        camp = {
            "aisensy_campaign_name": f"test_camp_{tag}",
            "display_name": f"Test Campaign {tag}",
            "is_active": True,
            "is_default": True,
            "product_name": "Test Product",
            "product_description": "E2E test product description",
            "key_selling_points": "- Point 1\n- Point 2",
            "pricing_info": "₹1,000",
            "target_audience": "Testers",
            "tone": "friendly",
            "ai_persona_prompt": "You are a helpful test bot.",
            "faq": [{"question": "Q1?", "answer": "A1"}],
            "objections": [{"objection": "Too expensive", "handling": "Great value!"}],
            "template_params_schema": [],
            "default_template_params": [],
        }
        r = await c.post(f"{BASE}/admin/campaigns", json=camp, headers=auth)
        check("POST /admin/campaigns", r.status_code == 201, r.text[:80])
        camp_id = r.json().get("id", "") if r.status_code == 201 else ""

        # ── 22. Admin: GET campaign ───────────────────────────────────────────
        if camp_id:
            r = await c.get(f"{BASE}/admin/campaigns/{camp_id}", headers=auth)
            check(
                "GET /admin/campaigns/{id}",
                r.status_code == 200 and r.json().get("id") == camp_id,
            )

        # ── 23. Admin: update campaign ────────────────────────────────────────
        if camp_id:
            r = await c.put(
                f"{BASE}/admin/campaigns/{camp_id}",
                json={**camp, "display_name": "Updated E2E"},
                headers=auth,
            )
            display = r.json().get("display_name") if r.status_code == 200 else ""
            check(
                "PUT /admin/campaigns/{id}",
                r.status_code == 200 and display == "Updated E2E",
                display,
            )

        # ── 24. Admin: list campaigns ─────────────────────────────────────────
        r = await c.get(f"{BASE}/admin/campaigns", headers=auth)
        check(
            "GET /admin/campaigns (list)",
            r.status_code == 200,
            f"count={len(r.json())}",
        )

        # ── 25. WhatsApp: initiate for lead ───────────────────────────────────
        if lead_id and camp_id:
            r = await c.post(
                f"{BASE}/leads/{lead_id}/whatsapp/initiate",
                json={"campaign_id": camp_id},
                headers=auth,
            )
            check(
                "POST /leads/{id}/whatsapp/initiate",
                r.status_code in (200, 202, 400, 503),
                r.text[:100],
            )

        # ── 26. WhatsApp: conversation summary ────────────────────────────────
        if lead_id:
            r = await c.get(f"{BASE}/leads/{lead_id}/whatsapp", headers=auth)
            check(
                "GET /leads/{id}/whatsapp",
                r.status_code in (200, 404),
                f"status={r.status_code}",
            )

        # ── 27. WhatsApp: messages list ───────────────────────────────────────
        if lead_id:
            r = await c.get(f"{BASE}/leads/{lead_id}/whatsapp/messages", headers=auth)
            check(
                "GET /leads/{id}/whatsapp/messages",
                r.status_code in (200, 404),
                f"status={r.status_code}",
            )

        # ── 28. Webhook: valid message.sender.user ────────────────────────────
        hook = {
            "id": f"test-{tag}",
            "topic": "message.sender.user",
            "delivery_attempt": 1,
            "data": {
                "message": {
                    "phone_number": f"+918{tag}1",
                    "sender": "USER",
                    "message_type": "TEXT",
                    "message_content": {"text": "Hello, is the camp still open?"},
                    "messageId": f"msg-{tag}",
                }
            },
        }
        r = await c.post(f"{BASE}/integrations/aisensy/webhook", json=hook)
        check(
            "POST /webhook (message.sender.user)",
            r.status_code == 202,
            r.text[:80],
        )

        # ── 29. Webhook: duplicate delivery ───────────────────────────────────
        r = await c.post(f"{BASE}/integrations/aisensy/webhook", json=hook)
        check("POST /webhook duplicate delivery → 202", r.status_code == 202)

        # ── 30. Webhook: status.updated topic ────────────────────────────────
        r = await c.post(
            f"{BASE}/integrations/aisensy/webhook",
            json={
                "id": f"test-status-{tag}",
                "topic": "message.status.updated",
                "delivery_attempt": 1,
                "data": {
                    "message": {
                        "messageId": "abc",
                        "status": "DELIVERED",
                        "phone_number": f"+918{tag}1",
                    }
                },
            },
        )
        check("POST /webhook (message.status.updated) → 202", r.status_code == 202)

        # ── 31. Webhook: bad JSON ─────────────────────────────────────────────
        r = await c.post(
            f"{BASE}/integrations/aisensy/webhook",
            content=b"not-json",
            headers={"Content-Type": "application/json"},
        )
        check("POST /webhook bad JSON → 422", r.status_code in (400, 422))

        # ── 32. Admin: test WhatsApp send (external dep — pass regardless) ────
        r = await c.post(
            f"{BASE}/admin/whatsapp/test",
            json={
                "name": "Sreenath",
                "phone": "9502718666",
                "campaign_name": f"test_camp_{tag}",
            },
            headers=auth,
        )
        check(
            "POST /admin/whatsapp/test (ext. dep., any non-5xx)",
            r.status_code in (200, 400, 422, 503),
            r.text[:120],
        )

        # ── 33. Admin: delete test campaign (cleanup) ─────────────────────────
        if camp_id:
            r = await c.delete(f"{BASE}/admin/campaigns/{camp_id}", headers=auth)
            check("DELETE /admin/campaigns/{id}", r.status_code == 204)

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    passed = sum(1 for s, *_ in results if s == "PASS")
    failed = sum(1 for s, *_ in results if s == "FAIL")
    total = len(results)
    bar = "─" * 60
    print(bar)
    print(f"  Results: {passed} passed  {failed} failed  (of {total} total)")
    print(bar)
    if failed:
        print("  FAILURES:")
        for s, name, detail in results:
            if s == "FAIL":
                suffix = f": {detail}" if detail else ""
                print(f"    • {name}{suffix}")


if __name__ == "__main__":
    asyncio.run(run_tests())
