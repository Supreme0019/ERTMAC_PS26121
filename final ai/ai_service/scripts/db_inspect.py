"""Print every table in the database with its row count and columns, so teammates can compare schemas.
Run from ai_service/:  python scripts/db_inspect.py     (read-only; the password is never printed)"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import psycopg
from app.config import settings

with psycopg.connect(settings.database_url) as c:
    host = settings.database_url.split("@")[-1].split("/")[0]
    print("database host:", host, "| schemas with tables:",
          [r[0] for r in c.execute("SELECT DISTINCT table_schema FROM information_schema.tables "
                                   "WHERE table_schema NOT IN ('pg_catalog','information_schema')").fetchall()])
    tables = c.execute("""SELECT table_schema, table_name FROM information_schema.tables
                          WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')
                          ORDER BY 1, 2""").fetchall()
    for schema, name in tables:
        n = c.execute(f'SELECT count(*) FROM "{schema}"."{name}"').fetchone()[0]
        cols = c.execute("""SELECT column_name, data_type FROM information_schema.columns
                            WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position""", (schema, name)).fetchall()
        print(f"\n{schema}.{name}  ({n} rows)")
        print("   " + ", ".join(f"{a}:{b}" for a, b in cols))
