import asyncio, pathlib, os
from fastapi import APIRouter, UploadFile, Form, File, HTTPException
from typing import Optional
from ..db import conn
from ..documents.ingest import ingest_pdf
from ..documents.dedupe import dedupe
from ..services.llm import DailyQuotaExceeded

router = APIRouter()

# Absolute path resolution for uploaded documents
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
UPLOADS = BASE_DIR / "data" / "uploads"


@router.post("/documents/ingest")
@router.post("/api/documents/process")
async def ingest(
    file: Optional[UploadFile] = File(None),
    well_id: Optional[str] = Form("b1000000-0000-0000-0000-000000000001"),
    doc_type: str = Form("DDR"),
    synthetic: bool = Form(False),
):
    target_well = well_id or "b1000000-0000-0000-0000-000000000001"
    with conn() as c:
        row = c.execute("""
            SELECT id FROM wells WHERE id::text = %s OR well_name = %s LIMIT 1
        """, (str(target_well), str(target_well))).fetchone()
        if row:
            target_well = str(row["id"])

    if not file:
        raise HTTPException(status_code=400, detail="No document file provided for ingestion")

    UPLOADS.mkdir(parents=True, exist_ok=True)
    safe_filename = pathlib.Path(file.filename).name if file.filename else "uploaded.pdf"
    path = UPLOADS / safe_filename
    path.write_bytes(await file.read())

    try:
        res = await asyncio.to_thread(
            ingest_pdf, str(path), target_well, doc_type, synthetic
        )
        if len(res) == 4:
            doc_id, n_chunks, n_events, n_entities = res
        else:
            doc_id, n_chunks, n_events = res[:3]
            n_entities = 0
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DailyQuotaExceeded as e:
        raise HTTPException(status_code=429, detail=f"LLM quota exceeded: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document ingestion failed: {e}")

    try:
        removed = await asyncio.to_thread(dedupe, target_well)
    except Exception:
        removed = 0

    return {
        "status": "completed",
        "document_id": doc_id,
        "chunks": n_chunks,
        "events_extracted": n_events,
        "entities_extracted": n_entities,
        "duplicates_removed": removed,
    }