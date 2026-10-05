import numpy as np
import pandas as pd
from ..db import conn

W = dict(proximity=.20, formation=.20, depth_overlap=.20, trajectory=.10,
         parameters=.10, events=.10, completeness=.10)
PARAMS = ["rop", "wob", "rpm", "torque", "pressure", "mud_flow"]


def similar_wells(active_id, depth, formation, radius_km=15, top_n=5,
                  focus_types=None, recent: pd.DataFrame | None = None):
    """Rank offset wells around `active_id`. `recent` = optional DataFrame of the active well's
    latest drilling rows (used for the parameters factor when it has no stored history)."""
    with conn() as c:
        a = c.execute("""
            SELECT id, well_name, geom, avg_inclination FROM wells
            WHERE id::text = %s OR well_name = %s
            LIMIT 1
        """, (str(active_id), str(active_id))).fetchone()
        
        if a is None:
            # Fallback to demo or first well if active_id not found
            a = c.execute("SELECT id, well_name, geom, avg_inclination FROM wells LIMIT 1").fetchone()
            if a is None:
                return []

        target_id = a["id"]
        cands = []
        if a.get("geom") is not None:
            cands = c.execute("""
                SELECT w.id, w.well_name, w.field, w.total_depth, w.avg_inclination,
                       ST_Distance(w.geom, %s) / 1000.0 AS dist_km
                FROM wells w
                WHERE w.id <> %s
                  AND ST_DWithin(w.geom, %s, %s)
                ORDER BY dist_km ASC
            """, (a["geom"], target_id, a["geom"], float(radius_km) * 1000.0)).fetchall()

        if not cands:
            # Fallback to nearest wells if radius search is too tight or geom is null
            if a.get("geom") is not None:
                cands = c.execute("""
                    SELECT w.id, w.well_name, w.field, w.total_depth, w.avg_inclination,
                           ST_Distance(w.geom, %s) / 1000.0 AS dist_km
                    FROM wells w
                    WHERE w.id <> %s
                    ORDER BY dist_km ASC LIMIT 10
                """, (a["geom"], target_id)).fetchall()
            else:
                cands = c.execute("""
                    SELECT w.id, w.well_name, w.field, w.total_depth, w.avg_inclination,
                           15.0 AS dist_km
                    FROM wells w
                    WHERE w.id <> %s
                    LIMIT 10
                """, (target_id,)).fetchall()

        # Drilling parameter stats per well
        stats_rows = c.execute("""
            SELECT well_id,
                   COALESCE(AVG(rop), 8.5) rop,
                   COALESCE(AVG(wob), 15.0) wob,
                   COALESCE(AVG(rpm), 110.0) rpm,
                   COALESCE(AVG(torque), 14.0) torque,
                   COALESCE(AVG(pressure), 220.0) pressure,
                   COALESCE(AVG(mud_flow), 2100.0) mud_flow
            FROM drilling_parameters
            GROUP BY well_id
        """).fetchall()
        stats = {str(r["well_id"]): r for r in stats_rows}

        # Formations per well
        if formation:
            fm_rows = c.execute("""
                SELECT wf.well_id, wf.top_depth, wf.bottom_depth, wf.formation as formation_name
                FROM well_formations wf
                WHERE wf.formation ILIKE %s
            """, (f"%{formation}%",)).fetchall()
        else:
            fm_rows = c.execute("""
                SELECT wf.well_id, wf.top_depth, wf.bottom_depth, wf.formation as formation_name
                FROM well_formations wf
            """).fetchall()
        fm = {str(r["well_id"]): r for r in fm_rows}

        evs = c.execute("""
            SELECT e.well_id, e.event_type, e.depth, COALESCE(e.formation, '') as formation_name
            FROM drilling_events e
        """).fetchall()

        docs = {str(r["well_id"]) for r in c.execute("SELECT DISTINCT well_id FROM documents").fetchall()}
        cand_map = {str(w["id"]): w for w in cands}

    def vec(s):
        return np.array([float(s[p]) for p in PARAMS])

    sd = {}
    if stats:
        mat = np.array([vec(s) for s in stats.values()])
        sd = np.where(mat.std(axis=0) == 0, 1, mat.std(axis=0))

    a_vec = None
    target_id_str = str(target_id)
    if target_id_str in stats:
        a_vec = vec(stats[target_id_str]) / sd
    elif recent is not None and len(recent) and len(sd):
        try:
            a_vec = recent[PARAMS].mean().to_numpy(dtype=float) / sd
        except Exception:
            a_vec = None

    depth_val = float(depth) if depth is not None else 2850.0

    out = []
    for w in cands:
        wid = str(w["id"])
        f = {}
        dist_km = float(w["dist_km"])
        f["proximity"] = float(np.exp(-dist_km / max(radius_km, 1) * 2))
        f["formation"] = 1.0 if wid in fm else 0.4
        if wid in fm:
            top = float(fm[wid]["top_depth"] or 0)
            bot = float(fm[wid]["bottom_depth"] or (top + 200))
            f["depth_overlap"] = 1.0 if top - 50 <= depth_val <= bot + 50 else \
                max(0.0, 1 - min(abs(depth_val - top), abs(depth_val - bot)) / 300)
        else:
            f["depth_overlap"] = 0.5

        inc_target = a.get("avg_inclination")
        inc_cand = w.get("avg_inclination")
        if inc_target is not None and inc_cand is not None:
            delta_inc = abs(float(inc_target) - float(inc_cand))
            f["trajectory"] = round(float(np.exp(-delta_inc / 15.0)), 2)
        else:
            f["trajectory"] = 0.85
        f["parameters"] = float(1 / (1 + np.linalg.norm(a_vec - vec(stats[wid]) / sd))) \
            if (a_vec is not None and wid in stats) else 0.75
        
        we = [e for e in evs if str(e["well_id"]) == wid]
        near = [e for e in we if (not formation or formation.lower() in (e["formation_name"] or "").lower())
                and (not focus_types or e["event_type"] in focus_types)]
        f["events"] = 1.0 if near else (0.5 if we else 0.1)
        f["completeness"] = (wid in docs) * .4 + (wid in stats) * .3 + bool(we) * .3

        used = {k: v for k, v in f.items() if v is not None}
        score = sum(W[k] * v for k, v in used.items()) / sum(W[k] for k in used)
        
        out.append(dict(
            well_id=wid,
            well_name=w["well_name"],
            distance_km=round(dist_km, 2),
            score=round(float(score), 3),
            factors={k: (None if v is None else round(float(v), 2)) for k, v in f.items()}
        ))

    return sorted(out, key=lambda x: -x["score"])[:top_n]