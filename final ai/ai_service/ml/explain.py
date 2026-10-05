"""SHAP (exact for tree models) and LIME explanations for a saved model.
Run from ai_service/:   pip install shap lime matplotlib   then   python ml/explain.py --event mud_loss
Needs a tree model: train with --algo xgb or lgbm (not hgb)."""
import argparse
import json

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from lime.lime_tabular import LimeTabularExplainer

from common import MODELS, OUT
from features import FEAT, build_replay_set, build_training_set

ap = argparse.ArgumentParser()
ap.add_argument("--event", default="mud_loss"); ap.add_argument("--version", default="v1")
ap.add_argument("--depth", type=float, default=2850)
args = ap.parse_args()
stem = f"{args.event}_{args.version}"
meta = json.load(open(MODELS / f"{stem}.json"))
if meta["algo"] == "hgb":
    raise SystemExit("SHAP's TreeExplainer needs xgboost or lightgbm: retrain with --algo xgb")
model = joblib.load(MODELS / f"{stem}_base.joblib")
d, replay = build_training_set(args.event), build_replay_set()
X = d[FEAT]


def as_2d(sv):
    sv = np.asarray(sv)
    return sv[..., 1] if sv.ndim == 3 else sv


def bar(names, values, title, path):
    order = np.argsort(np.abs(values))
    plt.figure(figsize=(7, 3.8))
    plt.barh(np.array(names)[order], np.array(values)[order],
             color=["#2a9d8f" if v >= 0 else "#e76f51" for v in np.array(values)[order]])
    plt.axvline(0, color="k", lw=.6); plt.title(title); plt.tight_layout(); plt.savefig(path, dpi=140); plt.close()


explainer = shap.TreeExplainer(model)
sample = X.sample(min(2000, len(X)), random_state=0)
sv = as_2d(explainer.shap_values(sample))
imp = pd.DataFrame({"feature": FEAT, "mean_abs_shap": np.abs(sv).mean(0)}).sort_values("mean_abs_shap", ascending=False)
print("GLOBAL SHAP importance\n", imp.round(3).to_string(index=False))
bar(imp.feature, imp.mean_abs_shap, f"{args.event}: global importance (mean |SHAP|)", OUT / f"shap_global_{args.event}.png")

row = replay.iloc[(replay.depth - args.depth).abs().argmin()]
x = row[FEAT].astype(float).to_frame().T
p = float(model.predict_proba(x)[0, 1])
sv_row = as_2d(explainer.shap_values(x))[0]
base = float(np.ravel(explainer.expected_value)[0])
print(f"\nLOCAL at {row.depth:.0f} m: p={p:.3f} (rebuilt from SHAP {1 / (1 + np.exp(-(base + sv_row.sum()))):.3f})")
shap_local = dict(zip(FEAT, sv_row.round(4)))
bar(FEAT, sv_row, f"Why the model flags {row.depth:.0f} m (SHAP, log-odds)", OUT / f"shap_local_{args.event}.png")

predict = lambda a: model.predict_proba(pd.DataFrame(a, columns=FEAT))


def lime_run(seed):
    ex = LimeTabularExplainer(X.values, feature_names=FEAT, class_names=["normal", args.event], mode="classification",
                              discretize_continuous=True, random_state=seed)
    return ex.explain_instance(x.values[0], predict, num_features=len(FEAT), num_samples=3000)


lime_w = lambda e: {next(f for f in FEAT if f in t): round(w, 4) for t, w in e.as_list()}
top = lambda w: [k for k, _ in sorted(w.items(), key=lambda kv: -abs(kv[1]))[:3]]
runs = [lime_run(s) for s in (0, 1, 2)]
runs[0].save_to_file(str(OUT / f"lime_local_{args.event}.html"))
print("LIME top-3 per seed:", [top(lime_w(r)) for r in runs], "| SHAP top-3:", top(shap_local))
json.dump(dict(event_type=args.event, depth=float(row.depth), probability=round(p, 4), shap=shap_local,
               lime=lime_w(runs[0]), model=stem, note="Explains the model, trained on synthetic data."),
          open(OUT / f"explanation_{args.event}.json", "w"), indent=2, default=float)
print("saved to", OUT)
