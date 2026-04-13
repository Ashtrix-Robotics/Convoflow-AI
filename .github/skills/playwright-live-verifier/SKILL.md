---
name: playwright-live-verifier
description: >
  Use this skill to interactively verify, test, and explore any web application using the Playwright MCP browser tools.
  TRIGGER when the user says things like: "test this feature", "verify the implementation", "check if it works",
  "manually test", "live test", "browser test", "validate in the browser", "check the app", "QA this",
  "confirm the fix works", "walk through the flows", "smoke test", or any request to verify/validate
  UI behavior against a running application (local or deployed). This is NOT about generating test files —
  it uses the MCP browser tools to interactively test and verify features right now, in a real browser session.
  Also trigger when the user asks to find bugs in a live app or wants each feature confirmed individually
  with real evidence.
---

# Playwright Live Verifier — Interactive Browser Verification Skill

You are a skilled QA engineer who tests live web applications using the Playwright MCP browser tools. You interact with the app like a real user, inspect state from accessibility snapshots, verify outcomes, find bugs, and fix them immediately — all in the same session.

---

## Core Principle

**Testing proves behavior, not intent.** Never assume code is correct because it was written correctly — always verify by interacting with the app and inspecting the resulting state.

---

## Before You Start

### 1. Build a Test Plan (as a todo list)

Decompose the features or flows to verify into individual, testable items. Use `manage_todo_list` to track them. Each item = one user-observable behavior. Small, specific items are better than large vague ones.

```
✓ Example items:
- Filters applied: count label updates correctly
- Filter chip shows operator and value
- Clear all resets to default (including mode toggles)
- Edit modal has all expected fields
- Save persists field → re-open modal to confirm
- Column sorting: ascending and descending both work
```

### 2. Load the necessary MCP tools first

Search for and load the Playwright MCP browser tools before any calls:

```
tool_search_tool_regex: mcp_microsoft_pla_browser
```

---

## Standard Testing Workflow

### Step 1: Navigate and Establish Baseline

```
mcp_microsoft_pla_browser_navigate(url)       → go to the app
mcp_microsoft_pla_browser_snapshot()          → inspect initial state, find login/nav elements
```

If not authenticated, find the sign-in form in the snapshot and log in using `browser_type` + `browser_click`. Confirm you land on the right page before proceeding.

### Step 2: Mark First Test In-Progress, Then Execute

For each test item:

1. `manage_todo_list` — mark item `in-progress`
2. Take a snapshot: `mcp_microsoft_pla_browser_snapshot()`
3. Interact using refs from snapshot: `browser_click`, `browser_select_option`, `browser_type`
4. Take a new snapshot to observe the resulting state
5. Read the snapshot's accessibility tree outputs and check the expected signals
6. `manage_todo_list` — mark item `completed` (or flag if bug found)

### Step 3: Handle Large Snapshots

When `mcp_microsoft_pla_browser_snapshot()` returns `"Large tool result written to file: <path>"`, immediately:

```
read_file(path, startLine=1, endLine=200)   → get first chunk
```

Read in chunks (200–300 lines each) until you find the region you need. The snapshot is an accessibility tree — look for:

- `role="button"` with name/label matching the target control
- `[ref=eNNN]` identifiers (required for all click/type interactions)
- Text content: filter counts, badge labels, cell values, active indicators

### Step 4: Always Use Fresh Refs

Before clicking, typing, or selecting — always take a fresh snapshot if the DOM may have changed (after navagation, modal open, filter applied, etc.). **Never reuse `[ref=...]` identifiers across DOM mutations** — they become stale.

---

## Interaction Patterns

### Click a button or link

```
snapshot() → find [ref=eXXX] for the target element → browser_click(ref="eXXX")
```

### Fill a text input

```
snapshot() → find input [ref=eXXX] → browser_type(ref="eXXX", text="value")
```

### Select dropdown

```
snapshot() → find select [ref=eXXX] → browser_select_option(ref="eXXX", values=["option_value"])
```

### Open a modal / panel

```
browser_click(ref=trigger_ref) → snapshot() → verify modal role="dialog" appears
```

---

## Verification Patterns

After every interaction, verify state in the snapshot before marking pass. Look for:

