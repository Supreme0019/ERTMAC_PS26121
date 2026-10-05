import json, urllib.request

base = "http://localhost:8000"

def get(path):
    req = urllib.request.Request(f"{base}{path}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{base}{path}", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("Testing /health ...")
print(get("/health"))

print("\nTesting /wells/b1000000-0000-0000-0000-000000000001/similar ...")
res_sim = get("/wells/b1000000-0000-0000-0000-000000000001/similar?depth=2850&formation=Kopili")
print(f"Similar count: {len(res_sim['results'])}")
for r in res_sim['results'][:2]:
    print(" -", r['well_name'], r['score'], r['distance_km'])

print("\nTesting /risks/b1000000-0000-0000-0000-000000000001 ...")
res_risk = get("/risks/b1000000-0000-0000-0000-000000000001?depth=2835&formation=Kopili")
print(f"Risk alerts: {len(res_risk['alerts'])}")
for a in res_risk['alerts'][:2]:
    print(" -", a['risk_type'], a['risk_level'], a['score'])

print("\nTesting POST /search ...")
res_search = post("/search", {"query": "lost circulation", "well_id": "b1000000-0000-0000-0000-000000000001", "k": 3})
print(f"Search events: {len(res_search['events'])}, chunks: {len(res_search['chunks'])}")

print("\nTesting POST /assistant/query ...")
res_asst = post("/assistant/query", {"question": "What is the historical risk of stuck pipe?", "well_id": "b1000000-0000-0000-0000-000000000001"})
print(f"Assistant grounded: {res_asst['grounded']}, sources: {len(res_asst['sources'])}")
print("Answer preview:", res_asst['answer'][:150])
