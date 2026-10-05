import pandas as pd

# risk type -> (column, direction). direction +1 = should rise, -1 = should fall
SIGNALS = {
    "mud_loss":     [("mud_loss", +1), ("mud_flow", -1), ("pressure", -1)],
    "stuck_pipe":   [("torque", +1), ("rop", -1)],
    "torque_spike": [("torque", +1)],
    "kick":         [("pressure", +1), ("mud_flow", +1)],
}


def live_anomaly(recent: pd.DataFrame | None, risk_type: str, z_thresh=3.0, min_rows=20):
    """recent = latest rows of the active well, oldest first.
    Baseline = older half of the window; test = mean of the last 5 rows."""
    if recent is None or len(recent) < min_rows or risk_type not in SIGNALS:
        return dict(flag=False, detail=[])
    base = recent.iloc[: len(recent) // 2]
    tail = recent.iloc[-5:]
    hits = []
    for col, sign in SIGNALS[risk_type]:
        sd = base[col].std() or 1e-6
        z = sign * (tail[col].mean() - base[col].mean()) / sd
        if z >= z_thresh:
            hits.append(f"{col} deviates {z:.1f} sigma from the recent baseline")
    return dict(flag=bool(hits), detail=hits)