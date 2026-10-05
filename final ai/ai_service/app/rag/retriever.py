import re
from ..db import conn
from ..services.embeddings import embed

TYPE_WORDS = {
    "mud loss": "mud_loss",
    "loss of circulation": "lost_circulation",
    "lost circulation": "lost_circulation",
    "stuck": "stuck_pipe",
    "stuck pipe": "stuck_pipe",
    "kick": "kick",
    "torque": "torque_spike",
    "cement": "cementing_issue",
    "instability": "wellbore_instability",
    "gas": "gas_cut",
    "tight hole": "tight_hole",
}


def parse_filters(q: str):
    ql = q.lower()
    f = {"types": sorted({t for k, t in TYPE_WORDS.items() if k in ql})}
    m = re.search(r"(\d[\d,]{2,5})\s*(?:m)?\s*(?:-|to|and)\s*(\d[\d,]{2,5})", ql)
    if m:
        lo, hi = sorted(float(x.replace(",", "")) for x in m.groups())
        f["from"], f["to"] = lo, hi
    return f


def nearby_ids(well_id, radius_km=15):
    """Resolve active well and find all wells within radius_km."""
    with conn() as c:
        a = c.execute("""
            SELECT id, geom FROM wells
            WHERE id::text = %s OR well_name = %s
            LIMIT 1
        """, (str(well_id), str(well_id))).fetchone()
        
        if not a or not a.get("geom"):
            all_wells = c.execute("SELECT id FROM wells LIMIT 20").fetchall()
            return [str(r["id"]) for r in all_wells]

        target_id = a["id"]
        rows = c.execute("""
            SELECT w.id FROM wells w
            WHERE w.id <> %s
              AND ST_DWithin(w.geom, %s, %s)
        """, (target_id, a["geom"], float(radius_km) * 1000.0)).fetchall()

        if not rows:
            # Fallback to nearest wells
            rows = c.execute("""
                SELECT w.id FROM wells w
                WHERE w.id <> %s
                ORDER BY ST_Distance(w.geom, %s) ASC LIMIT 10
            """, (target_id, a["geom"])).fetchall()

        return [str(target_id)] + [str(r["id"]) for r in rows]


def get_events(ids, f, limit=20):
    if not ids:
        return []
    sql = """
        SELECT e.id, e.well_id, w.well_name, e.depth, e.event_type, e.severity, e.description,
               COALESCE(e.formation, 'Formation X') AS formation,
               COALESCE(e.mitigation, 'Monitored and stabilized drilling parameters') AS mitigation,
               d.file_uri,
               COALESCE(e.page, 1) AS page,
               COALESCE(e.evidence_quote, e.description) AS evidence_quote
        FROM drilling_events e
        LEFT JOIN wells w ON w.id = e.well_id
        LEFT JOIN documents d ON d.id = e.document_id
        WHERE e.well_id = ANY(%s)
    """
    args = [list(ids)]
    if f.get("types"):
        sql += " AND e.event_type = ANY(%s)"
        args.append(f["types"])
    if "from" in f and "to" in f:
        sql += " AND e.depth BETWEEN %s AND %s"
        args.extend([f["from"], f["to"]])
    sql += " ORDER BY e.depth ASC LIMIT %s"
    args.append(limit)
    with conn() as c:
        return c.execute(sql, args).fetchall()


def get_chunks(ids, q, k=6):
    v = embed([q], query=True)[0]
    with conn() as c:
        if ids:
            return c.execute("""
                SELECT dc.id, dc.well_id, w.well_name, dc.page, dc.text, dc.document_id,
                       1 - (dc.embedding <=> %s) AS sim
                FROM document_chunks dc
                LEFT JOIN wells w ON w.id = dc.well_id
                WHERE (dc.well_id = ANY(%s) OR dc.well_id IS NULL)
                  AND dc.embedding IS NOT NULL
                ORDER BY dc.embedding <=> %s LIMIT %s
            """, (v, list(ids), v, k)).fetchall()
        else:
            return c.execute("""
                SELECT dc.id, dc.well_id, w.well_name, dc.page, dc.text, dc.document_id,
                       1 - (dc.embedding <=> %s) AS sim
                FROM document_chunks dc
                LEFT JOIN wells w ON w.id = dc.well_id
                WHERE dc.embedding IS NOT NULL
                ORDER BY dc.embedding <=> %s LIMIT %s
            """, (v, v, k)).fetchall()