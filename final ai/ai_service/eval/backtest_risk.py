import sys, pathlib, random
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import pandas as pd
from app.db import conn
from app.risk.engine import evaluate

N = int(sys.argv[1]) if len(sys.argv) > 1 else 25
LEAD, random.seed(1)
LEAD = 30
truth = pd.read_csv("../data/synthetic/events_truth.csv")
with conn() as c:
    wf = pd.DataFrame(c.execute("SELECT well_id, formation, top_depth, bottom_depth FROM well_formations").fetchall())
    tds = {r["id"]: r["total_depth"] for r in c.execute("SELECT id, total_depth FROM wells WHERE source='synthetic' AND id<>'WELL-A-102'").fetchall()}


def fm_of(wid, d):
    r = wf[(wf.well_id == wid) & (wf.top_depth <= d) & (wf.bottom_depth > d)]
    return r.formation.iloc[0] if len(r) else None


LEVELS = ("moderate", "high", "critical")
pos = truth.sample(min(N, len(truth)), random_state=1)
hit = tested = 0
for e in pos.itertuples():
    fm = fm_of(e.well_id, e.depth - LEAD)
    if not fm: continue
    tested += 1
    alerts = evaluate(e.well_id, e.depth - LEAD, fm, None)
    hit += any(a["risk_type"] == e.event_type and a["risk_level"] in LEVELS
               and a["depth_range"][0] - 10 <= e.depth <= a["depth_range"][1] + 10 for a in alerts)
print(f"Recall of planted events, {LEAD} m ahead: {hit}/{tested} = {hit / max(tested, 1):.2f}")

fa = neg = 0
wells = list(tds)
for _ in range(N):
    wid = random.choice(wells); d = random.uniform(1600, tds[wid] - 50)
    if ((truth.well_id == wid) & ((truth.depth - d).abs() < 100)).any(): continue
    fm = fm_of(wid, d)
    if not fm: continue
    neg += 1
    fa += any(a["risk_level"] in LEVELS for a in evaluate(wid, d, fm, None))
print(f"Alerts at random depths >=100 m from any event: {fa}/{neg} = {fa / max(neg, 1):.2f}")