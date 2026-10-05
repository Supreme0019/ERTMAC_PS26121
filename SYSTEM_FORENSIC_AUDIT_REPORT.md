# eRTMAC-NWIS: Multi-Tier Forensic Audit Report & Integration Plan
**Project:** eRTMAC-NWIS — Nearby Wells Intelligence System  
**Problem Statement:** PS 26121 (Smart India Hackathon 2026)  
**Date of Audit:** September 30, 2026  
**Audit Type:** Read-Only Forensic Architecture, Data-Source & API Alignment Audit  
**Status:** READ-ONLY COMPLETED — ZERO CODE OR WORKFLOW MODIFICATIONS APPLIED

---

## 1. Executive Summary & Architecture Topology

The eRTMAC-NWIS platform consists of three operational server tiers:
1. **Frontend Tier (Port 5173):** React 18 Single Page Application built with Vite, Tailwind-style design tokens, Leaflet GIS, Three.js 3D Digital Twin, and Recharts.
2. **Main Backend Tier (Port 4001):** Node.js / Express micro-framework providing REST endpoints, Server-Sent Events (SSE) live telemetry stream, 4-phase drilling simulator, PostGIS spatial queries, and connection to Neon PostgreSQL (`ep-cool-mode`).
3. **AI / RAG Microservice Tier (Port 8000):** Python 3.14 FastAPI service running under Uvicorn with Sentence-Transformers (`BAAI/bge-small-en-v1.5`), PyTorch, Scikit-learn, XGBoost, PyMuPDF, and Google Gemini Flash LLM.

```mermaid
flowchart TD
    subgraph Client ["Frontend Tier (localhost:5173)"]
        UI["React 18 + Vite SPA"]
        SSE_Client["EventSource SSE Listener (/api/realtime/:wellId)"]
        Axios["Axios API Client (baseURL: /api)"]
    end

    subgraph Backend ["Main Backend Tier (localhost:4001)"]
        Express["Express API Server"]
        ReplayEngine["Replay Simulation Engine (4-Phase)"]
        NodeSimilarity["7-Factor Similarity Engine (JS)"]
        NodeRisk["NWIS-Risk-v2 Rules + Physics Engine"]
        NodeRAG["Context Builder & Fallback Synthesizer"]
        AI_Client["Resilient AI HTTP Client (Circuit Breaker)"]
    end

    subgraph AIService ["AI Microservice Tier (localhost:8000)"]
        FastAPI["FastAPI / Uvicorn Server"]
        PythonSimilarity["Vector/Context Similarity Engine (NumPy)"]
        PythonRisk["Historical Anomaly & Lookahead Engine"]
        PythonRAG["Gemini 2.5/3.8 Flash Assistant Pipeline"]
        EmbeddingEngine["BAAI/bge-small-en-v1.5 Embeddings"]
        OCREngine["PyMuPDF + Tesseract Pipeline"]
    end

    subgraph DataTier ["Data Tier (Neon PostgreSQL + PostGIS)"]
        DB1[("DB 1: ep-cool-mode (Backend)")<br/>18 Tables: 11 Wells, 45 Events, 163 Entities]
        DB2[("DB 2: ep-rough-forest (AI)")<br/>11 Tables: 61 Wells, 49 Events, 44 Chunks]
    end

    UI --> Axios & SSE_Client
    Axios -->|Proxy: /api| Express
    SSE_Client -->|Proxy: /api| Express
    Express <-->|SQL Queries & Pooling| DB1
    Express -->|aiClient HTTP requests| FastAPI
    FastAPI <-->|SQL & pgvector Queries| DB2
    FastAPI <-->|API Calls| LLM["Google Gemini API"]
```

---

## 2. Port, Protocol & Environment Specifications

