import urllib.request
import json
import time

BASE_URL = "http://localhost:8000"

def test_endpoint(name, method, path, data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            elapsed = round((time.time() - t0) * 1000, 1)
            body = resp.read().decode("utf-8")
            try:
                parsed = json.loads(body)
                return {
                    "name": name,
                    "endpoint": f"{method} {path}",
                    "status": resp.status,
                    "elapsed_ms": elapsed,
                    "success": True,
                    "data_preview": str(parsed)[:200]
                }
            except Exception:
                return {
                    "name": name,
                    "endpoint": f"{method} {path}",
                    "status": resp.status,
                    "elapsed_ms": elapsed,
                    "success": True,
                    "data_preview": body[:200]
                }
    except urllib.error.HTTPError as e:
        elapsed = round((time.time() - t0) * 1000, 1)
        err_body = e.read().decode("utf-8")
        return {
            "name": name,
            "endpoint": f"{method} {path}",
            "status": e.code,
            "elapsed_ms": elapsed,
            "success": False,
            "error": err_body[:300]
        }
    except Exception as e:
        elapsed = round((time.time() - t0) * 1000, 1)
        return {
            "name": name,
            "endpoint": f"{method} {path}",
            "status": "ERROR",
            "elapsed_ms": elapsed,
            "success": False,
            "error": str(e)
        }

endpoints_to_test = [
    ("Health Check", "GET", "/health", None),
    ("Similarity GET", "GET", "/wells/b1000000-0000-0000-0000-000000000001/similar?radius_km=25&depth=2740", None),
    ("Similarity POST Legacy", "POST", "/wells/b1000000-0000-0000-0000-000000000001/similar", {"radius_km": 25, "depth": 2740}),
    ("Similarity POST Node Route", "POST", "/api/similarity/compute", {"well_id": "b1000000-0000-0000-0000-000000000001", "radius_km": 25, "depth": 2740}),
    ("Risk GET", "GET", "/risks/b1000000-0000-0000-0000-000000000001?depth=2740&radius_km=25", None),
    ("Risk POST Legacy", "POST", "/risks/b1000000-0000-0000-0000-000000000001", {"depth": 2740, "radius_km": 25}),
    ("Risk POST Node Route", "POST", "/api/risk/evaluate", {"well_id": "b1000000-0000-0000-0000-000000000001", "depth": 2740, "radius_km": 25}),
    ("Search POST Legacy", "POST", "/search", {"query": "mud loss Formation X", "k": 5}),
    ("Search POST Node Route", "POST", "/api/search/vector", {"query": "mud loss Formation X", "k": 5}),
    ("Assistant POST Legacy", "POST", "/assistant/query", {"question": "What are the common risks in Formation X?", "well_id": "b1000000-0000-0000-0000-000000000001"}),
    ("Assistant POST Node Route", "POST", "/api/rag/query", {"question": "What are the common risks in Formation X?", "well_id": "b1000000-0000-0000-0000-000000000001"}),
    ("Document Ingest Mock", "POST", "/documents/ingest", None),
]

print("=== DEEP AI ENDPOINT FORENSIC AUDIT ===")
results = []
for name, method, path, data in endpoints_to_test:
    res = test_endpoint(name, method, path, data)
    results.append(res)
    status_icon = "[PASS]" if res["success"] else "[FAIL]"
    print(f"{status_icon} [{res['status']}] {res['endpoint']} ({res['elapsed_ms']}ms)")
    if not res["success"]:
        print(f"   ERROR: {res.get('error')}")
    else:
        print(f"   PREVIEW: {res.get('data_preview')[:120]}...")

print("\n=== SUMMARY ===")
passed = sum(1 for r in results if r["success"])
failed = sum(1 for r in results if not r["success"])
print(f"Total: {len(results)} | Passed: {passed} | Failed: {failed}")
