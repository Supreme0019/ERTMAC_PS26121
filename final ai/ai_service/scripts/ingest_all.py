import sys, pathlib, argparse
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from app.db import conn
from app.documents.ingest import ingest_pdf
from app.documents.dedupe import dedupe
from app.services.llm import DailyQuotaExceeded

ap = argparse.ArgumentParser()
ap.add_argument("--limit", type=int, default=None)
ap.add_argument("--pattern", default="*.pdf")
ap.add_argument("--fresh", action="store_true", help="wipe all extraction results and start over")
args = ap.parse_args()

files = sorted(pathlib.Path("../data/reports").glob(args.pattern))

if args.fresh:
    with conn() as c:
        c.execute("DELETE FROM drilling_events WHERE origin='extracted'")
        c.execute("DELETE FROM document_chunks")
        c.execute("DELETE FROM documents")

with conn() as c:
    done = {r["file_uri"] for r in c.execute("SELECT file_uri FROM documents").fetchall()}
todo = [p for p in files if str(p) not in done]
if args.limit:
    todo = todo[:args.limit]
print(f"{len(files)} matching, {len(files) - len(todo)} already done, processing {len(todo)}")

failed = []
for p in todo:
    wid = p.name.split("_")[0]
    try:
        doc_id, n_chunks, n_events = ingest_pdf(str(p), wid)
        print(f"{p.name}: {n_chunks} chunks, {n_events} events")
    except DailyQuotaExceeded as e:
        print(f"STOPPED: daily quota reached ({e}). Re-run later; finished files are skipped.")
        break
    except Exception as e:
        failed.append(p.name)
        print(f"FAILED {p.name}: {e}")

print("duplicates removed:", dedupe())
if failed:
    print("failed files:", failed)