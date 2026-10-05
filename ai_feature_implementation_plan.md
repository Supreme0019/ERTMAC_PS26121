# Implementation Plan: Make Every AI Feature Work

## Strategy

> [!IMPORTANT]
> **All AI features use the AI database (`ep-rough-forest-...`) as their source of truth.** The Node.js backend will be modified to:
> 1. Pass `well_name` alongside `well_id` to the AI service (so the AI service can resolve wells in its own DB)
> 2. Trust AI service responses and stop falling back to broken Node calculations when the AI service is healthy
> 3. Forward the AI service's own well IDs in responses instead of translating them

---

## Feature Inventory

| # | Feature | AI Endpoint | AI DB Tables Used | Status |
|---|---|---|---|---|
| 1 | **Similarity Engine** | `POST /api/similarity/compute` | `wells`, `well_formations`, `drilling_parameters`, `drilling_events`, `documents` | ⚠️ Broken: UUID mismatch |
| 2 | **Risk Engine** | `POST /api/risk/evaluate` | `wells`, `well_formations`, `drilling_events`, `documents` + similarity engine | ⚠️ Broken: UUID mismatch |
| 3 | **AI Replay (WebSocket)** | `WS /realtime/{well_id}` | `wells`, `risk_predictions` (write) + risk engine + CSV replay data | ⚠️ Broken: UUID mismatch + connection close |
| 4 | **RAG Assistant** | `POST /assistant/query` | `wells`, `drilling_events`, `document_chunks` (vector search) | ⚠️ Broken: UUID mismatch |
| 5 | **Vector Search** | `POST /search` | `wells`, `drilling_events`, `document_chunks` | ⚠️ Broken: UUID mismatch |
| 6 | **Document Ingestion** | `POST /documents/ingest` | `wells`, `formations`, `well_formations`, `documents`, `document_chunks`, `drilling_events`, `extracted_entities` | ❌ Broken: code bugs + schema mismatch |
| 7 | **Entity Extraction** | `GET /documents/{id}/entities` | `extracted_entities` | ⚠️ Works if table exists |
| 8 | **ML Model Prediction** | `GET /ml/risk/{wellId}` | None (uses CSV file + joblib model) | ✅ Works (demo-only for WELL-A-102) |

---

## Phase 1: Fix the Well ID Resolution Problem (All Features)

### Problem
The backend sends UUIDs like `c0000000-0000-0000-0000-000000000000` to the AI service, but the AI DB has different UUIDs for the same wells. Every AI engine already has fallback logic that resolves by `well_name`, but the backend never sends the `well_name`.

### Fix 1A: Backend sends `well_name` in AI client calls

**File:** [ai.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/config/ai.js)

```diff
  async computeSimilarity(referenceWell, candidateWells = [], options = {}) {
    const wellId = referenceWell?.id || options.wellId || 'b1000000-0000-0000-0000-000000000001';
+   const wellName = referenceWell?.well_name || options.wellName || null;
    const depth = options.depth || referenceWell?.current_depth || 2850.0;
    const formation = options.formation || referenceWell?.current_formation_name || 'Kopili';

    return aiRequest('POST', '/api/similarity/compute', {
      well_id: wellId,
+     well_name: wellName,
      reference_well: referenceWell,
      ...
    });
  },

  async evaluateRisk(wellData, historicalEvents = [], options = {}) {
    const wellId = wellData?.id || options.wellId || 'b1000000-0000-0000-0000-000000000001';
+   const wellName = wellData?.well_name || options.wellName || null;
    ...
    return aiRequest('POST', '/api/risk/evaluate', {
      well_id: wellId,
+     well_name: wellName,
      well_data: wellData,
      ...
    });
  },

  async ragQuery(question, context = {}) {
    const wellId = context.wellId || context.well_id || 'b1000000-0000-0000-0000-000000000001';
+   const wellName = context.wellName || context.well_name || null;
    return aiRequest('POST', '/assistant/query', {
      question,
      well_id: wellId,
+     well_name: wellName,
      ...
    });
  },

  async vectorSearch(query, { wellId, wellName, limit = 8, ... } = {}) {
    return aiRequest('POST', '/search', {
      ...
      well_id: wellId || null,
+     well_name: wellName || null,
      ...
    });
  },
```

### Fix 1B: AI service routers accept `well_name` and resolve it

**All AI routers** already query the DB with `WHERE id::text = %s OR well_name = %s`. The routers just need to pass `well_name` through.

**File:** [similar.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/similar.py)

