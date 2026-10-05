from fastapi import APIRouter
from ..db import conn

router = APIRouter()


@router.get("/documents/{document_id}/entities")
def document_entities(document_id: str, entity_type: str | None = None, page: int | None = None):
    """Named entities extracted from one document (for the 'View Entities' panel)."""
    sql, args = "SELECT * FROM extracted_entities WHERE document_id::text = %s", [str(document_id)]
    if entity_type:
        sql += " AND entity_type = %s"; args.append(entity_type)
    if page is not None:
        sql += " AND page = %s"; args.append(page)
    with conn() as c:
        rows = c.execute(sql + " ORDER BY id", args).fetchall()
    counts = {}
    for r in rows:
        counts[r["entity_type"]] = counts.get(r["entity_type"], 0) + 1
    return {"document_id": document_id, "total": len(rows), "counts": counts, "entities": rows}
