"""Predict event severity (low / medium / high) from the signals around a known event.
Tiny sample (about 80 events), so it is evaluated with leave-one-well-out and compared to a majority baseline.
Run from ai_service/:   python ml/severity.py"""
import json

import joblib
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import balanced_accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import LeaveOneGroupOut, cross_val_predict

from common import MODELS
from features import Z_COLS, build_event_set

d = build_event_set()
feats = ["rel_depth"] + Z_COLS + [c for c in d.columns if c.startswith("type_")]
X, y, g = d[feats], d.severity, d.well_id
print(f"{len(d)} events | classes: {y.value_counts().to_dict()} | wells: {g.nunique()}")

rf = RandomForestClassifier(n_estimators=300, max_depth=4, class_weight="balanced", random_state=0)
pred = cross_val_predict(rf, X, y, groups=g, cv=LeaveOneGroupOut())
base = cross_val_predict(DummyClassifier(strategy="most_frequent"), X, y, groups=g, cv=LeaveOneGroupOut())
res = dict(macro_f1=round(f1_score(y, pred, average="macro"), 3), balanced_acc=round(balanced_accuracy_score(y, pred), 3),
           baseline_macro_f1=round(f1_score(y, base, average="macro"), 3),
           baseline_balanced_acc=round(balanced_accuracy_score(y, base), 3))
print("leave-one-well-out:", res)
print(classification_report(y, pred, zero_division=0))
labels = ["low", "medium", "high"]
print("confusion (rows=true, cols=predicted, order low/medium/high):\n", confusion_matrix(y, pred, labels=labels))

rf.fit(X, y)
joblib.dump(rf, MODELS / "severity_v1.joblib")
json.dump(dict(name="severity_v1", features=feats, metrics=res, n_events=int(len(d)),
               note="Experimental, synthetic data, tiny sample."), open(MODELS / "severity_v1.json", "w"), indent=2)
imp = sorted(zip(feats, rf.feature_importances_), key=lambda t: -t[1])[:5]
print("top features:", [(f, round(v, 3)) for f, v in imp])