```diff
 class SimilarityQuery(BaseModel):
     well_id: Optional[str] = None
+    well_name: Optional[str] = None
     ...

 @router.post("/api/similarity/compute")
 def post_similar(body: SimilarityQuery, well_id: Optional[str] = None):
     target_id = well_id or body.well_id
     if not target_id and body.reference_well:
         target_id = body.reference_well.get("id") or body.reference_well.get("well_id")
+    # If target_id doesn't resolve, try well_name
+    if not target_id:
+        target_id = body.well_name
+    if not target_id and body.reference_well:
+        target_id = body.reference_well.get("well_name")
```

**File:** [risk.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/risk.py)

```diff
 class RiskQuery(BaseModel):
     well_id: Optional[str] = None
+    well_name: Optional[str] = None
     ...

 @router.post("/api/risk/evaluate")
 def post_risks(body: RiskQuery, well_id: Optional[str] = None):
     target_id = well_id or body.well_id
     if not target_id and body.well_data:
         target_id = body.well_data.get("id")
+    if not target_id:
+        target_id = body.well_name
+    if not target_id and body.well_data:
+        target_id = body.well_data.get("well_name")
```

**File:** [assistant.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/assistant.py)

```diff
 class Query(BaseModel):
     question: str
     well_id: Optional[str] = "b1000000-0000-0000-0000-000000000001"
+    well_name: Optional[str] = None
     ...

 @router.post("/assistant/query")
 def query(body: Query):
     target_well = body.well_id
     if not target_well and body.context and body.context.get("well"):
         target_well = body.context["well"].get("id")
+    if not target_well:
+        target_well = body.well_name
     ...
```

**File:** [search.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/search.py)

```diff
 class SearchQuery(BaseModel):
     ...
     well_id: Optional[str] = None
+    well_name: Optional[str] = None
     ...

 @router.post("/search")
 def search(q: SearchQuery):
     ...
     if q.well_id:
         ids = nearby_ids(q.well_id, q.radius_km)
+    elif q.well_name:
+        ids = nearby_ids(q.well_name, q.radius_km)
     else:
         ...
```

### Fix 1C: Backend services pass `well_name` when calling AI

**File:** [similarity.service.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/services/similarity.service.js) (line 41)

```diff
    const aiResult = await aiClient.computeSimilarity(refWell, [], {
      wellId: referenceWellId,
+     wellName: refWell.well_name,
      depth: refWell.current_depth,
      formation: refWell.current_formation_name,
      radiusKm,
      limit,
    });
```

**File:** [risk.service.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/services/risk.service.js) (line 274)

```diff
    const aiResult = await aiClient.evaluateRisk(well, [], {
      wellId,
+     wellName: well.well_name,
      depth: currentDepth,
      formation: well.current_formation_name,
      radiusKm: 15,
    });
```

**File:** [nearbyWell.service.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/services/nearbyWell.service.js) (line 201)

```diff
    const simResult = await aiClient.computeSimilarity(well, [], {
      wellId,
+     wellName: well.well_name,
      radiusKm,
      limit: 50,
    });
```

---

## Phase 2: Fix AI Replay WebSocket

### Problem
The frontend connects to `ws://localhost:8000/realtime/{wellId}` with the **backend's UUID**. The AI service's [realtime.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/realtime.py) passes this UUID to the risk engine and `_persist()`, which fails to find the well.

### Fix 2A: Resolve `well_id` at the start of the WebSocket handler

**File:** [realtime.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/realtime.py)

```diff
 @router.websocket("/realtime/{well_id}")
 async def realtime(ws: WebSocket, well_id: str, speed: float = 1.0, ...):
     await ws.accept()
+    # Resolve well_id to a valid UUID in the AI database
+    resolved_id = well_id
+    try:
+        with conn() as c:
+            row = c.execute(
+                "SELECT id, well_name FROM wells WHERE id::text = %s OR well_name = %s LIMIT 1",
+                (str(well_id), str(well_id))
+            ).fetchone()
+            if row:
+                resolved_id = str(row["id"])
+    except Exception:
+        pass
+
     buf, last = [], {}
     latest_risks = None
     evaluating = False

     async def run_evaluation(current_row, recent_df):
         nonlocal latest_risks, evaluating
         try:
-            r = await asyncio.to_thread(evaluate, well_id, ...)
+            r = await asyncio.to_thread(evaluate, resolved_id, ...)
             for a in r:
                 ...
-                    await asyncio.to_thread(_persist, well_id, ...)
+                    await asyncio.to_thread(_persist, resolved_id, ...)
```

### Fix 2B: Add `risk_level` column to AI DB `risk_predictions` table

The `_persist` function writes `risk_level` but the [001_schema.sql](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/db/init/001_schema.sql) doesn't have it.

**Migration to run:**
```sql
ALTER TABLE risk_predictions ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE risk_predictions ADD COLUMN IF NOT EXISTS model_version TEXT;
```

---

## Phase 3: Fix Document Ingestion (2 Bugs)

