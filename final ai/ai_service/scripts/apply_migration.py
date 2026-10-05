"""Run one SQL file against the database:  python scripts/apply_migration.py ../db/migrations/002_extracted_entities.sql"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import psycopg
from app.config import settings

sql = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
with psycopg.connect(settings.database_url, autocommit=True) as c:
    c.execute(sql)
print("applied", sys.argv[1])
