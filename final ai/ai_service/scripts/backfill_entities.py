"""Extract entities for documents that are ALREADY ingested, without any LLM call
(re-reads each PDF, OCR for scans, then rule-based NER). Run from ai_service/:
    python scripts/backfill_entities.py            # only documents that have no entities yet
    python scripts/backfill_entities.py --force    # redo every document
"""
import sys, pathlib, argparse
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from app.config import DATA_DIR
from app.db import conn
from app.documents.entities import extract_entities
from app.documents.entity_store import save_entities, table_columns, plan_insert
from app.documents.pdf_reader import read_pdf

ap = argparse.ArgumentParser()
ap.add_argument("--force", action="store_true")
args = ap.parse_args()


def resolve(uri: str):
    p = pathlib.Path(uri.replace("\\", "/"))
    for cand in (p, pathlib.Path.cwd() / p, DATA_DIR / "reports" / p.name, DATA_DIR / "uploads" / p.name):
        if cand.exists():
            return cand
    return None


with conn() as c:
    plan_insert(table_columns(c))                       # fails early with a clear message if the table is unusable
    docs = c.execute("SELECT id, well_id, file_uri FROM documents ORDER BY id").fetchall()
    have = {r["document_id"] for r in c.execute("SELECT DISTINCT document_id FROM extracted_entities").fetchall()}
    names = [r["name"] for r in c.execute("SELECT name FROM formations").fetchall()]

total = 0
for d in docs:
    if d["id"] in have and not args.force:
        continue
    path = resolve(d["file_uri"])
    if path is None:
        print(f"skip document {d['id']}: file not found ({d['file_uri']})")
        continue
    pages = read_pdf(str(path))
    page_entities = [(p.number, p.text, extract_entities(p.text, names, p.ocr_conf)) for p in pages if p.text.strip()]
    with conn() as c:
        if d["id"] in have:
            c.execute("DELETE FROM extracted_entities WHERE document_id=%s", (d["id"],))
        n = save_entities(c, d["id"], d["well_id"], page_entities)
    total += n
    print(f"document {d['id']} ({path.name}): {n} entities")
print("entities written:", total)