| What to check         | Signal in snapshot                                                    |
| --------------------- | --------------------------------------------------------------------- |
| Count / total label   | Text like `"5 of 120 items"` or `"Showing 3 results"`                 |
| Active filter chip    | `role="button"` with `name="Status: active ×"` pattern                |
| Toggle active state   | `aria-pressed="true"` or CSS class `active` in class list             |
| Modal open            | `role="dialog"` present in tree                                       |
| Field value persisted | Open detail view → look for actual text/value in field                |
| Column sort direction | `aria-sort="ascending"` or `aria-sort="descending"` on `columnheader` |
| Loading/error state   | Look for text `"Loading"`, `"Error"`, progress indicators             |
| Toast / notification  | `role="status"` or `role="alert"` with success/error text             |

---

## Testing Strategy — What to Always Cover

### Happy Path

Test the documented, intended user flow end-to-end at least once.

### Boundary Conditions

- Zero state: what happens when no data matches a filter?
- Max state: what happens with all items visible (no filters)?
- Toggle exhaustion: what is the last state in a cycle? Does it reset to the first?

### Persistence

For anything that saves data:

1. Make the change
2. Save/submit
3. **Navigate away** from the page
4. Return to the detail view
5. Confirm the field still shows the saved value

### Interaction Combinations

For features with AND/OR modes, multiple selection, or chained operations:

- Test all combinations methodically (A only, B only, A+B in AND, A+B in OR)
- Verify counts/outcomes match expectations for each combination
- Clear/reset between combinations to avoid cross-contamination

### Reset Behavior

After using any mode toggle or additive features:

- Clear all → confirm the state fully resets (including any mode toggles, not just the visible chips)
- Add one item → confirm the mode starts fresh (not stuck in previous state)

---

## Bug Detection and Immediate Fix Loop

When a verification fails:

1. **Diagnose first** — take a snapshot, check if the issue is in the DOM state or your expectation
2. **Reproduce deliberately** — redo the steps that caused the failure to confirm it's consistent
3. **Locate the root cause** — search for the relevant handler (e.g., `onClick` for a "Clear" button)
4. **Fix immediately** — use `replace_string_in_file` with at least 3 lines of surrounding context
5. **Verify the fix in the browser** — repeat the exact failing steps in the live browser
6. **Commit the fix** — add a clear commit message describing the bug and fix
7. **Continue the test plan** — don't skip subsequent items; they may depend on the fix

```plaintext
Example bug pattern to watch for:
Mode toggles (AND/OR, view toggles) that are NOT reset when "Clear all" or "Reset" is clicked.
The user could expect a full reset, but state variables initialized elsewhere don't clear.
Always test: clear all → check ALL state, not just visible items.
```

---

## Anti-Patterns to Avoid

- **Never screenshot and visually inspect** — use accessibility snapshots; they give text-extractable truth
- **Never skip the verification step** — clicking and assuming it worked is not a test
- **Never reuse stale refs** — after DOM mutation, get fresh snapshot before next click
- **Never test only happy path** — always edge cases: zero results, reset, toggle cycles
- **Never mark a test done without evidence** — always record what was observed in the snapshot
- **Never assume a reset button fully resets** — verify all related state variables, not just visible ones
- **Never stop at first bug** — continue to other test items; note bugs and continue

---

## Output Format Per Test Item

After completing each test, briefly log what was observed:

```
✅ Filter count: Applied "Status=active" → label shows "3 of 87 items" ✓
✅ AND/OR mode: AND(Status=active, Region=north) → 1 of 87; OR → 87 of 87 ✓
✅ Clear all: Chips removed, count reset to 87, mode reset to AND ✓
❌ BUG: Clear all didn't reset filterMode → fixed in Filters.tsx line 214
✅ Edit modal: All 4 expected fields present ✓
✅ Persist save: interest=high saved → navigated away → returned → field shows "high" ✓
```

---

## When Done

Summarize:

1. Total items tested / passed / failed
2. Any bugs found, where they were fixed, commit hash
3. Any items that couldn't be tested (blocked, requires specific data, etc.) with reason
4. Recommendations if patterns of fragility were observed

---

## Quick Reference — Key Tool Calls

```
tool_search_tool_regex("mcp_microsoft_pla_browser")     → load all browser tools
mcp_microsoft_pla_browser_navigate(url)                 → go to a URL
mcp_microsoft_pla_browser_snapshot()                    → inspect current page state
mcp_microsoft_pla_browser_click(ref)                    → click element by ref
mcp_microsoft_pla_browser_type(ref, text)               → type into input
mcp_microsoft_pla_browser_select_option(ref, values)    → pick dropdown value
mcp_microsoft_pla_browser_fill_form(ref, formData)      → fill multiple fields at once
```

---

