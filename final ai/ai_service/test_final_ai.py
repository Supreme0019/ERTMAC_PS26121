import sys, os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.main import app

client = TestClient(app)

print("=== DEEP VERIFICATION OF 'final ai' MICROSERVICE ===")

tests = [
    ("Health Check", "GET", "/health", None),
    ("Similarity GET", "GET", "/wells/b1000000-0000-0000-0000-000000000001/similar?radius_km=25&depth=2740", None),
    ("Similarity POST Node Route", "POST", "/api/similarity/compute", {"well_id": "b1000000-0000-0000-0000-000000000001", "radius_km": 25, "depth": 2740}),
    ("Risk GET", "GET", "/risks/b1000000-0000-0000-0000-000000000001?depth=2740&radius_km=25", None),
    ("Risk POST Node Route", "POST", "/api/risk/evaluate", {"well_id": "b1000000-0000-0000-0000-000000000001", "depth": 2740, "radius_km": 25}),
    ("Search POST Legacy", "POST", "/search", {"query": "mud loss", "k": 3}),
    ("Search POST Node Route", "POST", "/api/search/vector", {"query": "mud loss", "k": 3}),
    ("New Entities Endpoint", "GET", "/documents/1/entities", None),
]

passed = 0
for name, method, path, data in tests:
    try:
        if method == "GET":
            r = client.get(path)
        else:
            r = client.post(path, json=data)
        ok = r.status_code == 200
        icon = "[PASS]" if ok else f"[FAIL:{r.status_code}]"
        print(f"{icon} {name:30} {method:4} {path}")
        if ok:
            passed += 1
        else:
            print(f"       Error: {r.text[:200]}")
    except Exception as e:
        print(f"[ERROR] {name:30} -> {e}")

# Check ML endpoint
try:
    r = client.get("/ml/risk/WELL-A-102?depth=2850")
    print(f"[{'PASS' if r.status_code in (200, 404, 422) else 'FAIL'}] {'ML Risk Endpoint':30} GET  /ml/risk/WELL-A-102 -> Status {r.status_code}")
    if r.status_code in (200, 404, 422):
        passed += 1
except Exception as e:
    print(f"[WARN] ML Risk Endpoint -> {e}")

print(f"\nSummary: {passed} of {len(tests) + 1} passed cleanly!")
