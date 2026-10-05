import os
from psycopg.types.json import Jsonb
from ..db import conn
from ..services.embeddings import embed
from .pdf_reader import read_pdf
from .chunker import chunk_page
from .entities import extract_entities
from .entity_store import save_entities
from .extractor import extract_document, score, _norm, EXTRACTOR_VERSION



def _formation_names():
    """Fetch known formation names for the entity extractor's vocabulary matcher."""
    try:
        with conn() as c:
            return [r["name"] for r in c.execute("SELECT name FROM formations").fetchall()]
    except Exception:
        return []


def ingest_pdf(path: str, well_id: str, doc_type="DDR", synthetic=True, review_threshold=0.7):
    """
    Ingest a PDF drilling report, extract text chunks and drilling events,
    generate vector embeddings, and persist cleanly into PostgreSQL schema.
    """
    with conn() as c:
        # Resolve target well and its total depth
        well_row = c.execute("""
            SELECT id, total_depth FROM wells 
            WHERE id::text = %s OR well_name = %s 
            LIMIT 1
        """, (str(well_id), str(well_id))).fetchone()

        if not well_row:
            raise ValueError(f"Well '{well_id}' not found in database")

        real_well_id = str(well_row["id"])
        td = float(well_row["total_depth"] or 3500.0)

        # Query well formation intervals with formation name
        intervals = c.execute("""
            SELECT wf.formation, wf.top_depth, wf.bottom_depth 
            FROM well_formations wf
            WHERE wf.well_id = %s
        """, (real_well_id,)).fetchall()

    def fm_lookup(d):
        if d is not None:
            for r in intervals:
                if float(r["top_depth"]) <= d < float(r["bottom_depth"]):
                    return r["formation"], r["formation"]
        return None, None

    pages = read_pdf(path)
    names = _formation_names()
    page_entities = [(p.number, p.text, extract_entities(p.text, names, p.ocr_conf))
                     for p in pages if p.text.strip()]

    events = extract_document(pages)  # LLM call for event extraction

    # Chunk pages and compute 384-dimensional vector embeddings
    chunk_rows = []
    chunk_idx = 0
    for p in pages:
        if not p.text.strip():
            continue
        chunks = chunk_page(p.text)
        for ch, vec in zip(chunks, embed(chunks)):
            chunk_rows.append((p.number, chunk_idx, ch, p.ocr_conf, vec))
            chunk_idx += 1

    # Extract event information with validated page quotes and formation mapping
    event_rows = []
    for e in events:
        page_no, page_text, ocr_conf = None, "", None
        q = _norm(e.evidence_quote)
        for p in pages:
            if q and q in _norm(p.text):
                page_no, page_text, ocr_conf = p.number, p.text, p.ocr_conf
                break
        conf = score(e, page_text, td, ocr_conf)

        # Find formation name from depth or match by name
        _, f_name = fm_lookup(e.depth_m)
        if not f_name and e.formation:
            f_name = str(e.formation)
        if not f_name:
            f_name = "Formation X"

        event_rows.append((
            e.depth_m, f_name, e.event_type, e.severity, e.description,
            e.mitigation, e.outcome, page_no, e.evidence_quote, conf,
            "auto" if conf >= review_threshold else "needs_review"
        ))

    # Persist records into PostgreSQL using official schema
    filename = os.path.basename(path)
    ocr_stat = any(p.ocr_used for p in pages)

    with conn() as c:
        # 1. Insert into documents table (matching AI DB schema)
        doc_row = c.execute("""
            INSERT INTO documents (
                well_id, doc_type, file_uri, pages, ocr_used, status
            ) VALUES (%s, %s, %s, %s, %s, 'completed')
            RETURNING id
        """, (real_well_id, doc_type, str(path), len(pages), ocr_stat)).fetchone()

        doc_id = str(doc_row["id"])

        # 2. Insert into document_chunks with embedding vector
        for page_num, idx, text, ocr_conf, vec in chunk_rows:
            vec_str = "[" + ",".join(str(float(x)) for x in vec) + "]"
            c.execute("""
                INSERT INTO document_chunks (
                    document_id, well_id, page, section, chunk_index,
                    text, confidence, embedding
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
            """, (doc_id, real_well_id, page_num, "operations_summary", idx, text, ocr_conf, vec_str))

        # 3. Insert into drilling_events table
        for (depth, fm_name, et, sev, desc, mit, out, page_num, quote, conf, status) in event_rows:
            event_row = c.execute("""
                INSERT INTO drilling_events (
                    well_id, formation, depth, event_type, severity,
                    description, mitigation, outcome, origin, document_id,
                    page, evidence_quote, confidence, review_status, extractor_version
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                real_well_id, fm_name, depth or 0.0, et, sev,
                desc, str(mit) if mit else "Monitored", str(out) if out else "Resolved",
                "extracted", doc_id, page_num, quote, conf, status, EXTRACTOR_VERSION
            )).fetchone()

        # 4. Save extracted entities into extracted_entities table (gracefully skip if table missing)
        n_entities = 0
        try:
            n_entities = save_entities(c, doc_id, real_well_id, page_entities)
        except Exception as err:
            print(f"  Note: save_entities skipped ({err})")

    return doc_id, len(chunk_rows), len(event_rows), n_entities