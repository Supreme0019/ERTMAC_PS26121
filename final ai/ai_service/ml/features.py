"""Feature construction for the experimental ML models (pandas only; no database needed)."""
import hashlib
import os
import pathlib

import numpy as np
import pandas as pd

S = pathlib.Path(os.getenv("NWIS_DATA_DIR") or pathlib.Path(__file__).resolve().parents[2] / "data" / "synthetic")
COLS = ["mud_loss", "mud_flow", "pressure", "torque", "rop"]
Z_COLS = [f"z_{c}" for c in COLS]
FEAT = ["rel_depth"] + Z_COLS
LEAD_M = 30            # an example is positive when an event happens within the next 30 m


def add_features(d: pd.DataFrame) -> pd.DataFrame:
    """Rows must be spaced 5 m apart per well (as in drilling_data.csv)."""
    d = d.sort_values(["well_id", "depth"]).reset_index(drop=True)
    top = pd.read_csv(S / "well_formations.csv").set_index(["well_id", "formation"]).top_depth
    d["rel_depth"] = [dep - top.get((w, f), np.nan) for w, f, dep in zip(d.well_id, d.formation, d.depth)]
    g = d.groupby("well_id")
    for c in COLS:
        recent = g[c].transform(lambda s: s.rolling(3).mean())
        base = g[c].transform(lambda s: s.shift(6).rolling(20).mean())
        sd = g[c].transform(lambda s: s.shift(6).rolling(20).std()).replace(0, np.nan)
        d[f"z_{c}"] = (recent - base) / sd
    return d


def build_training_set(event_type: str = "mud_loss", lead: int = LEAD_M) -> pd.DataFrame:
    d = add_features(pd.read_csv(S / "drilling_data.csv"))
    ev = pd.read_csv(S / "events_truth.csv")
    d["y"] = 0
    for e in ev[ev.event_type == event_type].itertuples():
        d.loc[(d.well_id == e.well_id) & d.depth.between(e.depth - lead, e.depth), "y"] = 1
    return d.dropna(subset=FEAT).reset_index(drop=True)


def build_replay_set() -> pd.DataFrame:
    """The live demo well, resampled to 5 m spacing so the rolling windows mean what they meant in training."""
    r = pd.read_csv(S / "active_replay.csv")
    r = r[r.depth % 5 == 0]
    return add_features(r).dropna(subset=FEAT).reset_index(drop=True)


def build_event_set() -> pd.DataFrame:
    """One row per known event, for severity prediction: peak |z| of each signal around the event."""
    d = add_features(pd.read_csv(S / "drilling_data.csv"))
    ev = pd.read_csv(S / "events_truth.csv")
    rows = []
    for e in ev.itertuples():
        w = d[(d.well_id == e.well_id) & d.depth.between(e.depth - LEAD_M, e.depth + 10)]
        z = w[Z_COLS].abs()
        if z.dropna(how="all").empty:
            continue
        row = {c: z[c].max() for c in Z_COLS}
        row.update(well_id=e.well_id, event_type=e.event_type, rel_depth=w.rel_depth.mean(), severity=e.severity)
        rows.append(row)
    out = pd.DataFrame(rows)
    out = pd.concat([out, pd.get_dummies(out.event_type, prefix="type").astype(int)], axis=1)
    return out.dropna().reset_index(drop=True)


def data_fingerprint() -> str:
    h = hashlib.sha256()
    for name in ("wells.csv", "drilling_data.csv", "events_truth.csv", "well_formations.csv"):
        h.update((S / name).read_bytes())
    return h.hexdigest()[:12]
