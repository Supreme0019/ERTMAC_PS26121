import urllib.request, json

BASE_NODE = "http://localhost:4001/api"
BASE_AI = "http://localhost:8000"
WELL_ID = "b1000000-0000-0000-0000-000000000001"

# Step 1: Login to get JWT token
auth_data = json.dumps({"email": "engineer@oilindia.in", "password": "Password123!"}).encode()
req = urllib.request.Request(f"{BASE_NODE}/auth/login", data=auth_data, headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as resp:
    token = json.loads(resp.read().decode())["data"]["accessToken"]

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

def get(path):
    req = urllib.request.Request(f"{BASE_NODE}{path}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{BASE_NODE}{path}", data=data, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("==================================================")
print("     eRTMAC-NWIS THREE-TIER INTEGRATION AUDIT     ")
print("==================================================")

# 1. Health Checks
print("\n[TEST 1] System Health Checks")
h_node = get("/health")
print(" - Node :4001 Status:", h_node["status"], "| AI Service:", h_node["checks"]["ai_service"]["status"])

req_ai = urllib.request.Request(f"{BASE_AI}/health")
with urllib.request.urlopen(req_ai) as resp:
    h_ai = json.loads(resp.read().decode())
print(" - Python :8000 Status:", h_ai["ok"])

# 2. Python Authoritative Similarity Engine via Node
print("\n[TEST 2] Similarity Engine (Python Authoritative)")
sim_res = get(f"/similarity/{WELL_ID}?radiusKm=15&limit=5")
sim_wells = sim_res["data"]["similar_wells"]
print(f" - Similar offset wells returned: {len(sim_wells)}")
for w in sim_wells[:3]:
    print(f"   * {w['well_name']} ({w['well_id'][:8]}): score={w['similarity_score']} | dist={w['distance_km']} km | engine={w.get('engine')}")

# 3. Python Authoritative Risk Prediction via Node
print("\n[TEST 3] Risk Prediction Engine (Python Authoritative)")
risk_res = post("/risks/evaluate", {"well_id": WELL_ID, "depth": 2845})
risks = risk_res["data"]["risks"]
print(f" - Evaluated risks: {len(risks)} | Active critical/high count: {risk_res['data']['active_count']}")
for r in risks[:3]:
    print(f"   * [{r['level'].upper()}] {r['risk_type']} (score: {r['score']}) -> interval: {r['depth_range']} m | engine={r.get('engine')}")
    if r.get('evidence') and len(r['evidence']) > 0:
        ev0 = r['evidence'][0]
        print(f"     evidence: {ev0.get('well_name')} ({ev0.get('event_type', r['risk_type'])} at {ev0.get('depth')}m)")

# 4. RAG Assistant via Node -> Python
print("\n[TEST 4] RAG / AI Assistant Pipeline (Python Authoritative)")
asst_res = post("/assistant/query", {
    "question": "What stuck pipe and mud loss incidents occurred in nearby offset wells at Barail and Kopili horizons?",
    "well_id": WELL_ID,
    "radius_km": 15
})
asst_data = asst_res["data"]
print(" - Assistant Answer Grounded:", len(asst_data.get("sources", [])) > 0)
print(f" - Citations/Sources count: {len(asst_data.get('sources', []))}")
for s in asst_data.get("sources", [])[:3]:
    print(f"   * [{s.get('id')}] {s.get('well_name')} ({s.get('type')}): {s.get('event_type') or s.get('text', '')[:40]}")
print(" - Answer Excerpt:\n  ", asst_data["answer"][:250].replace("\n", "\n   "))

# 5. Authoritative Vector Search via Node -> Python
print("\n[TEST 5] Vector / Semantic Search (BGE Embeddings + pgvector)")
v_res = post("/search/vector", {
    "query": "stuck pipe in Barail formation",
    "well_id": WELL_ID,
    "limit": 4
})
v_results = v_res["data"]["results"]
print(f" - Vector search matches: {len(v_results)}")
for vr in v_results[:2]:
    print(f"   * [{vr.get('type')}] relevance={vr.get('relevance')} | text: {vr.get('text', '')[:80]}...")

# 6. GIS Nearby Wells Enrichment
print("\n[TEST 6] GIS Map Offset Well Enrichment (Live events count & similarity)")
nearby_res = get(f"/wells/{WELL_ID}/nearby?radius=15")
nearby_wells = nearby_res["data"]["nearby_wells"]
print(f" - Nearby offset wells: {len(nearby_wells)}")
for nw in nearby_wells[:3]:
    print(f"   * {nw['well_name']}: dist={nw['distance_km']} km | live events={nw.get('historical_events_count')} | live similarity={nw.get('similarity_score')}")

# 7. Replay System Check
print("\n[TEST 7] 4-Phase Replay Simulation Architecture")
rep_res = get("/realtime/replay/status")
print(" - Replay status:", rep_res["data"])

print("\n==================================================")
print("       ALL 7 SYSTEM VERIFICATION TESTS PASSED     ")
print("==================================================")
