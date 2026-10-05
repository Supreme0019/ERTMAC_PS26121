import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import pandas as pd
from app.db import conn
from app.rag.retriever import get_events, get_chunks, nearby_ids

TOL = 15
truth = pd.read_csv("../data/synthetic/events_truth.csv")
ids = nearby_ids("WELL-A-102", 10)

print("== Structured event retrieval (nearby wells) ==")
cases = [(["mud_loss"], 2700, 2900), (["mud_loss"], 2750, 2950), (["stuck_pipe"], 3200, 3400),
         (["torque_spike"], 2000, 2200), (["kick"], 3350, 3550)]
for types, lo, hi in cases:
    T = truth[truth.well_id.isin(ids) & truth.event_type.isin(types) & truth.depth.between(lo, hi)]
    P = pd.DataFrame(get_events(ids, {"types": types, "from": lo, "to": hi}, limit=200))
    if P.empty or T.empty:
        print(types, lo, hi, "truth:", len(T), "returned:", len(P)); continue
    rec = T.apply(lambda r: ((P.well_id == r.well_id) & (P.event_type == r.event_type) & ((P.depth - r.depth).abs() <= TOL)).any(), axis=1).mean()
    pre = P.apply(lambda r: ((T.well_id == r.well_id) & (T.event_type == r.event_type) & ((T.depth - r.depth).abs() <= TOL)).any(), axis=1).mean()
    print(f"{types[0]:<13} {lo}-{hi}  truth {len(T):>2}  returned {len(P):>2}  recall {rec:.2f}  precision {pre:.2f}")

print("\n== Report-chunk retrieval (top-5 across all ingested reports) ==")
with conn() as c:
    docs = {r["well_id"] for r in c.execute("SELECT DISTINCT well_id FROM documents").fetchall()}
all_ids = list(docs)
sample = truth[truth.well_id.isin(docs)].sample(min(30, truth.well_id.isin(docs).sum()), random_state=1)
hit = 0
for e in sample.itertuples():
    q = f"{e.event_type.replace('_', ' ')} at about {int(e.depth)} m in {e.formation}"
    res = get_chunks(all_ids, q, k=5)
    d1, d2 = str(int(e.depth)), f"{int(e.depth):,}"
    hit += any(r["well_id"] == e.well_id and (d1 in r["text"] or d2 in r["text"]) for r in res)
print(f"hit@5: {hit}/{len(sample)} = {hit / max(len(sample), 1):.2f}")