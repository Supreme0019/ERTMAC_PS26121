"""Data-drift monitor: compare the live (replay) sensor stream with the same depth band in the training wells.
Run from ai_service/:   python ml/monitor.py
PSI < 0.1 stable | 0.1-0.25 moderate drift | > 0.25 major drift.
A control (held-out wells, same depth band) shows what 'no drift' looks like. Indicative only: the live sample is small."""
import json

import numpy as np
import pandas as pd
from scipy.stats import ks_2samp

try:                                   # works both as `python ml/monitor.py` and as `import ml.monitor`
    from .common import OUT
    from .features import S
except ImportError:
    from common import OUT
    from features import S

SIGNALS = ["rop", "wob", "rpm", "torque", "pressure", "mud_flow", "mud_loss"]


def psi(ref, new, bins=10):
    edges = np.unique(np.quantile(ref, np.linspace(0, 1, bins + 1)))
    if len(edges) < 3:
        return 0.0
    edges[0], edges[-1] = -np.inf, np.inf
    e = np.clip(np.histogram(ref, edges)[0] / len(ref), 1e-4, None)
    a = np.clip(np.histogram(new, edges)[0] / len(new), 1e-4, None)
    return float(np.sum((a - e) * np.log(a / e)))


def label(v):
    return "major" if v > .25 else "moderate" if v > .1 else "stable"


if __name__ == "__main__":
    train = pd.read_csv(S / "drilling_data.csv")
    live = pd.read_csv(S / "active_replay.csv")
    band = train[train.depth.between(live.depth.min(), live.depth.max())]      # same depth band, so depth trends cancel
    wells = np.array(sorted(band.well_id.unique()))
    rng = np.random.default_rng(0); rng.shuffle(wells)
    cut = int(len(wells) * .75)
    ref, control = band[band.well_id.isin(wells[:cut])], band[band.well_id.isin(wells[cut:])]
    print(f"reference rows {len(ref)} | control rows {len(control)} | live rows {len(live)}")
    print(f"{'signal':<10}{'PSI live':>10}{'status':>10}{'KS p':>10}{'PSI control':>13}")
    report = {}
    for f in SIGNALS:
        p_live, p_ctl, ks = psi(ref[f], live[f]), psi(ref[f], control[f]), ks_2samp(ref[f], live[f]).pvalue
        report[f] = dict(psi_live=round(p_live, 3), psi_control=round(p_ctl, 3), ks_p=round(float(ks), 5), status=label(p_live))
        print(f"{f:<10}{p_live:>10.3f}{label(p_live):>10}{ks:>10.4f}{p_ctl:>13.3f}")
    drifted = [f for f, r in report.items() if r["status"] != "stable"]
    print("\nsignals with drift:", drifted or "none")
    json.dump(dict(rows_live=int(len(live)), signals=report, drifted=drifted,
                   note="Sensor-level covariate drift vs training wells in the same depth band. Small live sample."),
              open(OUT / "drift_report.json", "w"), indent=2)
    print("saved", OUT / "drift_report.json")
