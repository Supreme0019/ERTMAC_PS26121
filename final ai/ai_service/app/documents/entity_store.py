"""Write extracted entities into the `extracted_entities` table, adapting to the columns that
really exist (the table may have been created by the backend schema or by our migration)."""
from psycopg.types.json import Jsonb

FIELDS = ("document_id", "well_id", "page", "entity_type", "value", "unit", "text", "snippet",
          "confidence", "source_location", "start_char", "end_char")
ALIASES = {"entity_value": "value", "extracted_value": "value", "entity_text": "text", "raw_text": "text",
           "page_number": "page", "source_page": "page", "score": "confidence", "entity_confidence": "confidence",
           "location": "source_location", "context": "snippet"}


def table_columns(c) -> dict:
    rows = c.execute("""SELECT column_name, data_type, is_nullable, column_default, is_identity
                        FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = 'extracted_entities'""").fetchall()
    return {r["column_name"]: r for r in rows}


def plan_insert(cols: dict):
    """Pure function. Returns [(column, field, is_json)] for the columns we can fill.
    Raises RuntimeError if the table is missing or has a required column we cannot fill."""
    if not cols:
        raise RuntimeError("table extracted_entities does not exist: run "
                           "python scripts/apply_migration.py ../db/migrations/002_extracted_entities.sql")
    plan, missing = [], []
    for name, info in cols.items():
        field = name if name in FIELDS else ALIASES.get(name)
        generated = name == "id" or info.get("is_identity") == "YES" or info.get("column_default") is not None
        if field:
            plan.append((name, field, info["data_type"] in ("json", "jsonb")))
        elif info["is_nullable"] == "NO" and not generated:
            missing.append(name)
    if missing:
        raise RuntimeError(f"extracted_entities has required columns this service cannot fill: {missing}")
    if not any(f == "entity_type" for _, f, _ in plan) or not any(f == "document_id" for _, f, _ in plan):
        raise RuntimeError("extracted_entities needs at least document_id and entity_type columns")
    return plan


def _snippet(text, e, width=40):
    return text[max(0, e.start - width):e.end + width].replace("\n", " ").strip()


def save_entities(c, doc_id, well_id, page_entities) -> int:
    """page_entities: list of (page_number, page_text, [Entity]). Uses the caller's connection."""
    plan = plan_insert(table_columns(c))
    cols = ", ".join(f'"{col}"' for col, _, _ in plan)
    marks = ", ".join(["%s"] * len(plan))
    rows = []
    for page, text, entities in page_entities:
        for e in entities:
            row = dict(document_id=doc_id, well_id=well_id, page=page, entity_type=e.entity_type, value=e.value,
                       unit=e.unit, text=e.text, snippet=_snippet(text, e), confidence=e.confidence,
                       source_location=f"p{page}:{e.start}-{e.end}", start_char=e.start, end_char=e.end)
            vals = []
            for _, field, is_json in plan:
                v = row[field]
                if is_json and field == "source_location":
                    v = Jsonb({"page": page, "start": e.start, "end": e.end})
                elif is_json:
                    v = Jsonb(v)
                vals.append(v)
            rows.append(vals)
    if rows:
        with c.cursor() as cur:
            cur.executemany(f"INSERT INTO extracted_entities ({cols}) VALUES ({marks})", rows)
    return len(rows)