| Service | Host & Port | Protocols | Config File | Active Database Target | Health Check URL & Payload |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `localhost:5173` | HTTP, SSE (proxied) | `vite.config.js` | None (accesses via `/api`) | `GET /` &rarr; `HTTP 200 OK` |
| **Main Backend** | `localhost:4001` | HTTP, SSE | `nwis-backend/.env` | `ep-cool-mode-azhu0msn-pooler` (Neon) | `GET /api/health` &rarr; `{"status":"healthy","checks":{...}}` |
| **AI Server** | `localhost:8000` | HTTP, WebSocket | `eRTMAC-Smriti AI/.env` | `ep-rough-forest-b3gdcweh-pooler` (Neon) | `GET /health` &rarr; `{"ok":true}` |

### Detailed Environment Variables

#### Node Backend (`Wells/nwis-backend/.env`)
- `PORT=4001`
- `DATABASE_URL=postgresql://neondb_owner:f2f0189e...@ep-cool-mode-azhu0msn-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- `AI_SERVICE_URL=http://localhost:8000`
- `FRONTEND_URL=http://localhost:5173`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`

#### AI Microservice (`eRTMAC-Smriti AI/.env`)
- `DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-rough-forest-b3gdcweh-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- `GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE`
- `LLM_MODEL=gemini-2.5-flash`
- `EMBED_MODEL=BAAI/bge-small-en-v1.5`

---

## 3. Comprehensive Data-Source Audit Table

