import os
import psycopg

url = os.environ.get('DATABASE_URL', 'postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-mode-azhu0msn-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')

with psycopg.connect(url) as conn:
    with conn.cursor() as cur:
        for t in ['wells', 'well_formations', 'formations', 'drilling_parameters', 'drilling_events', 'mitigations', 'documents', 'document_chunks']:
            cur.execute("""SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s ORDER BY ordinal_position""", (t,))
            cols = cur.fetchall()
            print(f'=== {t} ===')
            for c in cols:
                print(f'  {c[0]} ({c[1]})')
