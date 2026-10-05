"""Train, tune, cross-validate, calibrate and save a risk classifier.
Run from ai_service/:   python ml/train.py --event mud_loss --tune
Algorithms: auto (XGBoost if installed, else scikit-learn), xgb, lgbm, hgb."""
import argparse
import datetime
import json

import joblib
import numpy as np
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, roc_auc_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, RandomizedSearchCV, cross_val_score

from common import MODELS, SEARCH, make_model
from features import FEAT, build_training_set, data_fingerprint

ap = argparse.ArgumentParser()
ap.add_argument("--event", default="mud_loss")
ap.add_argument("--algo", default="auto", choices=["auto", "xgb", "lgbm", "hgb"])
ap.add_argument("--tune", action="store_true", help="randomised hyper-parameter search (grouped CV)")
ap.add_argument("--version", default="v1")
args = ap.parse_args()


def evaluate(model, X, y):
    p = model.predict_proba(X)[:, 1]
    tn, fp, fn, tp = confusion_matrix(y, (p >= .5).astype(int), labels=[0, 1]).ravel()
    return dict(roc_auc=round(roc_auc_score(y, p), 4), pr_auc=round(average_precision_score(y, p), 4),
                brier=round(brier_score_loss(y, p), 5), prevalence=round(float(y.mean()), 5),
                precision_at_0_5=round(tp / max(tp + fp, 1), 3), recall_at_0_5=round(tp / max(tp + fn, 1), 3),
                tp=int(tp), fp=int(fp), fn=int(fn), tn=int(tn))


d = build_training_set(args.event)
tr, te = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=0).split(d, d.y, d.well_id))   # split by WELL
Xtr, ytr, gtr = d.loc[tr, FEAT], d.loc[tr, "y"], d.loc[tr, "well_id"]
Xte, yte = d.loc[te, FEAT], d.loc[te, "y"]
print(f"{args.event}: {len(d)} rows, {int(d.y.sum())} positives | train wells {gtr.nunique()}, "
      f"test wells {d.loc[te, 'well_id'].nunique()}")

algo, base = make_model(args.algo, pos_weight=(ytr == 0).sum() / max((ytr == 1).sum(), 1))
cv = list(GroupKFold(n_splits=5).split(Xtr, ytr, gtr))
best = None
if args.tune:
    search = RandomizedSearchCV(base, SEARCH[algo], n_iter=12, scoring="average_precision", cv=cv,
                                random_state=0, n_jobs=1, refit=True)
    search.fit(Xtr, ytr)
    base, best = search.best_estimator_, {k: (v.item() if hasattr(v, "item") else v) for k, v in search.best_params_.items()}
    print("best params:", best)

cvs = cross_val_score(clone(base), Xtr, ytr, cv=cv, scoring="average_precision")
print(f"grouped 5-fold CV PR-AUC: {cvs.mean():.3f} +/- {cvs.std():.3f}")

base.fit(Xtr, ytr)
calibrated = CalibratedClassifierCV(clone(base), method="sigmoid", cv=list(GroupKFold(3).split(Xtr, ytr, gtr)))
calibrated.fit(Xtr, ytr)

m_raw, m_cal = evaluate(base, Xte, yte), evaluate(calibrated, Xte, yte)
print("held-out wells, raw       :", m_raw)
print("held-out wells, calibrated:", m_cal)

stem = f"{args.event}_{args.version}"
joblib.dump(calibrated, MODELS / f"{stem}.joblib")
joblib.dump(base, MODELS / f"{stem}_base.joblib")
meta = dict(name=stem, event_type=args.event, algo=algo, version=args.version, features=FEAT, lead_m=30,
            trained_at=datetime.datetime.now().isoformat(timespec="seconds"), data_fingerprint=data_fingerprint(),
            n_train_rows=int(len(tr)), n_train_wells=int(gtr.nunique()), best_params=best,
            cv_pr_auc_mean=round(float(cvs.mean()), 4), cv_pr_auc_std=round(float(cvs.std()), 4),
            metrics_raw=m_raw, metrics_calibrated=m_cal,
            reference_quantiles={f: np.quantile(Xtr[f], np.linspace(0, 1, 11)).tolist() for f in FEAT},
            note="Experimental model trained on SYNTHETIC data with planted patterns. Not validated for real operations.")
json.dump(meta, open(MODELS / f"{stem}.json", "w"), indent=2)
print("saved", MODELS / f"{stem}.joblib")