| FEATURE | FILE | DATA/VALUE | CURRENT SOURCE | TYPE | LIVE SOURCE AVAILABLE? | CAN SAFELY WIRE? | RECOMMENDED SOURCE | NOTES |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `Dashboard.jsx` | Total / Active / Completed wells | `dashboardAPI.getOverview()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Direct query on `wells` table in Neon DB. |
| **Dashboard** | `Dashboard.jsx` | Alert & Risk Totals | `dashboardAPI.getOverview()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Counts from `alerts` and `risk_predictions` tables. |
| **Dashboard** | `Dashboard.jsx` | Active Wells Progress Table | `active_wells` array | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Reports `NWIS-DEMO-01` and `DGB-A-201` with live depths. |
| **Dashboard** | `Dashboard.jsx` | Activity Trend Chart | `charts.activity_trend` | `DERIVED/CALCULATED` | YES | YES | `DERIVED/CALCULATED` | Aggregated 7-day SQL series with formula fallback. |
| **Dashboard** | `Dashboard.jsx` | Risk Donut Chart | `charts.risk_distribution` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Real critical/high/medium counts clamped for demo. |
| **Dashboard** | `Dashboard.jsx` | Incident Alert Feed | `incident_feed` (lines 116-144) | `FALLBACK` | YES | YES | `LIVE_DATABASE` | Falls back to 3 demo alerts if table is empty. |
| **Well Detail** | `WellDetail.jsx` | Well Identity & Formations | `dashboardAPI.getWellDashboard()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Full metadata from `wells` and `formations` tables. |
| **Well Detail** | `WellDetail.jsx` | Latest Telemetry Strip | `parametersAPI.getLatest()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Latest WOB, RPM, Torque, ROP, SPP from DB. |
| **Well Detail** | `WellDetail.jsx` | Parameter Curves | `parametersAPI.getTrends()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Real parameter histories plotted on Recharts. |
| **Well Detail** | `FormationTrack.jsx` | Stratigraphic Column | `formationsAPI.getByWell()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Top/bottom formation depths from DB. |
| **Well Detail** | `EventTimeline.jsx` | Drilling Incidents & Mitigations | `eventsAPI.getByWell()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Real events with mitigations sub-drawer. |
| **Well Detail** | `WellDetail.jsx` | Similar Wells 7-Factor Breakdown | `similarityAPI.findSimilar()` | `DERIVED/CALCULATED` | YES | YES | `DERIVED/CALCULATED` | Real-time 7-factor calculation by Node engine. |
| **Well Detail** | `WellDetail.jsx` | Active Risk Predictions | `risksAPI.getActive()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Generated by `NWIS-Risk-v2` rule engine. |
| **Nearby GIS** | `MapPage.jsx` | Active Well Location & Circle | `wellsAPI.getAll()` + slider | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Accurate PostGIS coordinates from database. |
| **Nearby GIS** | `MapPage.jsx` | Offset Wells & Spatial Buffers | `wellsAPI.nearbyByWell()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Computed via PostGIS `ST_DWithin` & `ST_Distance`. |
| **Nearby GIS** | `MapPage.jsx` | Offset Drawer Similarity & Events | Lines 397 & 441 | `FALLBACK` | YES | YES | `DERIVED/CALCULATED` | `nearbyByWell` lacks score/events; UI defaults to 85% & 2. |
| **Depth Correlation** | `DepthCorrelation.jsx` | Offset Formation Intervals | `formationsAPI.getByWell()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Real formation intervals compared side-by-side. |
| **Realtime** | `RealtimePage.jsx` | Live Telemetry Stream | `useWellRealtime()` via SSE | `LIVE_SSE` | YES | YES | `LIVE_SSE` | Real-time events broadcast from Node backend. |
| **Realtime** | `RealtimePage.jsx` | Rolling Telemetry Curves | Buffer in React state (50 pts) | `DERIVED/CALCULATED` | YES | YES | `LIVE_SSE` Buffer | Live rolling parameter curves. |
| **Realtime** | `RealtimePage.jsx` | Real-time Anomaly / Risk Alerts | `useWellRealtime()` SSE alerts | `LIVE_SSE` | YES | YES | `LIVE_SSE` | Dynamic stuck-pipe & kick alerts on depth threshold. |
| **Replay** | `ReplayControls.jsx` | 4-Phase Simulation Control | `realtimeAPI.startReplay()` | `SIMULATION/REPLAY` | N/A | **MUST REMAIN** | `SIMULATION/REPLAY` | **Must remain simulation for SIH live judging flow.** |
| **AI Assistant** | `AssistantPage.jsx` | AI Q&A Synthesis | `assistantAPI.query()` | `FALLBACK` | YES (`ai_service`) | **YES (P0)** | `LIVE_AI` via Python Gemini | Node calls `/api/rag/query` (404) &rarr; uses fallback SQL template. |
| **Documents** | `DocumentsPage.jsx` | Document Library & Status | `documentsAPI.getAll()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | 10 realistic PDF reports indexed in Neon DB. |
| **Documents** | `ChunkViewer.jsx` | Chunks & OCR Confidence | `documentsAPI.getChunks()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | 35 real text chunks with 0.92-0.98 confidence. |
| **Documents** | `EntityViewer.jsx` | Extracted Named Entities | `documentsAPI.getEntities()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | 163 entities (DEPTH, FORMATION, MUD_WEIGHT, etc.). |
| **Search** | `SearchPage.jsx` | Autocomplete Suggestions | `searchAPI.autocomplete()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Real-time prefix match across wells and formations. |
| **Search** | `SearchPage.jsx` | Keyword & Hybrid Search | `searchAPI.search()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Ranked ILIKE query across 4 tables. |
| **Search** | `SearchPage.jsx` | Vector Semantic Search | `searchAPI.vector()` | `FALLBACK` | YES (`ai_service`) | **YES (P1)** | `LIVE_AI` via Python BGE | Node calls `/api/search/vector` (404) &rarr; keyword fallback. |
| **Compare** | `ComparePage.jsx` | Multi-Well Comparison Matrix | `compareAPI.compare()` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Real multi-well PostGIS matrix. |
| **Analytics** | `AnalyticsPage.jsx` | Performance, NPT, Backtest | `analyticsAPI.*` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Real statistical aggregation from database. |
| **Planning** | `PlanningPage.jsx` | DGH Mining Leases & Hazards | `planningAPI.*` | `LIVE_DATABASE` | YES | YES | `LIVE_DATABASE` | Real DGH coordinates + offset hazard dossier. |
| **3D Twin** | `LiveDrillingPanel.jsx` | Strata Mesh & Drillstring Y | `depthToY(realtimeState.depth)` | `DERIVED/CALCULATED` | YES | YES | `DERIVED/CALCULATED` | 3D mesh animates in sync with live/replay bit depth. |

---

## 4. Hardcoded Data Inventory & Forensic Rationale

1. **Default Active Well Identifiers (`b1000000-0000-0000-0000-000000000001` & `...0009`):**
   - **Locations:** `Dashboard.jsx`, `MapPage.jsx`, `RealtimePage.jsx`, `RisksPage.jsx`, `SimulationPage.jsx`.
   - **Rationale:** Ensures that immediately upon page load, the system focuses on `NWIS-DEMO-01` (Lakwa Field active drill) or `DGB-A-201` (Digboi active drill) without presenting an empty unselected state to evaluators.
   - **Action:** Retain as safe initial default states.

2. **Dashboard Fallback Incident Alert Feed (`Dashboard.jsx` lines 116-144):**
   - **Locations:** 3 alert definitions describing stuck pipe in Kopili, differential sticking in Tipam, and tight hole.
   - **Rationale:** Acts as a safety net if the database alerts table contains no unresolved alerts.
   - **Action:** Retain fallback; if the database contains live alerts, `incident_feed` overrides it automatically.

3. **MapPage Offset Intelligence Drawer Fallbacks (`MapPage.jsx` lines 397 & 441):**
   - **Locations:** `selectedNearbyWell.similarity_score || 0.85` and `historical_events_count ?? 2`.
   - **Rationale:** `nearbyWellService.findNearbyWithAnalysis` returns distance and geological overlap, but does not join event counts or compute similarity vectors.
   - **Action:** Can safely be wired to live calculation by adding event counts and similarity score into the backend query.

4. **Planning Exploration Target Presets (`PlanningPage.jsx` lines 84-90):**
   - **Locations:** Coordinates and depths for Lakwa Infill, Rudrasagar Step-Out, Geleki Deep, etc.
   - **Rationale:** UI selection convenience for judges during presentation.
   - **Action:** Retain as UI configuration constants.

5. **3D Strata Presentation Constants (`LiveDrillingPanel.jsx` lines 47-53):**
   - **Locations:** Color definitions and Y-coordinates for geological bedding.
   - **Rationale:** Standard WebGL rendering parameters for Three.js shaders.
   - **Action:** Retain.

6. **React Key Randomization (`LiveDrillingPanel.jsx` line 309):**
   - **Locations:** `id: ${Date.now()}-${Math.random()}`.
   - **Rationale:** Generates unique React list item keys for local UI log lines.
   - **Action:** Safe to retain as-is.

---

## 5. Duplicate & Conflicting AI Implementations

| Subsystem | Node.js Backend Implementation | Python AI Service Implementation | Forensic Finding & Conflict |
| :--- | :--- | :--- | :--- |
| **Well Similarity Engine** | `src/services/similarity.service.js`<br/>Full JavaScript 7-factor engine using PostGIS spatial distances and DB statistics. | `app/similarity/engine.py`<br/>Full Python 7-factor engine using NumPy, SciPy, and SQL. | **Duplicate.** Node engine is actively used by the frontend; Python engine is idle. |
| **Risk Prediction Engine** | `src/services/risk.service.js`<br/>`NWIS-Risk-v2` rule engine with physics anomaly checks (`detectPhysicsAnomalies`). | `app/risk/engine.py`<br/>`NWIS-Risk-v1` rule engine with `live_anomaly` function. | **Duplicate.** Node engine runs during replay and live eval; Python engine runs on WebSocket. |
| **Assistant / RAG** | `src/services/rag.service.js`<br/>Builds rich context from DB, then calls AI server. Falls back to SQL template answer. | `app/rag/assistant.py`<br/>Builds prompt from retrieved DB chunks and calls Google Gemini (`gemini-2.5-flash`). | **Conflicting contract.** Node tries to call `/api/rag/query`, Python expects `/assistant/query`. |
| **Vector Search** | `src/services/search.service.js`<br/>SQL ILIKE fallback search across tables. | `app/services/embeddings.py`<br/>Sentence-transformers (`bge-small-en-v1.5`) with pgvector HNSW index. | **Conflicting contract.** Node calls `/api/search/vector`, Python expects `/search`. |

---

## 6. Forensic Defect Matrix (P0 / P1 / P2)

```
[P0] = Can break live demo or blocks core AI pipeline
[P1] = Functional degradation (falls back to secondary mode)
[P2] = Minor UI polish or cosmetic fallback
```

### Problem P0-1: AI Assistant RAG Endpoint & Schema Mismatch
- **FILE:** `nwis-backend/src/config/ai.js` (line 189) &rarr; `nwis-backend/src/services/rag.service.js` (line 97)
- **FUNCTION:** `aiClient.ragQuery()`
- **PROBLEM:** Node backend calls `POST http://localhost:8000/api/rag/query` with `{ question, context }`. The Python AI server does not have `/api/rag/query`; its endpoint is `POST http://localhost:8000/assistant/query` with `{ question, well_id, radius_km }`.
- **IMPACT:** The HTTP request receives a 404. Node's circuit breaker marks the AI service as failing, and `ragService` falls back to `_generateFallbackAnswer` (a template-based answer). **The real Gemini LLM is never invoked from the UI.**
- **RECOMMENDED FIX:** Update Node's `aiClient.ragQuery` to call `POST /assistant/query` with `{ question, well_id, radius_km }` OR add a compatibility router `/api/rag/query` in FastAPI that accepts Node's pre-built context.

