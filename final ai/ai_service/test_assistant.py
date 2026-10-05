import os
from app.rag.assistant import answer

well_id = 'b1000000-0000-0000-0000-000000000001'
question = "Why is stuck pipe and mud loss risk increasing around 2800-2850m depth?"

res = answer(question=question, well_id=well_id, radius_km=15)
print("=== RAG ASSISTANT RESPONSE ===")
print("Answer:\n", res["answer"])
print("\nSources count:", len(res["sources"]))
for s in res["sources"]:
    print(f" - [{s['id']}] {s.get('well_name')} ({s['type']}): {s.get('event_type') or s.get('text')}")