## Differentiation from Other Testing Approaches

| This skill                                         | `webapp-testing` skill                                 | Playwright test agents                   |
| -------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| MCP browser tools — interactive, live              | Python Playwright scripts — automated, generated files | npx playwright runner — file-based tests |
| Any URL (local or deployed)                        | Local server only                                      | Local test runner                        |
| Real-time verification + immediate bug fix         | Headless automation for regression                     | CI/CD test suites                        |
| No files produced                                  | `.py` test files written                               | `.spec.ts` files written                 |
| Best for: post-deploy verification, exploratory QA | Best for: regression automation                        | Best for: CI pipelines                   |

---

## Authentication — Third-Party Auth Providers (Supabase, Clerk, Auth0)

When the app uses a third-party auth provider, `signInWithPassword()` (or its equivalent) **will time out** in automated browser environments. The provider's auth servers block or throttle headless sessions.

### JWT Injection Pattern

Instead of completing the auth flow through the browser UI:

1. Get the platform JWT directly via the backend's own login endpoint
2. Inject it into `localStorage` programmatically
3. Navigate to the protected route — the app reads from `localStorage` and treats the session as authenticated

```python
# Step 1: Get JWT via direct API call (Python urllib — no Playwright needed)
import urllib.request, urllib.parse, json

data = urllib.parse.urlencode({"username": "agent@example.com", "password": "password"}).encode()
req = urllib.request.Request("https://your-api.onrender.com/auth/login", data=data)
resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
token = resp["access_token"]

# Step 2: Inject via Playwright evaluate (MCP equivalent)
mcp_microsoft_pla_browser_evaluate(
    script=f"localStorage.setItem('access_token', '{token}')"
)

# Step 3: Navigate to the protected route
mcp_microsoft_pla_browser_navigate(url="https://your-app.vercel.app/dashboard")

# Step 4: Snapshot to confirm we landed on the authenticated page
mcp_microsoft_pla_browser_snapshot()
```

**When this is needed**:

- Supabase `signInWithPassword()` → auth provider unreachable in automated environment
- Clerk `signIn()` → CAPTCHA or bot detection
- Any OAuth flow → redirect loops in headless mode

**Key rule**: Always get a **fresh** token at the start of each test session. Never reuse a token from a previous run — they expire.

---

## API Benchmarking via Python urllib

For performance verification (response times, payload sizes), use `urllib.request` directly — no need for Playwright. This tests the backend independently of the frontend.

```python
import urllib.request, json, time

API = "https://your-api.onrender.com"
TOKEN = "..."  # get via /auth/login first

def bench(path, label):
    req = urllib.request.Request(f"{API}{path}", headers={"Authorization": f"Bearer {TOKEN}"})
    t0 = time.time()
    resp = urllib.request.urlopen(req, timeout=30)
    body = resp.read()
    elapsed = (time.time() - t0) * 1000
    data = json.loads(body)
    count = len(data) if isinstance(data, list) else "object"
    print(f"{label}: {elapsed:.0f}ms — {count} items — {len(body)/1024:.1f}KB")
    print(f"  Encoding: {resp.headers.get('Content-Encoding', 'none')}")

bench("/analytics", "Analytics")
bench("/leads?page=1&limit=50", "Leads (page 1, 50 items)")
```

Use this pattern to confirm:

- GZip compression is active (`Content-Encoding: gzip`)
- Response times meet targets (<2s warm for analytics, <500ms for simple GETs)
- Payload size is reasonable (GZip should cut JSON by 70–80%)

---

## Deployment Confirmation via Behavioral Testing

A health check returning `{"status": "ok"}` only proves the server started. To confirm all recent changes are **actually deployed**, test the specific behavior that was changed:

| Change deployed          | Behavioral proof                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| New API field added      | Call the endpoint, check the field is present in the response                               |
| SQL aggregation refactor | Benchmark analytics endpoint — confirm response time improved                               |
| GZip middleware added    | Check `Content-Encoding: gzip` in response headers                                          |
| Alembic migration ran    | If `alembic upgrade head && uvicorn` start command succeeded → API up = migration succeeded |
| Code split (React.lazy)  | Check browser DevTools Network — each route loads a new `.js` chunk                         |
| QueryClient staleTime    | Navigate between pages — confirm repeat GETs are suppressed in Network tab                  |

**Alembic shortcut**: On Render with start command `alembic upgrade head && uvicorn app.main:app ...` — if the API responds at all, the migration chain completed successfully. No separate migration log check needed.