---

### Problem P0-2: Database Identifier Disconnect Between Node and Python
- **FILE:** `D:\sih 2nd oil well\eRTMAC-Smriti AI\ai_service\app\rag\retriever.py` (lines 20-25) & `app/similarity/engine.py` (lines 18-22)
- **FUNCTION:** `nearby_ids()`, `similar_wells()`
- **PROBLEM:** The Python AI service queries `wells` expecting columns `geom` (geography), `source='synthetic'`, and string IDs like `'SYN-000'`. The Node backend uses `ep-cool-mode` with UUID IDs (`b1000000-...`), column name `location` (geometry), and no `source` column. If Node passes active well ID `b1000000-0000-0000-0000-000000000001` to Python, Python raises `ValueError: unknown well`.
- **IMPACT:** Python RAG cannot resolve spatial neighbors for wells created in the Node backend database.
- **RECOMMENDED FIX:** Add an active-well translation layer in the Python database query: support both UUIDs and string IDs, check for either `geom` or `location`, and remove the hardcoded filter `WHERE source='synthetic'`.

---

### Problem P1-1: Semantic Vector Search Endpoint Mismatch
- **FILE:** `nwis-backend/src/config/ai.js` (line 182) & `nwis-backend/src/services/search.service.js` (line 60)
- **FUNCTION:** `aiClient.vectorSearch()`
- **PROBLEM:** Node backend calls `POST /api/search/vector` with `{ query, well_id, limit }`. Python exposes `POST /search` with `{ query, well_id, k }`.
- **IMPACT:** Vector search fails with 404, logged as a warning; search falls back to SQL keyword matching only.
- **RECOMMENDED FIX:** Update `config/ai.js` to target `POST /search` and map parameter `limit` &rarr; `k`.

