import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))   # so "app" is importable

import pandas as pd
from app.db import conn

S = pathlib.Path("../data/synthetic")
R = pathlib.Path("../data/reports")


def copy_df(c, table, df):
    """Bulk-load a DataFrame with COPY (fast, works well over a remote connection)."""
    cols = ",".join(df.columns)
    with c.cursor() as cur:
        with cur.copy(f"COPY {table} ({cols}) FROM STDIN WITH (FORMAT csv, HEADER true)") as cp:
            cp.write(df.to_csv(index=False))
    print(f"  {table}: {len(df)} rows")


with conn() as c:
    print("Clearing tables...")
    c.execute("""TRUNCATE risk_predictions, drilling_events, document_chunks, documents,
                 drilling_parameters, well_formations, formations, wells RESTART IDENTITY CASCADE""")

    print("Loading...")
    copy_df(c, "wells", pd.read_csv(S / "wells.csv"))
    c.execute("""UPDATE wells SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography""")

    fm = pd.read_csv(S / "formations.csv").rename(columns={"formation": "name"})
    copy_df(c, "formations", fm[["name", "lithology", "risk_factors"]])
    copy_df(c, "well_formations", pd.read_csv(S / "well_formations.csv"))
    copy_df(c, "drilling_parameters", pd.read_csv(S / "drilling_data.csv"))

    # Structured events only for wells WITHOUT a report; the rest come from PDF extraction later.
    reported = {p.name.split("_")[0] for p in R.glob("*.pdf")}
    ev = pd.read_csv(S / "events_truth.csv")
    ev = ev[~ev.well_id.isin(reported)].copy()
    ev["origin"] = "structured"
    ev["confidence"] = 1.0
    copy_df(c, "drilling_events",
            ev[["well_id", "depth", "formation", "event_type", "severity",
                "mitigation", "outcome", "origin", "confidence"]])

print("Done.")