import os
import psycopg
from pgvector.psycopg import register_vector
import numpy as np

url = os.environ.get('DATABASE_URL', 'postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-mode-azhu0msn-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')

well_id = 'b1000000-0000-0000-0000-000000000001'

with psycopg.connect(url) as conn:
    register_vector(conn)
    with conn.cursor() as cur:
        # 1. Test target well
        cur.execute("SELECT id, well_name, current_depth, location FROM wells WHERE id::text = %s OR well_name = %s", (well_id, well_id))
        target = cur.fetchone()
        print("Target well:", target[1], f"({target[0]}) depth={target[2]}")
        
        # 2. Test nearby wells query
        cur.execute("""
            SELECT w.id, w.well_name, ST_Distance(w.location, %s) / 1000.0 AS dist_km
            FROM wells w
            WHERE w.id <> %s AND ST_DWithin(w.location, %s, %s)
            ORDER BY dist_km
        """, (target[3], target[0], target[3], 15000.0))
        cands = cur.fetchall()
        print(f"Candidates within 15km: {len(cands)}")
        cand_ids = [c[0] for c in cands]
        
        # 3. Test formations for target and candidates
        cur.execute("""
            SELECT wf.well_id, f.name, wf.top_depth, wf.bottom_depth
            FROM well_formations wf
            JOIN formations f ON f.id = wf.formation_id
            WHERE wf.well_id = ANY(%s)
        """, ([target[0]] + cand_ids,))
        fms = cur.fetchall()
        print(f"Formations found for wells: {len(fms)}")
        
        # 4. Test drilling events
        cur.execute("""
            SELECT e.id, e.well_id, w.well_name, e.depth, e.event_type, e.severity,
                   f.name AS formation, m.action AS mitigation, d.file_uri
            FROM drilling_events e
            JOIN wells w ON w.id = e.well_id
            LEFT JOIN formations f ON f.id = e.formation_id
            LEFT JOIN mitigations m ON m.event_id = e.id
            LEFT JOIN documents d ON d.id = e.source_document_id
            WHERE e.well_id = ANY(%s)
        """, (cand_ids,))
        evs = cur.fetchall()
        print(f"Historical events in candidates: {len(evs)}")
        for e in evs[:5]:
            print(f"  [{e[2]}] {e[4]} at {e[3]}m ({e[6]}) - {e[7]}")
