"""Serving helper for the EXPERIMENTAL ML models in ai_service/ml/. Never used by the rule-based alert engine."""
import datetime
import json
import pathlib

import joblib

from ml.features import FEAT, build_replay_set

MODELS = pathlib.Path(__file__).resolve().parents[1] / "ml" / "models"
LOG = pathlib.Path(__file__).resolve().parents[1] / "ml" / "outputs" / "predictions_log.jsonl"
_cache: dict = {}
_replay_cache = None
_explainer_cache: dict = {}


def get_replay_set():
    global _replay_cache
    if _replay_cache is None:
        _replay_cache = build_replay_set()
    return _replay_cache


def get_explainer(model_name: str):
    if model_name not in _explainer_cache:
        try:
            import shap
            base_path = MODELS / f"{model_name}_base.joblib"
            if base_path.exists():
                base = joblib.load(base_path)
                _explainer_cache[model_name] = shap.TreeExplainer(base)
        except Exception as e:
            print(f"Note: Explainer initialization failed for {model_name}: {e}")
    return _explainer_cache.get(model_name)


def load(event_type: str, version: str = "v1"):
    key = f"{event_type}_{version}"
    if key not in _cache:
        path = MODELS / f"{key}.joblib"
        if not path.exists():
            raise FileNotFoundError(f"no trained model {key}: run  python ml/train.py --event {event_type}")
        _cache[key] = (joblib.load(path), json.load(open(MODELS / f"{key}.json")))
    return _cache[key]


def predict_replay(depth: float, event_type: str = "mud_loss", explain: bool = False):
    """Probability of an event within the next ~30 m for the replay demo well.
    Simulation shortcut: history before `depth` is read from the replay file (a real feed would already hold it)."""
    model, meta = load(event_type)
    replay = get_replay_set()
    min_depth = float(replay.depth.min()) if not replay.empty else 2825.0
    effective_depth = max(min_depth, float(depth))
    past = replay[replay.depth <= effective_depth]
    if past.empty:
        if replay.empty:
            raise ValueError("not enough history: replay dataset is empty")
        row = replay.iloc[[0]]
    else:
        row = past.iloc[[-1]]
    p = float(model.predict_proba(row[FEAT])[0, 1])
    out = dict(well_id="WELL-A-102", depth=float(row.depth.iloc[0]), event_type=event_type, probability=round(p, 4),
               model=meta["name"], algo=meta["algo"], trained_at=meta["trained_at"],
               held_out_metrics=meta["metrics_calibrated"], experimental=True,
               note=meta["note"], features={f: round(float(row[f].iloc[0]), 3) for f in FEAT})
    if explain:
        try:
            import numpy as np
            explainer = get_explainer(meta["name"])
            if explainer is not None:
                sv = np.asarray(explainer.shap_values(row[FEAT]))
                sv = sv[..., 1] if sv.ndim == 3 else sv
                out["shap_log_odds"] = {f: round(float(v), 4) for f, v in zip(FEAT, sv[0])}
            else:
                out["shap_log_odds"] = "unavailable: explainer not found"
        except Exception as e:                       # shap missing or non-tree model
            out["shap_log_odds"] = f"unavailable: {e}"
    try:
        LOG.parent.mkdir(exist_ok=True)
        with open(LOG, "a") as fh:
            fh.write(json.dumps(dict(ts=datetime.datetime.now().isoformat(timespec="seconds"), well_id=out["well_id"],
                                     depth=out["depth"], event_type=event_type, p=out["probability"], model=meta["name"])) + "\n")
    except OSError:
        pass
    return out
