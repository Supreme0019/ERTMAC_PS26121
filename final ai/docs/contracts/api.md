# NWIS AI Service: API contract

Base URL (local): `http://localhost:8001`. Interactive docs: `/docs`. All JSON unless noted.
This file describes what the service actually returns. If the code changes, update this file in the same commit.

## GET /health
`{"ok": true}`

## GET /wells/{well_id}/similar
Query: `depth` (m, required), `formation` (required), `radius_km` (default 10), `top_n` (default 5), `event_type` (optional focus, e.g. `mud_loss`).

```json
{"well_id": "WELL-A-102",
 "results": [{"well_id": "SYN-045", "distance_km": 3.2, "score": 0.81,
              "factors": {"proximity": 0.52, "formation": 1.0, "depth_overlap": 1.0, "trajectory": 0.9,
                          "parameters": null, "events": 1.0, "completeness": 0.7}}]}
```
`score` is 0 to 1 and `factors` explains it. `parameters` is `null` when it could not be computed (that factor is then left out of the score).

## GET /risks/{well_id}
Query: `depth`, `formation`, `radius_km` (default 10). Historical evidence only (no live window), so the `anomaly` component is 0.

```json
{"well_id": "WELL-A-102", "depth": 2850, "formation": "Formation X", "alerts": [ <risk alert> ]}
```
`alerts` is sorted by score (highest first) and may be empty. The risk alert format is defined in `risk-schema.json`.

## POST /assistant/query
Body: `{"question": "...", "well_id": "WELL-A-102", "radius_km": 10}`

```json
{"answer": "... [E21] ...", "grounded": true,
 "sources": [{"id": "E21", "type": "event", "well_id": "SYN-045", "depth": 2841, "event_type": "mud_loss",
              "doc": "..\\data\\reports\\SYN-045_ddr.pdf", "page": 3, "quote": "..."},
             {"id": "C55", "type": "chunk", "well_id": "SYN-045", "document_id": 7, "page": 3}]}
```
`grounded: false` means the retrieved records did not support an answer: `answer` is then a refusal message and `sources` is empty. `doc`, `page` and `quote` are `null` for events that came from structured records. HTTP 503 when the LLM quota is used up.

## POST /documents/ingest
Multipart form: `file` (PDF), `well_id`, `doc_type` (default `DDR`), `synthetic` (default `false`).

```json
{"document_id": 7, "chunks": 9, "events_extracted": 2, "entities_extracted": 41, "duplicates_removed": 1}
```
404 if the well is unknown; 503 if the LLM quota is used up.

## GET /documents/{document_id}/entities
Named entities extracted from one document, for the "View Entities" panel. Optional query: `entity_type`, `page`.
Extraction is rule-based (no LLM), so every ingested document has entities.

```json
{"document_id": 7, "total": 41, "counts": {"depth": 3, "formation": 2, "equipment": 9},
 "entities": [{"id": 1, "document_id": 7, "well_id": "SYN-045", "page": 3, "entity_type": "depth", "value": "2841",
               "unit": "m", "text": "2,841 m", "snippet": "At 2,841 m a partial loss ...", "confidence": 0.95,
               "source_location": "p3:100-107", "start_char": 100, "end_char": 107}]}
```
`entity_type` is one of: `well_id`, `depth`, `depth_interval`, `formation`, `mud_weight`, `pressure`, `flow_rate`, `volume`, `load`, `equipment`, `material`, `event_mention`, `date`. `value` is normalised (depth in metres, `event_mention` as `mud_loss` etc.). `start_char`/`end_char` are offsets inside that page's text, and `source_location` is `p<page>:<start>-<end>`. Columns that do not exist in the shared table are simply not returned, so check the table with `scripts/db_inspect.py`.

## POST /search
Body: `{"query": "...", "well_id": "WELL-A-102", "depth_from": 2750, "depth_to": 2900, "event_type": "mud_loss", "radius_km": 10, "k": 8}` (only `query` is required).

```json
{"events": [{"id": 17, "well_id": "SYN-028", "depth": 2774, "formation": "Formation X", "event_type": "mud_loss",
             "severity": "low", "mitigation": "...", "file_uri": null, "page": null, "evidence_quote": null}],
 "chunks": [{"id": 55, "well_id": "SYN-045", "page": 3, "document_id": 7, "sim": 0.74, "text": "first 500 characters"}]}
```
`events` are structured matches. `chunks` are semantic matches from report text.

## WS /realtime/{well_id}
Query: `speed` (default 1.0; 20 = 20x faster), `radius_km`, `every` (evaluate risk every N ticks, default 5), `start_depth`.
Replays `data/synthetic/active_replay.csv` (the demo well WELL-A-102). One JSON message per tick:

```json
{"state": {"well_id": "WELL-A-102", "ts": "2026-09-30 02:46:06", "depth": 2850, "formation": "Formation X",
           "rop": 22.1, "wob": 12.9, "rpm": 119.7, "torque": 23.9, "pressure": 2985.0, "mud_flow": 790.2, "mud_loss": 18.4},
 "risks": null}
```
`risks` is `null` on ticks where risk was not evaluated, otherwise a list of risk alerts. An alert carries `"new": true` on the tick where it first appears or its `risk_level` changes. The stream ends with `{"done": true}`. A real eRTMAC source would implement the same `stream()` interface as `ReplaySource`.
