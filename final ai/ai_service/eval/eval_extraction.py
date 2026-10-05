import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import pandas as pd
from app.db import conn

TOL = 15
truth = pd.read_csv("../data/synthetic/events_truth.csv")
with conn() as c:
    docs = pd.DataFrame(c.execute("SELECT well_id, ocr_used FROM documents").fetchall())
    pred = pd.DataFrame(c.execute("""SELECT well_id, event_type, depth, confidence, review_status
                                     FROM drilling_events WHERE origin='extracted'""").fetchall())

truth = truth[truth.well_id.isin(set(docs.well_id))]
pred = pred.dropna(subset=["depth"])


def match(row, other):
    m = other[(other.well_id == row.well_id) & (other.event_type == row.event_type)
              & ((other.depth - row.depth).abs() <= TOL)]
    return len(m) > 0


recall_hits = truth.apply(lambda r: match(r, pred), axis=1)
prec_hits = pred.apply(lambda r: match(r, truth), axis=1)
p, r = prec_hits.mean(), recall_hits.mean()
print(f"truth events: {len(truth)} | extracted: {len(pred)}")
print(f"precision {p:.2f} | recall {r:.2f} | F1 {2*p*r/(p+r+1e-9):.2f}")
print("needs_review:", (pred.review_status == "needs_review").sum())

ocr = dict(zip(docs.well_id, docs.ocr_used))
truth["ocr"] = truth.well_id.map(ocr)
print("recall by OCR used:\n", recall_hits.groupby(truth["ocr"]).mean())