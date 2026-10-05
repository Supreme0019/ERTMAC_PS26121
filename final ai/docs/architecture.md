# Architecture (AI/ML service)

```
WCR/DDR PDFs ──► pdf_reader (text, OCR fallback) ──► chunker ──► embeddings ──► document_chunks (pgvector)
                                   ├──► rule-based NER (depths, formations, mud weight, equipment, ...) ──► extracted_entities
                                   └──► keyword filter ──► LLM extraction (1 call per document) ──► drilling_events
Well master, formations, drilling data ──► PostgreSQL + PostGIS
                                   │
        similarity engine (7 weighted factors) ◄── nearby wells (ST_DWithin)
                │
        risk engine (formation-relative depth correlation + live anomaly + weighted score)
                │                                   │
        RAG assistant (events + chunks, cited)      replay adapter ──► WebSocket /realtime
                └──────────────► FastAPI ◄──────────┘
```

## Design decisions
- **Evidence first.** Every extracted event keeps `document_id`, `page` and a verbatim `evidence_quote`. Extraction confidence is lowered when the quote is not found on the page, when the depth is impossible for the well, and when OCR confidence is low. Low-confidence rows get `review_status = needs_review`.
- **Formation-relative depth.** A historical event is mapped onto the active well by its depth below the top of the formation, because formation tops differ from well to well.
- **Transparent rules.** The risk score is a weighted sum (depth overlap 25, formation 20, similar well 15, repeated event 20, current anomaly 15, proximity 5) with the breakdown returned. It is a contextual indicator, not a probability.
- **Grounded assistant.** The assistant only sees retrieved records, must cite them, and every citation is checked against what was retrieved. Otherwise it refuses.
- **Adapter boundary.** `ReplaySource` and a future authorised eRTMAC source expose the same `stream()`; nothing downstream changes.
- **Quota-aware ingestion.** One LLM call per document, routine pages dropped by keyword filter, resumable runs, fail-fast on daily quota.

## Not built on purpose
A full eRTMAC replacement, a physics-based drilling simulator, deep-learning models trained from scratch, and any autonomous drilling instruction. NWIS is decision support only.
