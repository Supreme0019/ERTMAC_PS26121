import os
import psycopg
from pgvector.psycopg import register_vector
from app.services.embeddings import embed

url = os.environ.get('DATABASE_URL', 'postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-mode-azhu0msn-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')

query = "stuck pipe in Barail formation"
v = embed([query], query=True)[0]

with psycopg.connect(url) as conn:
    register_vector(conn)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, well_id, page, substring(text from 1 for 100), 1 - (embedding <=> %s) AS sim
            FROM document_chunks
            ORDER BY embedding <=> %s
            LIMIT 5
        """, (v, v))
        rows = cur.fetchall()
        print(f"Vector search results for '{query}':")
        for r in rows:
            print(f"  sim={r[4]:.4f} | well={r[1]} | page={r[2]} | {r[3]}")
