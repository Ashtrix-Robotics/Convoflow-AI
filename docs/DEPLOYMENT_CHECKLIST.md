# Convoflow AI — Deployment Checklist

## 🚨 URGENT: Render Backend Needs Manual Deploy

The production backend at `https://convoflow-api.onrender.com` has **NOT deployed** since 11:33 AM despite multiple pushes. The following critical fixes are waiting to go live:

### Security Fixes (Commit `09b07e4`)

- **CRITICAL:** `/agents/` endpoints now require authentication (were fully exposed)
- Rate limiting on `/auth/login` (10/min) and `/auth/register` (5/min)
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
- CORS hardened (explicit methods/headers instead of wildcards)
- Router-level auth on calls, clients, followups, analytics routers

### Bug Fixes (Commit `82f60da`)

- Campaign name field defaults to empty string instead of literal "false"
- `_KNOWN_SETTINGS` now uses per-key defaults

### New Features (Previous commits — still not deployed)

- `GET /admin/sheets/worksheets` — List Google Sheet tabs
- `POST /admin/sheets/pull` — Pull leads from source sheet tab
- `DELETE /admin/leads/purge` — Purge all leads
- `google_source_sheet_name` setting

---

## Step 1: Trigger Render Deploy

### Option A: Via Render Dashboard (Recommended)

1. Go to https://dashboard.render.com
2. Click **convoflow-api** service
3. Click **Manual Deploy** → **Deploy latest commit**
4. Wait ~3-5 minutes for Docker build + deploy

### Option B: Via Deploy Hook

1. Go to Render Dashboard → convoflow-api → Settings → Deploy Hook
2. Create a hook if none exists → copy the URL
3. Run: `.\trigger-render-deploy.ps1 -DeployHookUrl "<URL>"`

### Option C: Via GitHub Actions (After Setup)

1. Add these GitHub Secrets:
   - `RENDER_DEPLOY_HOOK` — Deploy Hook URL from Render
   - `RENDER_SERVICE_ID` — Service ID (from Render URL)
   - `RENDER_API_KEY` — API key from Render Account Settings
2. Go to GitHub → Actions → "Deploy Backend" → Run workflow

---

## Step 2: Verify Deployment

After deploy completes, run these checks:

### Health Check

```bash
curl https://convoflow-api.onrender.com/health
# Expected: {"status":"ok","service":"Convoflow AI API","version":"3"}
# If version is still "2", deploy didn't work
```

### Security Check (CRITICAL)

```bash
# This MUST return 401, NOT 200
curl https://convoflow-api.onrender.com/agents/
# Expected: {"detail":"Not authenticated"}

# These should also return 401
curl https://convoflow-api.onrender.com/admin/settings
curl https://convoflow-api.onrender.com/leads
curl https://convoflow-api.onrender.com/calls
```

### Feature Check

```bash
# Login and get token
TOKEN=$(curl -s -X POST https://convoflow-api.onrender.com/auth/login \
  -d "username=admin@convoflow.ai&password=Admin@123" | jq -r .access_token)

# Worksheets should return tab names
curl -H "Authorization: Bearer $TOKEN" \
  https://convoflow-api.onrender.com/admin/sheets/worksheets

# Purge should work (returns deleted count)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  https://convoflow-api.onrender.com/admin/leads/purge

# Settings should show campaign with empty default (not "false")
curl -H "Authorization: Bearer $TOKEN" \
  https://convoflow-api.onrender.com/admin/settings
```

---

## Step 3: Set Up CI/CD (One-Time)

### GitHub Secrets Needed

| Secret               | Where to Find                                           |
| -------------------- | ------------------------------------------------------- |
| `RENDER_DEPLOY_HOOK` | Render → Service → Settings → Deploy Hook               |
| `RENDER_SERVICE_ID`  | From service URL: `dashboard.render.com/web/srv-XXXXXX` |
| `RENDER_API_KEY`     | Render → Account Settings → API Keys                    |
| `VERCEL_TOKEN`       | Vercel → Settings → Tokens                              |
| `VERCEL_ORG_ID`      | `web/.vercel/project.json` → `orgId`                    |
| `VERCEL_PROJECT_ID`  | `web/.vercel/project.json` → `projectId`                |

### How to Add

1. Go to https://github.com/Ashtrix-Robotics/Convoflow-AI/settings/secrets/actions
2. Click "New repository secret" for each

### Verify Render Auto-Deploy

1. Go to Render Dashboard → convoflow-api → Settings
2. Ensure **Auto-Deploy** is set to "Yes"
3. If it says "Yes" but isn't deploying, the GitHub webhook may be disconnected
4. Try: Disconnect and reconnect the GitHub repo in Render settings

---

## Step 4: Post-Deploy E2E Testing

After backend deploys, test these flows in the web dashboard:

1. **Pull Leads**: Settings → Pull from Sheet → Confirm → Check Leads page
2. **View Lead Detail**: Click a lead → Verify all fields shown
3. **Update Lead Status**: Change pipeline stage via dropdown
4. **Push Leads**: Settings → Push to Sheet → Confirm → Check "Convoflow Leads" tab in Google Sheets
5. **Purge Leads**: Settings → Purge All → Confirm → Verify Leads page is empty
6. **Re-Pull**: Pull again after purge → Verify leads reappear
7. **Team Management**: Team → Edit/Suspend/Delete agents
8. **Campaigns**: Settings → Campaigns → Create/Edit/Delete campaigns

---

## Architecture Quick Reference

```
GitHub (main branch)
  ├─ push to web/** → Vercel auto-deploy ✅
  ├─ push to backend/** → GitHub Actions → Render Deploy Hook
  └─ push to backend/** → Render auto-deploy (currently broken)

Production URLs:
  Web:     https://convoflow-web.vercel.app
  API:     https://convoflow-api.onrender.com
  Sheets:  https://docs.google.com/spreadsheets/d/1-yvCsTjnysI6MYy_6ihWlHwy9mbS9Y2uuElxPRwjDZc
```