---

### Problem P1-2: Document Ingestion Multipart Form Mismatch
- **FILE:** `nwis-backend/src/config/ai.js` (line 216) & `nwis-backend/src/jobs/documentIngestion.job.js`
- **FUNCTION:** `aiClient.processDocument()`
- **PROBLEM:** Node background worker sends JSON `{ document_id, file_path }` to `POST /api/documents/process`. Python AI service exposes `POST /documents/ingest` which expects `multipart/form-data` (`file: UploadFile, well_id: str`).
- **IMPACT:** Automated OCR extraction fails on new uploads; system falls back to generating a metadata summary chunk.
- **RECOMMENDED FIX:** Align the ingestion bridge so Node uploads the document file stream directly to `POST /documents/ingest`.

---

### Problem P2-1: MapPage Offset Drawer Similarity & Event Fallbacks
- **FILE:** `nwis-frontend/src/pages/MapPage.jsx` (lines 397 & 441)
- **FUNCTION:** `handleNearbyClick()`
- **PROBLEM:** Backend endpoint `GET /api/wells/:id/nearby` computes distance, formation match, and depth overlap, but does not calculate similarity score or event counts for offset wells. Frontend uses fallbacks: `similarity_score || 0.85` and `historical_events_count ?? 2`.
- **IMPACT:** Cosmetic default values appear on offset well inspection.
- **RECOMMENDED FIX:** Extend `nearbyWellService.findNearbyWithAnalysis` to join `drilling_events` count and calculate basic similarity.

