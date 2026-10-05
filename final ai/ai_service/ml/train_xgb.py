import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import numpy as np, pandas as pd, xgboost as xgb
from sklearn.model_selection import GroupKFold
from sklearn.metrics import roc_auc_score, average_precision_score

S = pathlib.Path("../data/synthetic")
d = pd.read_csv(S / "drilling_data.csv").sort_values(["well_id", "depth"]).reset_index(drop=True)
ev = pd.read_csv(S / "events_truth.csv")
top = pd.read_csv(S / "well_formations.csv").set_index(["well_id", "formation"]).top_depth
d["rel_depth"] = [dep - top.get((w, f), np.nan) for w, f, dep in zip(d.well_id, d.formation, d.depth)]

cols = ["mud_loss", "mud_flow", "pressure", "torque", "rop"]
g = d.groupby("well_id")
for c in cols:
    recent = g[c].transform(lambda s: s.rolling(3).mean())
    base = g[c].transform(lambda s: s.shift(6).rolling(20).mean())
    sd = g[c].transform(lambda s: s.shift(6).rolling(20).std()).replace(0, np.nan)
    d[f"z_{c}"] = (recent - base) / sd

d["y"] = 0
for e in ev[ev.event_type == "mud_loss"].itertuples():
    d.loc[(d.well_id == e.well_id) & d.depth.between(e.depth - 30, e.depth), "y"] = 1

feat = ["rel_depth"] + [f"z_{c}" for c in cols]
d = d.dropna(subset=feat)
aucs, aps = [], []
for tr, te in GroupKFold(5).split(d, d.y, d.well_id):        # split by WELL, never by row
    m = xgb.XGBClassifier(n_estimators=150, max_depth=4, learning_rate=.1, eval_metric="logloss")
    m.fit(d.iloc[tr][feat], d.iloc[tr].y)
    p = m.predict_proba(d.iloc[te][feat])[:, 1]
    aucs.append(roc_auc_score(d.iloc[te].y, p)); aps.append(average_precision_score(d.iloc[te].y, p))
print(f"mud_loss ROC-AUC {np.mean(aucs):.2f} | PR-AUC {np.mean(aps):.2f}  (5-fold, grouped by well)")