### Bug 3A: Undefined `formation_by_name` variable

**File:** [ingest.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/documents/ingest.py), line 87

`formation_by_name` is referenced but never defined. This causes a `NameError` crash.

```diff
+    # Build formation name lookup
+    formation_by_name = {}
+    for r in intervals:
+        formation_by_name[str(r["formation"]).lower()] = r["formation"]
+
     def fm_lookup(d):
         ...
```

### Bug 3B: Undefined `fm_name` variable

Line 138 uses `fm_name` but the loop variable is `fm_id`.

```diff
-                real_well_id, fm_name, depth or 0.0, et, sev,
+                real_well_id, fm_id, depth or 0.0, et, sev,
```

### Bug 3C: Schema mismatch in document INSERT

The AI DB `documents` table has columns `doc_type, file_uri, pages, ocr_used` but the INSERT uses `document_type, original_filename, file_uri, page_count, ocr_status, processing_status`. Fix the INSERT to match the AI DB schema.

```diff
-        doc_row = c.execute("""
-            INSERT INTO documents (
-                well_id, document_type, original_filename, file_uri,
-                page_count, ocr_status, processing_status
-            ) VALUES (%s, %s, %s, %s, %s, %s, 'completed')
-            RETURNING id
-        """, (real_well_id, doc_type, filename, str(path), len(pages), ocr_stat)).fetchone()
+        doc_row = c.execute("""
+            INSERT INTO documents (
+                well_id, doc_type, file_uri, pages, ocr_used
+            ) VALUES (%s, %s, %s, %s, %s)
+            RETURNING id
+        """, (real_well_id, doc_type, str(path), len(pages),
+              any(p.ocr_used for p in pages))).fetchone()
```

### Bug 3D: Schema mismatch in document_chunks INSERT

The AI DB `document_chunks` has `section, text, ocr_confidence, embedding` but the INSERT uses `chunk_index, confidence`.

```diff
-            c.execute("""
-                INSERT INTO document_chunks (
-                    document_id, well_id, page, section, chunk_index,
-                    text, confidence, embedding
-                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
-            """, (doc_id, real_well_id, page_num, "operations_summary", idx, text, ocr_conf, vec_str))
+            c.execute("""
+                INSERT INTO document_chunks (
+                    document_id, well_id, page, section,
+                    text, ocr_confidence, embedding
+                ) VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
+            """, (doc_id, real_well_id, page_num, "operations_summary", text, ocr_conf, vec_str))
```

---

## Phase 4: Fix the Frontend WebSocket Well ID

### Problem
The frontend sends the backend DB's UUID to the AI WebSocket. The AI service should receive `well_name` instead (or in addition).

### Fix 4A: Frontend sends `well_name` as a WebSocket query parameter

**File:** [useAIReplay.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-frontend/src/hooks/useAIReplay.js)

The hook receives `wellId` from the parent component. We also need the `wellName`. The simplest fix is to accept `wellName` in options:

```diff
-export default function useAIReplay(wellId, options = {}) {
+export default function useAIReplay(wellId, options = {}) {
   const {
     speed = 1.0,
     radiusKm = 10,
     every = 5,
     startDepth = null,
     autoConnect = false,
+    wellName = null,
   } = options;
```

Then in the URL construction:

```diff
-    const url = `${aiWsUrl}/realtime/${encodeURIComponent(wellId)}?${params.toString()}`;
+    // Send well_name as the path param if available (AI DB resolves by name)
+    const replayId = wellName || wellId;
+    const url = `${aiWsUrl}/realtime/${encodeURIComponent(replayId)}?${params.toString()}`;
```

### Fix 4B: WellDetail passes `well_name` to the hook

**File:** [WellDetail.jsx](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-frontend/src/pages/WellDetail.jsx)

Find where `useAIReplay` is called and add `wellName`:

```diff
  const replay = useAIReplay(activeWell?.id, {
    speed: replaySpeed,
    startDepth: activeWell?.current_depth_m,
+   wellName: activeWell?.well_name,
  });
```

---

## Phase 5: Backend Dashboard Uses AI Service Data for AI Features

### Current Problem
The [dashboard.controller.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/controllers/dashboard.controller.js) `getWellDashboard` calls `similarityService` and `riskService` which **first try the AI service** and then fall back to querying the **backend DB**. The fallback results have different data than the AI service.

### Fix
The fallback is fine as a safety net, but the services already correctly try the AI service first. With Phase 1 fixes (sending `well_name`), the AI service will be able to resolve wells and return correct data. No additional changes needed here — the existing try/catch fallback pattern is correct.

---

## Phase 6: Verify/Fix AI DB Schema Completeness

### Run this migration against the AI database