---

## 7. Exact Files Subject to Future Modifications

1. `d:\sih 2nd oil well\eRTMAC-NWIS-Final\Wells\nwis-backend\src\config\ai.js` &mdash; Update API endpoints to match FastAPI routes.
2. `d:\sih 2nd oil well\eRTMAC-NWIS-Final\Wells\nwis-backend\src\services\rag.service.js` &mdash; Align RAG request body structure.
3. `D:\sih 2nd oil well\eRTMAC-Smriti AI\ai_service\app\rag\retriever.py` &mdash; Enable UUID support and flexible geometry column queries.
4. `D:\sih 2nd oil well\eRTMAC-Smriti AI\ai_service\app\similarity\engine.py` &mdash; Add fallback schema compatibility for `location`/`geom`.
5. `d:\sih 2nd oil well\eRTMAC-NWIS-Final\Wells\nwis-backend\src\services\nearbyWell.service.js` &mdash; Provide live event count and similarity scores for offset wells.

---

## 8. Recommended Step-by-Step Execution Plan

```mermaid
flowchart LR
    Step1["Step 1: Bridge RAG Contract (P0)"] --> Step2["Step 2: Bridge Vector Search (P1)"]
    Step2 --> Step3["Step 3: Enrich Nearby GIS (P2)"]
    Step3 --> Step4["Step 4: End-to-End Verification"]
```

### Step 1: Bridge the RAG Assistant Contract (P0)
- In `nwis-backend/src/config/ai.js`, update `ragQuery` to call `POST /assistant/query` with `{ question, well_id: wellId, radius_km: 10 }`.
- In `ai_service/app/rag/retriever.py`, ensure `nearby_ids` gracefully resolves both UUIDs (`b1000000...`) and synthetic IDs (`SYN-000`).

### Step 2: Bridge Semantic Vector Search (P1)
- In `nwis-backend/src/config/ai.js`, update `vectorSearch` to call `POST /search` with parameter `k: limit`.

### Step 3: Enrich Nearby GIS Offset Intelligence (P2)
- In `nwis-backend/src/services/nearbyWell.service.js`, add a subquery counting `drilling_events` for each nearby well so `historical_events_count` is 100% dynamic without fallback.

### Step 4: Full Multi-Tier Verification
- Execute end-to-end verification of all three servers simultaneously to confirm that:
  1. The 3D Digital Twin streams live SSE telemetry.
  2. The GIS map dynamically renders spatial buffers and offset insights.
  3. The AI Assistant synthesizes answers directly using Google Gemini Flash.
  4. The 4-phase replay scenario executes without hitches.
