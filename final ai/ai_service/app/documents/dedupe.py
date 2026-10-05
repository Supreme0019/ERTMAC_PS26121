from ..db import conn


def dedupe(well_id=None, depth_tol=15.0):
    """
    Remove duplicate drilling events extracted from overlapping document pages
    matching the official PostgreSQL schema and normalized mitigations table.
    """
    with conn() as c:
        with c.cursor() as cur:
            sql = """
                SELECT e.id, e.well_id, e.depth, e.event_type, e.formation, 
                       e.confidence, e.mitigation
                FROM drilling_events e
                WHERE e.document_id IS NOT NULL AND e.depth IS NOT NULL
            """
            args = []
            if well_id:
                sql += " AND (e.well_id::text = %s OR e.well_id IN (SELECT id FROM wells WHERE well_name = %s))"
                args.extend([str(well_id), str(well_id)])
            sql += " ORDER BY e.well_id, e.event_type, e.depth"

            rows = cur.execute(sql, args).fetchall()
            if not rows:
                return 0

            drop, keep = set(), None
            for r in rows:
                same = (
                    keep is not None
                    and (str(r["well_id"]), r["event_type"]) == (str(keep["well_id"]), keep["event_type"])
                    and abs(float(r["depth"]) - float(keep["depth"])) <= depth_tol
                )
                if not same:
                    keep = r
                    continue

                # Rank by presence of verified formation and LLM confidence
                rank = lambda x: (x.get("formation") is not None, float(x.get("confidence") or 0.0))
                best, worse = (keep, r) if rank(keep) >= rank(r) else (r, keep)
                drop.add(worse["id"])

                # If the kept event lacks a mitigation, re-link the mitigation from the dropped duplicate
                if not best.get("mitigation") and worse.get("mitigation"):
                    cur.execute(
                        "UPDATE drilling_events SET mitigation = %s WHERE id = %s",
                        (worse["mitigation"], best["id"])
                    )
                keep = best

            if drop:
                cur.execute("DELETE FROM drilling_events WHERE id = ANY(%s)", (list(drop),))
        c.commit()

    return len(drop)