```sql
-- Ensure all required columns exist
ALTER TABLE risk_predictions ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE risk_predictions ADD COLUMN IF NOT EXISTS model_version TEXT;

-- Ensure extracted_entities table exists
CREATE TABLE IF NOT EXISTS extracted_entities (
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES documents(id) ON DELETE CASCADE,
  well_id TEXT,
  page INT,
  entity_type TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  text TEXT,
  snippet TEXT,
  confidence REAL,
  source_location TEXT,
  start_char INT,
  end_char INT
);
CREATE INDEX IF NOT EXISTS ent_doc ON extracted_entities (document_id);
CREATE INDEX IF NOT EXISTS ent_type ON extracted_entities (entity_type);
```

---

## Complete Change List

### Files to modify in `final ai/ai_service/app/`:

| File | Changes |
|---|---|
| [routers/similar.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/similar.py) | Add `well_name` to `SimilarityQuery`, use it as fallback ID |
| [routers/risk.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/risk.py) | Add `well_name` to `RiskQuery`, use it as fallback ID |
| [routers/assistant.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/assistant.py) | Add `well_name` to `Query`, use it as fallback |
| [routers/search.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/search.py) | Add `well_name` to `SearchQuery`, use it as fallback |
| [routers/realtime.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/routers/realtime.py) | Resolve `well_id` to AI DB UUID at WebSocket connect |
| [documents/ingest.py](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/final%20ai/ai_service/app/documents/ingest.py) | Fix `formation_by_name` NameError, fix `fm_name` → `fm_id`, fix document INSERT schema, fix chunks INSERT schema |

### Files to modify in `eRTMAC-NWIS-Final/Wells/nwis-backend/src/`:

| File | Changes |
|---|---|
| [config/ai.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/config/ai.js) | Add `well_name` to all AI request payloads (similarity, risk, RAG, search) |
| [services/similarity.service.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/services/similarity.service.js) | Pass `wellName` in AI client call options |
| [services/risk.service.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/services/risk.service.js) | Pass `wellName` in AI client call options |
| [services/nearbyWell.service.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-backend/src/services/nearbyWell.service.js) | Pass `wellName` in AI client call options |

### Files to modify in `eRTMAC-NWIS-Final/Wells/nwis-frontend/src/`:

| File | Changes |
|---|---|
| [hooks/useAIReplay.js](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-frontend/src/hooks/useAIReplay.js) | Accept `wellName` option, use it in WebSocket URL path |
| [pages/WellDetail.jsx](file:///c:/Users/amanm/Desktop/New%20folder/sih%202nd%20oil%20well%20-%20Copy/eRTMAC-NWIS-Final/Wells/nwis-frontend/src/pages/WellDetail.jsx) | Pass `wellName` to `useAIReplay` |

### SQL migration to run on AI database:

```sql
ALTER TABLE risk_predictions ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE risk_predictions ADD COLUMN IF NOT EXISTS model_version TEXT;
CREATE TABLE IF NOT EXISTS extracted_entities (...);
```

---

## Execution Order

1. **Phase 6** — Run SQL migration on AI DB (prerequisite)
2. **Phase 3** — Fix ingest.py bugs (independent, blocks nothing)
3. **Phase 1** — Backend sends `well_name` + AI routers accept it (core fix)
4. **Phase 2** — Fix AI Replay well ID resolution
5. **Phase 4** — Frontend sends `well_name` for WebSocket
6. **Phase 5** — Verify end-to-end (no code changes, just testing)

---

## What Each Feature Will Do After Fixes

| Feature | How It Works |
|---|---|
| **Similarity** | Backend sends `well_name` → AI service finds the well in AI DB → queries `wells`, `well_formations`, `drilling_parameters`, `drilling_events` from AI DB → returns scored similar wells |
| **Risk Analysis** | Backend sends `well_name` → AI service resolves well → finds similar offset wells → queries historical events → scores risk by depth/formation correlation |
| **AI Replay** | Frontend connects with `well_name` → AI service resolves to AI DB UUID → streams CSV replay data → runs risk evaluation using AI DB data → persists predictions to AI DB |
| **RAG Assistant** | Backend sends `well_name` → AI service resolves → finds nearby wells → retrieves events + vector-searches document chunks → LLM generates cited answer |
| **Vector Search** | Backend sends `well_name` → AI service resolves → runs pgvector cosine similarity on `document_chunks.embedding` → returns ranked results |
| **Document Ingest** | Receives PDF + `well_id` → resolves to AI DB well → extracts text (OCR if needed) → LLM extracts events → generates 384-dim embeddings → persists all to AI DB |
| **Entity Extraction** | Rule-based NER on document text → persists to `extracted_entities` in AI DB → queryable via API |
| **ML Prediction** | Reads from local CSV replay file + joblib model → returns probability (demo well only, no DB needed) |
