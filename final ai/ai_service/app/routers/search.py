from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from ..db import conn
from ..rag.retriever import nearby_ids, get_events, get_chunks

router = APIRouter()


class SearchQuery(BaseModel):
    query: Optional[str] = ""
    q: Optional[str] = ""
    well_id: Optional[str] = None
    depth_from: Optional[float] = None
    depth_to: Optional[float] = None
    event_type: Optional[str] = None
    radius_km: float = 15.0
    k: Optional[int] = 8
    limit: Optional[int] = None


@router.post("/search")
@router.post("/api/search/vector")
def search(q: SearchQuery):
    search_str = q.query or q.q or "drilling operation"
    limit_k = q.limit or q.k or 8

    if q.well_id:
        ids = nearby_ids(q.well_id, q.radius_km)
    else:
        with conn() as c:
            ids = [str(r["id"]) for r in c.execute("SELECT id FROM wells LIMIT 20").fetchall()]

    f = {"types": [q.event_type] if q.event_type else []}
    if q.depth_from is not None and q.depth_to is not None:
        f["from"], f["to"] = q.depth_from, q.depth_to

    events = get_events(ids, f, limit=limit_k) if ids else []
    chunks = get_chunks(ids, search_str, k=limit_k) if ids else []

    formatted_chunks = []
    for c in chunks:
        formatted_chunks.append({
            "id": str(c["id"]),
            "well_id": str(c["well_id"]) if c["well_id"] else None,
            "well_name": c.get("well_name") or "Basin Document",
            "page": c.get("page", 1),
            "sim": round(float(c.get("sim", 0.0)), 4),
            "similarity": round(float(c.get("sim", 0.0)), 4),
            "text": (c.get("text") or "")[:500],
            "document_id": str(c.get("document_id")) if c.get("document_id") else None,
        })

    formatted_events = []
    for e in events:
        formatted_events.append({
            "id": str(e["id"]),
            "well_id": str(e["well_id"]),
            "well_name": e.get("well_name") or "Offset Well",
            "depth": float(e["depth"]) if e.get("depth") is not None else None,
            "event_type": e.get("event_type"),
            "severity": e.get("severity"),
            "formation": e.get("formation"),
            "mitigation": e.get("mitigation"),
            "description": e.get("description"),
            "doc": e.get("file_uri"),
        })

    return {
        "events": formatted_events,
        "chunks": formatted_chunks,
        "results": formatted_chunks + formatted_events,
        "total": len(formatted_chunks) + len(formatted_events),
    }