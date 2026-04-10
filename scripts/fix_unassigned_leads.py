"""Fix unassigned leads: assign them round-robin to active agents."""
import json, urllib.request, urllib.error, ssl

ctx = ssl.create_default_context()
API = "https://convoflow-api.onrender.com"

# Login
login_data = b"username=admin@convoflow.ai&password=Admin@123"
req = urllib.request.Request(f"{API}/auth/login", data=login_data, method="POST")
req.add_header("Content-Type", "application/x-www-form-urlencoded")
res = urllib.request.urlopen(req, context=ctx, timeout=30)
token = json.loads(res.read())["access_token"]

# Get leads
req = urllib.request.Request(f"{API}/leads?limit=100")
req.add_header("Authorization", f"Bearer {token}")
res = urllib.request.urlopen(req, context=ctx, timeout=30)
leads = json.loads(res.read())

# Get agents
req = urllib.request.Request(f"{API}/agents/")
req.add_header("Authorization", f"Bearer {token}")
res = urllib.request.urlopen(req, context=ctx, timeout=30)
all_agents = [a for a in json.loads(res.read()) if a["is_active"]]
# Exclude System Admin (admin@convoflow.ai) from assignment targets
agents = [a for a in all_agents if "admin" not in a["email"].lower()]
if not agents:
    agents = all_agents  # fallback: include admin if no other agents
print(f"Assignment targets: {len(agents)} -> {[a['email'] for a in agents]}")

unassigned = [l for l in leads if not l.get("assigned_agent_id")]
print(f"Unassigned leads: {len(unassigned)}")

for i, lead in enumerate(unassigned):
    lead_id = lead["id"]
    agent_id = agents[i % len(agents)]["id"]
    body = json.dumps({"assigned_agent_id": agent_id}).encode()
    req = urllib.request.Request(f"{API}/leads/{lead_id}", data=body, method="PATCH")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        res = urllib.request.urlopen(req, context=ctx, timeout=30)
        print(f"  Assigned '{lead['name']}' -> {agent_id[:8]}...")
    except urllib.error.HTTPError as e:
        print(f"  Failed {lead_id}: {e.code} {e.read().decode()[:100]}")

print("Done")
