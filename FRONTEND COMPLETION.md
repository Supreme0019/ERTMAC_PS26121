# eRTMAC-NWIS — COMPLETE FRONTEND COMPLETION HANDOFF
## SIH 2026 · Problem Statement ID 26121 · Oil India Limited

**Purpose of this document:**  
This is an implementation handoff for the IDE/AI coding agent working on the existing `nwis-frontend`.

It was prepared by comparing the existing frontend code against the existing backend code in the supplied project archive, plus the project's documented intended workflow.

---

# 0. EXECUTION INSTRUCTION — READ THIS FIRST

You are working on an **existing React frontend with an already implemented Node/Express backend**.

Your task is NOT to redesign the project from scratch.

Your task is to:

> **Complete the frontend so that it fully consumes and exposes the backend functionality that already exists, while preserving the working backend and the project's intended SIH workflow.**

## Non-negotiable rules

1. **Do not replace the backend.**
2. **Do not invent new backend APIs when an existing backend API already provides the required data.**
3. **Do not add fake/mock data as a fallback for successful UI workflows.**
4. Remove or isolate the existing frontend mock/demo data as real backend endpoints become available.
5. Use the backend's existing synthetic/demo dataset as the canonical demo dataset.
6. Do not present synthetic demo data as real Oil India operational data.
7. Keep the frontend evidence-first.
8. Risk must be presented as a contextual decision-support signal, not a guaranteed prediction.
9. AI answers must show evidence/source context whenever the backend provides it.
10. Historical mitigation must be presented as historical information, not authoritative drilling instructions.
11. Preserve the current authentication/token system.
12. Preserve existing backend routes and response contracts unless an actual backend defect prevents the frontend from functioning.
13. If a backend/frontend contract mismatch is found, fix the frontend first where possible.
14. Do not create a second competing API abstraction.
15. Keep all API calls in `src/api/client.js` or a clean API layer built around it.
16. Prefer reusable components instead of duplicating event/risk/evidence/alert UI across pages.
17. Use the existing React/JS stack unless there is a strong technical reason to change it.
18. Do not migrate the project to TypeScript just for the sake of this task.
19. Keep Leaflet unless replacing it is demonstrably necessary; the current project already uses `react-leaflet`.
20. The final application must build successfully with:
   - `npm run build`
   - `npm run lint` where applicable.

---

# 1. SOURCE/PROJECT CONTEXT

Project:

**eRTMAC-NWIS — Nearby Wells Intelligence System**

SIH:

**Smart India Hackathon 2026**

Problem Statement:

**PS ID 26121**

Organization:

**Oil India Limited**

Theme:

**Smart Automation**

The product is an AI-assisted institutional-memory and decision-support platform for drilling operations.

Core workflow:

```text
ACTIVE WELL
    ↓
NEARBY / SIMILAR WELLS
    ↓
HISTORICAL EVIDENCE
    ↓
DEPTH + FORMATION CORRELATION
    ↓
RISK SIGNAL
    ↓
HISTORICAL MITIGATION / LESSON
    ↓
ENGINEER REVIEW / DECISION
```

The frontend must make this workflow obvious.

The product is NOT:

- a generic chatbot
- an eRTMAC replacement
- an autonomous drilling controller
- a validated drilling simulator
- a system that gives authoritative operational drilling instructions

---

# 2. CURRENT PROJECT STRUCTURE

The supplied archive contains:

```text
Wells/
├── nwis-backend/
└── nwis-frontend/
```

Frontend:

```text
nwis-frontend/
├── package.json
├── vite.config.js
├── index.html
├── public/
└── src/
    ├── App.jsx
    ├── api/
    │   └── client.js
    ├── assets/
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.jsx
    │   │   ├── Sidebar.jsx
    │   │   └── Topbar.jsx
    │   └── ui/
    │       └── StatCard.jsx
    ├── contexts/
    │   └── AuthContext.jsx
    ├── pages/
    │   ├── AssistantPage.jsx
    │   ├── Dashboard.jsx
    │   ├── DocumentsPage.jsx
    │   ├── LoginPage.jsx
    │   ├── MapPage.jsx
    │   ├── PlaceholderPages.jsx
    │   ├── RisksPage.jsx
    │   ├── SearchPage.jsx
    │   ├── WellDetail.jsx
    │   └── Wells.jsx
    └── index.css
```

Current frontend dependencies include:

- React 19
- React Router 6
- Axios
- TanStack React Query
- Leaflet
- React Leaflet
- Recharts
- Framer Motion
- Lucide React

Use these existing dependencies.

---

# 3. CURRENT FRONTEND STATUS

## Already substantially present

- Login
- Auth context
- JWT attachment
- refresh-token handling
- dashboard shell
- well list
- well detail shell
- GIS map shell
- document upload/list
- search page
- assistant page
- risk page shell
- navigation/layout

## Partially integrated

- wells API
- nearby wells
- documents
- search
- RAG assistant
- authentication
- well detail

## Still mostly mock/static

- dashboard statistics
- dashboard charts
- well detail parameters
- well detail formations
- well detail events
- risk page
- GIS radius behavior
- many demo identifiers/names

## Placeholder pages

- realtime
- analytics
- audit
- settings

These four must be implemented.

---

# 4. CRITICAL DISCOVERY

The backend already implements much more functionality than the current frontend exposes.

The backend already contains:

```text
Well CRUD
Nearby-well spatial analysis
Formation data
Trajectory data
Historical drilling events
Event mitigations
Drilling parameters
Parameter trends
Document ingestion
OCR/processing status
Document chunks
Extracted entities
Hybrid search
Autocomplete
Vector search
RAG
RAG sessions/history
Similar-well scoring
Risk engine
Risk evidence
Alerts
Alert acknowledgement
Alert resolution
Realtime state
SSE
Replay simulator
Dashboard aggregation
Analytics
Well comparison
Audit logs
User administration
RBAC
```

The frontend currently exposes only a subset.

The rest of this document is the exact completion plan.

---

# 5. CANONICAL DEMO DATA — IMPORTANT

Do NOT keep using the old frontend mock identifiers such as:

```text
WELL-NHK-014
WELL-JRG-008
WELL-MRN-021
```

as the primary SIH demo scenario when the backend has its own canonical synthetic demo dataset.

The backend replay service is explicitly built around:

```text
NWIS-DEMO-01
```

Backend replay frames progress:

```text
2820
2825
2830
2835
2840
2845
2850
2855 m
```

The intended demo scenario is:

```text
Active Well:
NWIS-DEMO-01

Current / demo depth:
~2850 m

Formation:
Kopili Formation / backend current formation data

Historical problem zone:
approximately 2810–2850m

Primary demo risk:
mud loss

Secondary contextual risk:
stuck pipe

Replay:
backend replay service
```

The project documentation also describes the active demo concept as:

```text
WELL-A-102 / NWIS-DEMO-01
```

Treat `NWIS-DEMO-01` as the canonical frontend identifier and display the friendly well label from the actual backend response.

## Demo data rule

Show a visible but unobtrusive indicator such as:

```text
DEMO / SIMULATED DATA
```

Do not label synthetic values as actual OIL operational measurements.

---

# 6. BACKEND API INVENTORY — FRONTEND MUST COVER

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

Current frontend already has most of this.

### Required frontend work

Add protected routing:

```text
ProtectedRoute
```

Behavior:

```text
No token
   ↓
/login

Token
   ↓
/app
```

If `/auth/me` fails after refresh failure:

```text
clear tokens
redirect /login
```

The existing Axios interceptor already handles much of this.

---

# 7. RBAC — FRONTEND IMPLEMENTATION REQUIRED

Backend roles:

```text
DRILLING_ENGINEER
SUPERVISOR
FIELD_PERSONNEL
DATA_ADMIN
SYSTEM_ADMIN
```

Backend authorization is authoritative.

Frontend RBAC is UX-level visibility only.

Create:

```text
src/utils/permissions.js
src/components/auth/ProtectedRoute.jsx
src/components/auth/RoleGate.jsx
```

Suggested capability map:

```js
const permissions = {
  DRILLING_ENGINEER: [
    'view_wells',
    'view_map',
    'view_documents',
    'upload_documents',
    'view_events',
    'view_risks',
    'evaluate_risk',
    'acknowledge_alert',
    'resolve_alert',
    'view_realtime',
    'view_analytics',
    'use_assistant',
    'compare_wells',
  ],

  SUPERVISOR: [
    'view_wells',
    'view_map',
    'view_documents',
    'upload_documents',
    'view_events',
    'view_risks',
    'evaluate_risk',
    'acknowledge_alert',
    'resolve_alert',
    'view_realtime',
    'view_analytics',
    'use_assistant',
    'compare_wells',
  ],

  FIELD_PERSONNEL: [
    'view_wells',
    'view_map',
    'view_risks',
    'view_realtime',
    'acknowledge_alert',
  ],

  DATA_ADMIN: [
    'view_wells',
    'create_well',
    'edit_well',
    'delete_well',
    'view_documents',
    'upload_documents',
    'reprocess_documents',
    'view_events',
    'manage_events',
    'view_analytics',
    'view_audit',
    'manage_users',
  ],

  SYSTEM_ADMIN: [
    'all',
  ],
};
```

Do not assume this replaces backend authorization.

---

# 8. API CLIENT — COMPLETE IT

Current `src/api/client.js` is incomplete.

Keep Axios and add the missing wrappers.

## Wells

Already present:

```js
getAll
getById
create
update
delete
nearby
nearbyByWell
compare
```

Good.

## Trajectory

Already:

```js
get
add
```

Good.

## Formations

Add:

```js
getById: (id) => api.get(`/formations/${id}`),
getWells: (id) => api.get(`/formations/${id}/wells`),
create: (data) => api.post('/formations', data),
```

## Events

Current client only has:

```js
getByWell
getSummary
```

Add:

```js
getById: (id) => api.get(`/events/${id}`),

create: (data) =>
  api.post('/events', data),

update: (id, data) =>
  api.patch(`/events/${id}`, data),

delete: (id) =>
  api.delete(`/events/${id}`),

getMitigations: (eventId) =>
  api.get(`/events/${eventId}/mitigations`),

addMitigation: (data) =>
  api.post('/events/mitigations', data),
```

## Documents

Already has:

```js
upload
getAll
getById
getStatus
reprocess
getChunks
getEntities
```

Add:

```js
getFileUrl: (key) =>
  `/api/documents/file/${encodeURIComponent(key)}`
```

Do NOT send the file URL through Axios when an ordinary browser URL/object URL is sufficient.

## Search

Add:

```js
autocomplete: (q, limit = 8) =>
  api.get('/search/autocomplete', {
    params: { q, limit }
  }),

vector: (data) =>
  api.post('/search/vector', data),
```

## Assistant

Add:

```js
getHistory: (sessionId) =>
  api.get('/assistant/history', {
    params: { session_id: sessionId }
  }),

clearHistory: (sessionId) =>
  api.delete('/assistant/history', {
    params: { session_id: sessionId }
  }),
```

Important:
The backend expects snake_case fields such as:

```text
well_id
well_name
session_id
```

Do NOT blindly send:

```text
wellId
```

if the backend validator expects:

```text
well_id
```

The current AssistantPage sends:

```js
{ question: text.trim(), wellId: null }
```

This must be corrected.

## Similarity

Already present.

Good.

## Risks

Already present:

```js
evaluate
getActive
getByWell
```

Good.

## Alerts

Already present.

Good.

## Realtime

CURRENT BUG:

```js
getStatus: (wellId) =>
  api.get(`/realtime/${wellId}/status`)
```

There is no backend route:

```text
/realtime/:wellId/status
```

Correct endpoint:

```text
GET /api/realtime/:wellId/state
```

Change to:

```js
getState: (wellId) =>
  api.get(`/realtime/${wellId}/state`),
```

Also add:

```js
startReplay: (wellId, speedMs = 3000) =>
  api.post('/realtime/replay/start', {
    wellId,
    speedMs,
  }),

stopReplay: () =>
  api.post('/realtime/replay/stop'),

getReplayStatus: () =>
  api.get('/realtime/replay/status'),
```

IMPORTANT:
The replay-start validator/backend currently uses camelCase `wellId` in the replay start body. Preserve the actual backend validator contract here.

## Dashboard

Add:

```js
getOverview: (params) =>
  api.get('/dashboard/overview', { params }),

getWellDashboard: (wellId) =>
  api.get(`/dashboard/${wellId}`),
```

## Analytics

Current client is missing:

```js
getDrillingPerformance
```

Add:

```js
getDrillingPerformance: (params) =>
  api.get('/analytics/drilling-performance', { params }),
```

## Compare

Already present.

## Audit

Add:

```js
getLogs: (params) =>
  api.get('/audit', { params }),
```

## Users

Add:

```js
getAll: (params) =>
  api.get('/users', { params }),

getById: (id) =>
  api.get(`/users/${id}`),

create: (data) =>
  api.post('/users', data),

update: (id, data) =>
  api.patch(`/users/${id}`, data),

delete: (id) =>
  api.delete(`/users/${id}`),
```

---

# 9. SSE REALTIME CLIENT — REQUIRED

The backend exposes:

```http
GET /api/realtime/:wellId
```

It is an SSE stream.

Events emitted by backend include:

```text
well-update
alert
alert-acknowledged
alert-resolved
risk-update
```

Implement:

```text
src/hooks/useWellRealtime.js
```

Pseudo-architecture:

```text
useWellRealtime(wellId)
       ↓
new EventSource(...)
       ↓
well-update
       ↓
setRealtimeState()

alert
       ↓
setAlerts()

risk-update
       ↓
setRisks()

alert-acknowledged
       ↓
update alert status

alert-resolved
       ↓
update alert status
```

## Authentication caveat

Native `EventSource` cannot reliably attach a custom Authorization header.

Therefore do NOT expose the user's JWT in the URL unless the backend explicitly supports token query parameters.

The current backend SSE route is not authenticated.

Use the existing backend behavior as-is for the prototype.

If the IDE decides to add authenticated SSE later, that requires a backend change and must be clearly documented.

## Cleanup

Always close:

```js
eventSource.close()
```

on component unmount or well change.

---

# 10. DASHBOARD — REPLACE MOCK DATA

Current Dashboard is heavily hardcoded.

REMOVE:

```text
mockTrendData
mockRiskDistribution
mockRecentEvents
mockFormationData
```

Use:

```http
GET /api/dashboard/overview
```

The backend response contains:

```text
summary
alerts
risks
events
active_wells
ai_service
```

Render:

## Summary

```text
Total Wells
Active Wells
Completed Wells
Suspended Wells
```

## Alerts

```text
Unresolved
Critical Unresolved
Total
```

## Risks

```text
Total Predictions
Critical
High
Average Score
```

## Events

```text
Total
Critical
High
```

## Active wells

Use:

```text
active_wells[]
```

Each active well includes:

```text
id
well_name
field
current_depth
current_formation
realtime
sse_clients
```

This is ideal for an "Active Operations" table.

## AI service status

Show:

```text
AI Service: Available / Unavailable
```

Do not claim AI is operational if backend says it is unavailable.

---

# 11. WELL REGISTRY — COMPLETE THE EXISTING PAGE

Current Wells page already consumes:

```http
GET /api/wells
```

Keep:

- search
- status filter
- sorting
- pagination-ready structure

## Fix

Current Add Well button navigates to:

```text
/wells/new
```

but there is no route.

Create:

```text
/wells/new
```

with a real form using:

```text
POST /api/wells
```

Fields:

```text
well_name
field
status
latitude
longitude
spud_date
total_depth
current_depth
current_formation_id
```

## Add edit

Add:

```text
/wells/:id/edit
```

using:

```http
PATCH /api/wells/:id
```

## Delete

Only show delete to users with appropriate role.

Backend remains authoritative.

---

# 12. WELL DETAIL — MAJOR UPGRADE

The existing WellDetail page is one of the most important pages to complete.

Current tabs:

```text
Overview
Parameters
Formations
Events
```

Keep them, but make them real.

Add additional sections/tabs:

```text
Overview
Parameters
Formations
Events
Trajectory
Similar Wells
Risks
Alerts
Documents
Correlation
```

Do not create unnecessary navigation complexity; tabs can contain sub-panels.

---

# 13. WELL DETAIL — OVERVIEW

Use:

```http
GET /api/wells/:id
```

and preferably:

```http
GET /api/dashboard/:wellId
```

The dashboard endpoint already aggregates:

```text
activeWell
currentState
nearbyWells
similarWells
activeRisks
recentAlerts
recentEvents
formations
statistics
```

Use that endpoint to reduce unnecessary frontend requests.

## Overview should show

### Well identity

```text
Well Name
Field
Status
Latitude
Longitude
Spud Date
Total Depth
Current Depth
Current Formation
```

### Current state

```text
Depth
Formation
ROP
WOB
RPM
Torque
SPP
Mud Weight
```

### Nearby wells

Show:

```text
well
distance
formation match
depth overlap
```

### Similar wells

Show top 3–5.

### Active risks

Show top 3.

### Recent alerts

Show top 3.

---

# 14. WELL DETAIL — PARAMETERS

REMOVE:

```js
mockParamTrends
```

Use:

```http
GET /api/wells/:id/parameters
GET /api/wells/:id/parameters/latest
GET /api/wells/:id/parameters/trends
```

Render actual backend data.

## Current parameter cards

```text
Depth
WOB
RPM
Torque
ROP
Mud Weight
Mud Flow Rate
Standpipe Pressure
Annular Pressure
Hook Load
```

## Trend charts

At minimum:

1. Torque vs depth
2. ROP vs depth
3. WOB vs depth
4. RPM vs depth

Prefer separate compact charts rather than putting unrelated units on one Y axis.

## Trend interpretation

Backend returns:

```text
torque.increasing
rop.increasing
wob.increasing
```

Show subtle indicators:

```text
Torque ↑ Increasing
ROP ↓ Decreasing
WOB ↑ Increasing
```

Do not turn this into a medical-style warning or make unsupported causal claims.

---

# 15. WELL DETAIL — FORMATIONS

REMOVE:

```js
mockFormations
```

Use:

```http
GET /api/wells/:id/formations
```

Each formation record contains:

```text
id
top_depth
bottom_depth
metadata
formation_id
formation_name
description
geological_attributes
```

Render a vertical depth track:

```text
0m
│
├── Formation A
│
├── Formation B
│
├── Formation X
│
└── Formation Y
3500m
```

At current depth, show:

```text
CURRENT DEPTH
2850m
```

Highlight the current formation.

---

# 16. WELL DETAIL — EVENTS

REMOVE:

```js
mockEvents
```

Use:

```http
GET /api/wells/:id/events
GET /api/wells/:id/events/summary
```

Supported filters:

```text
from_depth
to_depth
event_type
severity
formation
limit
offset
```

Create filter controls:

```text
Event Type
Severity
Formation
Depth From
Depth To
```

Render a depth-aware event timeline.

Example:

```text
2510m
│
├── Torque increase
│
2670m
├── Mud-loss warning
│
2710m
├── MUD LOSS
│
2715m
├── Mitigation
│
2760m
└── Drilling resumed
```

Clicking an event opens:

```text
Event Detail Drawer
```

---

# 17. EVENT DETAIL DRAWER

Use:

```http
GET /api/events/:id
```

Display:

```text
Event Type
Depth
Formation
Severity
Description
Start Time
End Time
Confidence
Metadata
Source Document
```

If source document exists:

```text
[Open Evidence]
```

If mitigations exist:

```http
GET /api/events/:id/mitigations
```

show:

```text
Historical Mitigation

Action
Outcome
Notes
Source Document
```

---

# 18. MITIGATION UI — REQUIRED

This is a major backend feature that is currently absent from frontend.

Component:

```text
MitigationHistory
```

Example:

```text
HISTORICAL RESPONSE

Event:
Mud Loss

Action:
LCM treatment

Outcome:
Drilling resumed

Notes:
Historical report recorded successful restoration of circulation.

Source:
WCR-07 · Page 42
```

Add a clear label:

```text
Historical record — not an operational instruction
```

Do not generate new drilling procedures in the frontend.

---

# 19. TRAJECTORY VIEW — REQUIRED

Backend:

```http
GET /api/wells/:id/trajectory
```

Data:

```text
measured_depth
tvd
latitude
longitude
inclination
azimuth
```

Create:

```text
TrajectoryPanel
```

Use:

- map polyline for surface trajectory
- depth vs inclination chart
- optionally azimuth chart

On GIS map:

```text
Well surface point
       \
        \
         \
          \ TD
```

For selected well, display its trajectory.

For nearby wells, show trajectories only when selected to avoid clutter.

---

# 20. GIS MAP — MAJOR REWORK

Current MapPage fetches:

```http
GET /wells
```

and plots all wells.

This is not enough.

The correct workflow is:

```text
Select Active Well
        ↓
Set Radius
        ↓
GET /wells/:id/nearby?radius=...
        ↓
Display nearby wells
        ↓
Show relevance metadata
```

## Map must have

### Active well

Clearly differentiated.

### Nearby wells

Show:

```text
distance
formation match
depth overlap
```

### Similar wells

Use similarity API and differentiate them visually.

### Historical event indicators

When a nearby well is selected, show relevant events.

### Radius

Changing radius must actually refetch nearby data.

Do NOT only change a visual circle.

---

# 21. GIS MAP — SELECTED WELL PANEL

Clicking a well should open a proper intelligence panel:

```text
OFFSET WELL

LKW-A-102

Distance:
3.2 km

Formation Match:
YES

Matching Formations:
Kopili Formation

Depth Overlap:
0–2850m

Similarity:
91%

Historical Events:
2 mud-loss
1 stuck-pipe
```

Buttons:

```text
View Well
View Events
View Similarity
Compare
```

---

# 22. SIMILAR-WELL ENGINE — REQUIRED

Backend:

```http
GET /api/similarity/:wellId
```

Backend scoring factors:

```text
Geographic       15%
Formation        25%
Depth overlap    20%
Trajectory       15%
Parameters       10%
Events           10%
Completeness      5%
```

Frontend should display:

```text
MOST RELEVANT OFFSET WELLS

LKW-A-102
91% Similar

LKW-B-201
86% Similar

LKW-C-305
74% Similar
```

Each result should show:

```text
Distance
Similarity score
Formation score
Depth score
Trajectory score
Parameter score
Event similarity
Data completeness
```

Use an expandable breakdown.

Do NOT call the score a probability.

It is a similarity score.

---

# 23. DEPTH + FORMATION CORRELATION — NEW CORE SCREEN

Create:

```text
/src/pages/CorrelationPage.jsx
```

Route:

```text
/correlation/:wellId
```

or integrate as a tab in WellDetail.

Recommended approach:

```text
/wells/:id
```

with:

```text
Correlation
```

tab.

## Purpose

Show:

```text
Active well
+
offset wells
+
formation intervals
+
historical events
+
current depth
```

on one vertical depth axis.

Example:

```text
DEPTH

2500 ───────────── Formation A
2600 ───────────── Formation A

2700 ───────────── Formation X
                  │
                  │ Offset A: event
2800 ───────────── │
                  │
2845 ───────────── 🔴 Mud Loss
2850 ─────── ★ CURRENT WELL
2900 ───────────── Formation X
```

This screen is central to PS 26121.

---

# 24. RISK ENGINE — CONNECT REAL BACKEND

Current RisksPage is mock.

REMOVE:

```text
mockActiveRisks
mockRiskByType
```

Use:

```http
GET /api/risks/:wellId/active
GET /api/risks/:wellId
POST /api/risks/evaluate
```

## Risk object

Render:

```text
risk_type
score
level
depth_range
explanation
evidence
```

## Risk card

```text
MUD LOSS

HIGH

Score:
0.82

Depth:
2810–2900m

Current depth:
2850m

Why:
2 historical incidents in nearby wells...
```

---

# 25. RISK EVALUATION UI

Create a button:

```text
Evaluate Current Context
```

Payload:

```js
{
  well_id: wellId,
  depth: currentDepth
}
```

Then show:

```text
Evaluation completed
Model: NWIS-Risk-v1
Evaluated at: timestamp
```

Risk response includes:

```text
well_id
well_name
depth
formation
risks
model_version
evaluated_at
```

---

# 26. RISK EVIDENCE

Each risk can have:

```text
well
event_type
depth
severity
description
```

Display:

```text
SUPPORTING EVIDENCE

LKW-A-102
Mud Loss
2810m
High

LKW-B-201
Mud Loss
2845m
Critical
```

Then provide:

```text
[Open Event]
```

which leads to the event detail.

If event has a source document:

```text
[Open Source]
```

---

# 27. ALERTS — IMPLEMENT FULL LIFECYCLE

Backend lifecycle:

```text
GENERATED
    ↓
DELIVERED
    ↓
VIEWED
    ↓
ACKNOWLEDGED
    ↓
RESOLVED
```

Frontend must display alert status.

## Alert card

```text
⚠ MUD LOSS RISK

HIGH

NWIS-DEMO-01
Depth: 2850m

Why:
Historical nearby incidents between
2810–2845m.

[View Evidence]
[Acknowledge]
```

After acknowledgement:

```text
ACKNOWLEDGED
```

After resolution:

```text
RESOLVED
```

---

# 28. ALERT ACKNOWLEDGEMENT

Call:

```http
PATCH /api/alerts/:id/acknowledge
```

Only show if role allows it.

Update UI optimistically or refetch.

Show:

```text
Acknowledged by
timestamp
```

---

# 29. ALERT RESOLUTION

Call:

```http
PATCH /api/alerts/:id/resolve
```

Show only when appropriate.

After resolve:

```text
status = resolved
```

Remove from active-alert count.

---

# 30. REALTIME MONITORING — CRITICAL SIH FEATURE

Current page is only:

```text
Coming Soon
```

This must be implemented.

Create:

```text
src/pages/RealtimePage.jsx
src/hooks/useWellRealtime.js
src/components/realtime/RealtimeHeader.jsx
src/components/realtime/ParameterStrip.jsx
src/components/realtime/RealtimeCharts.jsx
src/components/realtime/LiveAlertPanel.jsx
src/components/realtime/ReplayControls.jsx
```

---

# 31. REALTIME PAGE DESIGN

Header:

```text
REAL-TIME DRILLING MONITOR

Well:
NWIS-DEMO-01

Connection:
● LIVE

Mode:
REPLAY

Current Depth:
2850m

Formation:
Kopili Formation
```

Parameter strip:

```text
WOB              19.8
RPM              98
TORQUE           36.2
ROP              4.5
SPP              4320
MUD WEIGHT       1.23
```

Charts:

```text
Torque vs Depth
ROP vs Depth
WOB vs Depth
Pressure vs Depth
```

Historical context panel:

```text
Historical Context

2 nearby wells experienced
mud-loss incidents in this interval.
```

---

# 32. REPLAY CONTROLS

Backend:

```http
POST /api/realtime/replay/start
POST /api/realtime/replay/stop
GET  /api/realtime/replay/status
```

UI:

```text
[START REPLAY]
[STOP REPLAY]

Speed:
1x
2x
4x
```

The backend accepts `speedMs`, not an abstract speed multiplier.

Map UI speed labels to actual milliseconds.

Suggested:

```text
1x = 3000ms
2x = 1500ms
4x = 750ms
```

Do not send unsupported values.

---

# 33. REALTIME SSE FLOW

Expected:

```text
START REPLAY
    ↓
backend replay frame
    ↓
realtimeService.updateState()
    ↓
well-update SSE
    ↓
frontend state update
    ↓
parameter UI updates
```

At risk trigger:

```text
depth reaches evaluation threshold
    ↓
riskService.evaluate()
    ↓
riskRepository.create()
    ↓
alertService.createFromRisk()
    ↓
alert SSE
    ↓
frontend alert panel
```

Also:

```text
risk-update SSE
```

updates the risk panel.

This should be a live demonstration.

---

# 34. IMPORTANT REPLAY DETAIL

Backend evaluates risk every 25m of depth change.

The replay frames are:

```text
2820
2825
2830
2835
2840
2845
2850
2855
```

Therefore the frontend should not assume that every 5m frame creates a risk evaluation.

Display:

```text
live parameter updates
```

continuously, while risk updates occur according to backend behavior.

---

# 35. AI ASSISTANT — REMOVE FAKE FALLBACK

Current AssistantPage has a hardcoded fallback answer containing invented claims such as:

```text
I analyzed data from 47 wells...
```

This must be removed.

If backend fails:

```text
AI service unavailable.

No generated answer is available.

[View historical database/search results]
```

Never fabricate an answer.

---

# 36. AI ASSISTANT — CORRECT REQUEST CONTRACT

Backend RAG accepts:

```text
question
wellId
wellName
sessionId
context
```

But its validation must be respected.

Prefer the backend's actual expected request shape:

```js
{
  question,
  well_id,
  well_name,
  session_id,
  context
}
```

Use the actual validator in:

```text
nwis-backend/src/validators/assistant.validator.js
```

as the source of truth.

Do not guess field names.

---

# 37. AI ASSISTANT — SESSION SUPPORT

Create a session ID in frontend:

```text
session_id
```

Persist during the assistant page session.

Send it on every query.

Use:

```http
GET /api/assistant/history?session_id=...
DELETE /api/assistant/history?session_id=...
```

Clear button should actually clear the backend session, not merely clear React state.

---

# 38. AI ASSISTANT — WELL CONTEXT

The assistant should have a selected context:

```text
Context Well:
NWIS-DEMO-01
```

When opened from WellDetail:

```text
/wells/:id
    ↓
Ask Assistant
    ↓
/assistant?wellId=:id
```

Then assistant query includes that well context.

This makes the assistant operational rather than generic.

---

# 39. AI ASSISTANT — BACKEND RESPONSE TO DISPLAY

Backend returns:

```text
answer
sources
well
session_id
follow_up_questions
context_summary
```

Show:

## Answer

Main response.

## Sources

Each source should be clickable where possible.

## Context summary

Subtle:

```text
Context used:
1 well
8 nearby wells
7 events
4 formations
6 document chunks
```

Use actual backend counts.

## Follow-up questions

Render buttons:

```text
[What mitigation was used for mud loss?]
[Compare nearby wells]
[What are current parameter trends?]
```

---

# 40. SEARCH — COMPLETE HYBRID SEARCH UI

Current SearchPage supports only:

```text
query
category
```

Backend supports:

```text
query
well_id
type
formation
event_type
severity
from_depth
to_depth
use_ai
limit
```

Add an expandable advanced-filter area:

```text
Well
Formation
Event Type
Severity
Depth From
Depth To
Semantic Search
```

---

# 41. SEARCH RESULT TYPES

Backend can return:

```text
event
document_chunk
well
formation
vector_match
keyword_fallback
```

Frontend currently expects fields like:

```text
title
subtitle
```

but backend returns different field names.

Normalize the response in the API layer or a search adapter.

Example:

```js
normalizeSearchResult(item)
```

Mapping:

### Well

```text
wellId
wellName
field
status
currentDepth
currentFormation
relevance
```

### Event

```text
eventId
wellId
wellName
eventType
severity
depth
formation
description
relevance
```

### Document chunk

```text
documentId
filename
page
section
text
relevance
```

### Formation

```text
formationId
name
description
attributes
relevance
```

---

# 42. SEARCH AUTOCOMPLETE

Implement:

```http
GET /api/search/autocomplete?q=...
```

On typing:

```text
Kop
```

show:

```text
Formation: Kopili
Event: ...
Well: ...
```

Debounce 200–300ms.

Do not hammer the endpoint on every keystroke.

---

# 43. VECTOR SEARCH

Add a toggle:

```text
Keyword
Semantic
Hybrid
```

When semantic:

```http
POST /api/search/vector
```

Show:

```text
relevance
document
page
section
text snippet
```

This is particularly useful for evidence discovery.

---

# 44. DOCUMENT LIBRARY — REMOVE MOCK FALLBACK

Current DocumentsPage falls back to:

```js
mockDocuments
```

Remove that for production/demo integration.

If backend returns zero:

```text
No documents found
```

Do not display fabricated documents.

---

# 45. DOCUMENT LIST

Backend document record includes:

```text
id
well_id
document_type
original_filename
file_uri
document_date
version
ocr_status
processing_status
checksum
uploaded_by
page_count
text_length
created_at
well_name
```

Display:

```text
Filename
Type
Well
OCR
Processing
Pages
Date
Version
```

---

# 46. DOCUMENT DETAIL DRAWER

Clicking a document should open a drawer/page:

```text
Document:
WCR_NWIS_DEMO_01.pdf

Well:
NWIS-DEMO-01

Type:
WCR

Version:
1

OCR:
Completed

Processing:
Processed

Pages:
42

Text:
...
```

Buttons:

```text
[Open PDF]
[View Chunks]
[View Extracted Entities]
[Reprocess]
```

---

# 47. DOCUMENT PROCESSING STATUS

Use:

```http
GET /api/documents/:id/status
```

Display independently:

```text
OCR:
✓ Completed

Processing:
✓ Indexed
```

Possible states:

```text
pending
processing
processed
failed
```

---

# 48. DOCUMENT CHUNKS

Use:

```http
GET /api/documents/:id/chunks
```

Render:

```text
Page 42
Section: Drilling Problems

[chunk text]

Confidence:
0.94
```

Click:

```text
Open source
```

---

# 49. EXTRACTED ENTITIES

Use:

```http
GET /api/documents/:id/entities
```

Render table:

```text
Entity Type
Value
Normalized Value
Confidence
Page
Source Location
```

Example:

```text
FORMATION
Kopili
Kopili Formation
0.96
42
Section: Drilling Problems
```

Low-confidence entities should have a visible warning badge.

---

# 50. PDF/SOURCE VIEWER

Backend provides:

```http
GET /api/documents/file/:key
```

The document metadata contains `file_uri`.

Create an evidence viewer that can open the actual PDF.

Preferred:

```text
PDF in browser iframe/object/embed
```

or a dedicated viewer if already available.

When possible, navigate to the relevant page.

The source chain should be:

```text
Risk
 ↓
Historical Event
 ↓
Source Document
 ↓
Page
 ↓
Section
```

---

# 51. EVIDENCE PANEL — BUILD ONCE, REUSE EVERYWHERE

Create:

```text
src/components/evidence/EvidencePanel.jsx
src/components/evidence/EvidenceBadge.jsx
src/components/evidence/SourceDocumentLink.jsx
```

Use it in:

- event details
- risk cards
- alerts
- AI assistant
- similar well details
- comparison
- correlation

Example:

```text
EVIDENCE

Well:
LKW-B-201

Depth:
2845m

Formation:
Kopili

Event:
Mud Loss

Severity:
Critical

Source:
WCR-LKW-B-201
Page 42

[Open Source]
```

---

# 52. WELL COMPARISON — IMPLEMENT

Backend:

```http
POST /api/compare
```

and also:

```http
POST /api/wells/compare
```

Use one canonical frontend wrapper.

Payload:

```js
{
  wellIds: [id1, id2, id3]
}
```

Follow the actual backend validator if it requires another exact field name.

Backend returns:

```text
referenceWell
wells[]
```

Each comparison contains:

```text
id
name
field
status
distance
currentDepth
totalDepth
currentFormation
depthOverlap
mudLossEvents
stuckPipeEvents
kickEvents
totalEvents
```

Build:

```text
Compare Wells
```

with 2–4 wells.

---

# 53. COMPARISON UI

Table:

```text
                       ACTIVE       OFFSET A       OFFSET B

Well                   ...
Distance               —            3.2km          5.8km
Depth                  2850m        2920m          2880m
Formation              X            X              X
Depth overlap          ...
Mud loss events        0            2              1
Stuck pipe events      0            0              1
Kick events            0            0              1
Total events           ...
```

Add:

```text
[View Correlation]
[View Events]
```

---

# 54. ANALYTICS — IMPLEMENT PLACEHOLDER PAGE

Current page is:

```text
Coming Soon
```

Implement with backend APIs.

Routes:

```http
GET /api/analytics/events
GET /api/analytics/formations
GET /api/analytics/risks
GET /api/analytics/alerts
GET /api/analytics/npt
GET /api/analytics/drilling-performance
```

---

# 55. ANALYTICS SCREEN

Use filters:

```text
Well
From Date
To Date
```

Sections:

## Events

Charts:

```text
Events by Type
Events by Severity
Events by Formation
```

## Formations

```text
Wells drilled through formation
Formation thickness
Events per formation
```

## Risks

```text
Risk type × level
Average score
```

## Alerts

```text
Status × severity
Average acknowledgement time
```

## NPT

```text
NPT hours by event type/well
```

## Drilling performance

```text
Average ROP
Maximum ROP
Minimum ROP
Average WOB
Average Torque
Average RPM
Depth progression
```

Use Recharts.

---

# 56. AUDIT LOG — IMPLEMENT

Backend:

```http
GET /api/audit
```

Admin-only.

Implement filters:

```text
User
Action
Resource Type
Resource ID
From
To
```

Display:

```text
Timestamp
User
Action
Resource
Details
```

Examples:

```text
EVALUATE_RISK
ACKNOWLEDGE_ALERT
RESOLVE_ALERT
UPLOAD_DOCUMENT
RAG_QUERY
CREATE_WELL
UPDATE_WELL
```

Do not expose audit page to unauthorized roles in navigation.

---

# 57. SETTINGS — IMPLEMENT

Minimum:

```text
Profile
Name
Email
Role
Account status
```

Actions:

```text
Sign out
```

For admins:

```text
User Management
```

If API key configuration is not backed by an endpoint, do not create fake settings controls.

---

# 58. USER ADMIN — OPTIONAL BUT COMPLETE THE BACKEND FEATURE

Backend supports:

```http
GET /api/users
POST /api/users
GET /api/users/:id
PATCH /api/users/:id
DELETE /api/users/:id
```

Create:

```text
/settings/users
```

or:

```text
/admin/users
```

Only admin roles.

Table:

```text
Name
Email
Role
Status
Created
Actions
```

Create/edit user modal.

---

# 59. NAVIGATION UPDATE

Current navigation:

```text
Dashboard
Wells
GIS Map
Documents
Search
Risk Analysis
Real-Time
Analytics
AI Assistant
Audit Log
Settings
```

Keep it.

Add or expose:

```text
Compare
```

only when comparison context exists, or as a button from wells.

Do not clutter sidebar with every subfeature.

Correlation should generally be reached from a well.

---

# 60. PROPOSED ROUTES

Keep existing routes:

```text
/
 /login
 /wells
 /wells/:id
 /map
 /documents
 /search
 /risks
 /realtime
 /analytics
 /assistant
 /audit
 /settings
```

Add:

```text
/wells/new
/wells/:id/edit
/wells/:id/compare
```

Optional:

```text
/wells/:id/correlation
/documents/:id
/admin/users
```

Prefer drawers/modals for event/document details instead of excessive full pages.

---

# 61. RECOMMENDED COMPONENT ARCHITECTURE

Create:

```text
src/
├── api/
│   └── client.js
├── components/
│   ├── auth/
│   │   ├── ProtectedRoute.jsx
│   │   └── RoleGate.jsx
│   │
│   ├── wells/
│   │   ├── WellSelector.jsx
│   │   ├── WellSummary.jsx
│   │   ├── NearbyWellsPanel.jsx
│   │   ├── SimilarWellsPanel.jsx
│   │   ├── WellComparisonTable.jsx
│   │   └── TrajectoryPanel.jsx
│   │
│   ├── drilling/
│   │   ├── ParameterStrip.jsx
│   │   ├── ParameterCharts.jsx
│   │   ├── FormationTrack.jsx
│   │   ├── EventTimeline.jsx
│   │   └── DepthCorrelation.jsx
│   │
│   ├── risk/
│   │   ├── RiskCard.jsx
│   │   ├── RiskEvidenceCard.jsx
│   │   ├── RiskExplanation.jsx
│   │   └── RiskList.jsx
│   │
│   ├── alerts/
│   │   ├── AlertCard.jsx
│   │   ├── AlertPanel.jsx
│   │   └── AlertActions.jsx
│   │
│   ├── evidence/
│   │   ├── EvidencePanel.jsx
│   │   ├── EvidenceItem.jsx
│   │   └── SourceDocumentLink.jsx
│   │
│   ├── documents/
│   │   ├── DocumentDrawer.jsx
│   │   ├── DocumentStatus.jsx
│   │   ├── ChunkViewer.jsx
│   │   ├── EntityViewer.jsx
│   │   └── PdfViewer.jsx
│   │
│   ├── realtime/
│   │   ├── ReplayControls.jsx
│   │   ├── RealtimeHeader.jsx
│   │   ├── LiveParameterStrip.jsx
│   │   └── LiveAlertPanel.jsx
│   │
│   └── ui/
│       ├── StatCard.jsx
│       ├── LoadingState.jsx
│       ├── ErrorState.jsx
│       ├── EmptyState.jsx
│       ├── DataTable.jsx
│       ├── Drawer.jsx
│       └── Modal.jsx
│
├── hooks/
│   ├── useWellRealtime.js
│   ├── useDebounce.js
│   └── usePermissions.js
│
├── utils/
│   ├── permissions.js
│   ├── formatters.js
│   ├── searchNormalizer.js
│   └── risk.js
│
└── pages/
```

---

# 62. REACT QUERY USAGE

TanStack React Query is already installed.

Use it instead of manually managing every GET request with `useEffect`.

Examples:

```js
useQuery({
  queryKey: ['well', wellId],
  queryFn: () => wellsAPI.getById(wellId),
});
```

```js
useQuery({
  queryKey: ['wellDashboard', wellId],
  queryFn: () => dashboardAPI.getWellDashboard(wellId),
});
```

For mutations:

```js
useMutation({
  mutationFn: ...
});
```

After:

```text
acknowledge alert
```

invalidate:

```text
['alerts', wellId]
['wellDashboard', wellId]
```

---

# 63. DO NOT OVERFETCH

For WellDetail, prefer:

```text
dashboard/:wellId
```

for the overview.

Then fetch detailed resources only when tabs are opened:

```text
Parameters tab
   → parameters endpoint

Events tab
   → events endpoint

Trajectory tab
   → trajectory endpoint

Similarity tab
   → similarity endpoint
```

This keeps initial load fast.

---

# 64. LOADING STATES

Every backend-backed panel needs:

```text
Loading
Success
Empty
Error
```

Examples:

```text
Loading nearby wells...
No nearby wells found.
Unable to load nearby wells. Retry.
```

Do not leave blank panels.

---

# 65. ERROR HANDLING

Do not silently substitute fake data.

Bad:

```js
catch {
  setData(mockData);
}
```

Correct:

```text
Backend unavailable

Unable to load historical events.

[Retry]
```

For non-critical panels:

```text
Could not load this panel.
[Retry]
```

For AI:

```text
AI service unavailable.
Historical database functions remain available.
```

---

# 66. DEMO MODE / LIVE MODE

The UI should show:

```text
DATA MODE: DEMO / SIMULATION
```

For realtime:

```text
MODE: REPLAY
```

If actual eRTMAC integration is ever supplied:

```text
MODE: LIVE
```

Do not imply live OIL integration exists if it does not.

---

# 67. CORE SIH DEMO — FRONTEND MUST SUPPORT THIS EXACT FLOW

The final live demo should be:

```text
1. Login
       ↓
2. Select NWIS-DEMO-01
       ↓
3. Active Well dashboard
       ↓
4. Show current depth + formation + parameters
       ↓
5. Open GIS Map
       ↓
6. Set radius = 10 km
       ↓
7. Show nearby wells
       ↓
8. Select relevant offset well
       ↓
9. Show similarity score
       ↓
10. Show formation + depth overlap
       ↓
11. Open historical event
       ↓
12. Show source evidence
       ↓
13. Show historical mitigation
       ↓
14. Ask AI assistant:
    "What similar mud-loss incidents occurred around this formation?"
       ↓
15. Show grounded answer + sources
       ↓
16. Open Real-Time Monitoring
       ↓
17. Start Replay
       ↓
18. Parameters change in realtime
       ↓
19. Depth approaches historical problem zone
       ↓
20. Risk evaluation triggers
       ↓
21. Alert appears through SSE
       ↓
22. Click "Why?"
       ↓
23. Show supporting historical events
       ↓
24. Show historical mitigation
       ↓
25. Compare wells
       ↓
26. Engineer reviews evidence
       ↓
27. Decision-support conclusion
```

This is the frontend's primary purpose.

---

# 68. MOST IMPORTANT UI COMPONENT — ACTIVE WELL CONTEXT BAR

Create:

```text
ActiveWellContextBar
```

Persistent at the top of relevant pages.

Display:

```text
ACTIVE WELL
NWIS-DEMO-01

DEPTH
2850 m

FORMATION
Kopili

STATUS
DRILLING

DATA MODE
DEMO / REPLAY
```

This makes every screen context-aware.

---

# 69. RISK CARD DESIGN

Avoid:

```text
AI says 87%
```

Prefer:

```text
MUD LOSS
HIGH

Current depth:
2850m

Historical interval:
2810–2850m

Supporting cases:
2 nearby wells

Formation:
Kopili

Why:
Historical mud-loss incidents occurred
within the current depth/formation context.

[View Evidence]
```

---

# 70. EVIDENCE-FIRST DESIGN RULE

Every high-impact statement must answer:

```text
Why?

Based on what?

From which well?

At what depth?

In which formation?

From which source?
```

Examples:

### AI

```text
Answer
↓
Sources
```

### Risk

```text
Risk
↓
Historical incidents
↓
Depth
↓
Formation
```

### Alert

```text
Alert
↓
Reason
↓
Evidence
```

---

# 71. VISUAL DESIGN DIRECTION

The current frontend has:

- dark UI
- gradients
- glass panels
- accent colors
- motion

Do not completely throw away the existing visual system.

However, reduce generic "AI SaaS" styling.

Avoid:

- excessive neon
- excessive purple
- giant glowing cards
- glassmorphism everywhere
- excessive rounded containers
- fake AI avatars
- unnecessary animation
- giant KPI grids
- meaningless decorative graphics

Use an engineering/GIS visual language:

```text
Dark graphite/navy background
Muted blue/cyan technical accents
Amber for warnings
Red for critical conditions
Green for healthy/normal
Monospace for depth/parameter values
Dense but readable tables
Technical timelines
Depth tracks
Maps
Evidence panels
```

The product should feel like:

```text
drilling operations software
+
GIS
+
engineering analytics
```

not:

```text
consumer AI chatbot
```

---

# 72. ANIMATION

Keep Framer Motion but use it sparingly.

Allowed:

- page fade
- panel transition
- drawer slide
- alert entrance
- replay state transition

Avoid:

- constant floating effects
- pulsing every card
- excessive bouncing
- animated backgrounds

---

# 73. RESPONSIVE BEHAVIOR

Desktop is the primary target because this is an engineering operations dashboard.

Still support:

### Tablet

- collapsible sidebar
- two-column → one-column transition

### Mobile

- map full width
- stacked parameter cards
- horizontal tab scrolling
- tables become cards or horizontally scrollable
- drawers become full-screen sheets

Do not sacrifice desktop density to make everything mobile-first.

---

# 74. ACCESSIBILITY

Implement:

- keyboard-accessible buttons
- visible focus state
- meaningful labels
- title/aria-label for icon-only buttons
- sufficient contrast
- status text in addition to color
- not relying only on red/green

For realtime status:

```text
● LIVE
```

also include text:

```text
Live connection
```

---

# 75. DATA FORMATTERS

Create shared utilities:

```text
formatDepth(2850)
→ 2,850 m

formatDistance(3.24)
→ 3.2 km

formatScore(0.82)
→ 82%

formatRiskLevel('high')
→ HIGH

formatEventType('lost_circulation')
→ Lost circulation

formatDate(...)
formatTimestamp(...)
```

---

# 76. IMPORTANT FIELD NAME NORMALIZATION

Backend uses mixed naming styles.

Examples:

```text
well_name
current_depth
total_depth
formation_name
depth_overlap_range
similarity_score
risk_type
risk_level
```

Frontend currently mixes:

```text
well.name
well.current_depth_m
well.total_depth_m
```

Do not scatter conversions everywhere.

Create normalization helpers:

```text
normalizeWell()
normalizeRisk()
normalizeAlert()
normalizeEvent()
normalizeDocument()
normalizeParameter()
```

Then components consume predictable frontend objects.

---

# 77. CURRENT FRONTEND MOCK DATA TO REMOVE

Search the frontend for:

```text
mock
demoWells
mockDocuments
mockActiveRisks
mockRiskByType
mockEvents
mockFormations
mockParamTrends
mockTrendData
mockRiskDistribution
mockRecentEvents
```

Remove them from normal API success/failure flows.

If demo seed data is needed, get it from the backend.

The frontend must not silently invent records.

---

# 78. CURRENT BACKEND FUNCTIONALITY THAT MUST BE SURFACED

Priority list:

## P0 — absolutely required

```text
1. Dashboard backend overview
2. Real nearby-well query
3. Formation API
4. Real historical events
5. Event detail
6. Mitigations
7. Real parameter trends
8. Similar-well engine
9. Risk engine
10. Alert lifecycle
11. SSE realtime
12. Replay controls
13. Evidence/source viewer
14. RAG with well context
15. RAG follow-ups
16. Depth/formation correlation
17. Canonical demo well
```

## P1 — important

```text
18. Well comparison
19. Document status
20. Document chunks
21. Extracted entities
22. Search filters
23. Search autocomplete
24. Vector search
25. Analytics
26. Audit
27. RBAC UI
```

## P2 — administrative completeness

```text
28. Create/edit well
29. Formation management
30. Event management
31. User management
32. Trajectory upload
33. Parameter ingestion UI
34. Advanced settings
```

---

# 79. DO NOT SPEND TIME ON THESE BEFORE P0

Do not prioritize:

- fancy 3D well visualization
- voice assistant
- advanced deep-learning visualizations
- complicated microservices
- huge admin dashboard
- elaborate animation
- report-generation UI
- enterprise SSO
- polished marketing landing page

The SIH judge needs the operational workflow.

---

# 80. EXACT COMPONENT PRIORITY

Build in this order:

```text
1. ProtectedRoute
2. API client completion
3. Data normalizers
4. ActiveWellContextBar
5. EvidencePanel
6. AlertCard
7. RiskEvidenceCard
8. EventTimeline
9. FormationTrack
10. ParameterStrip
11. NearbyWellsPanel
12. SimilarWellsPanel
13. DepthCorrelation
14. Realtime SSE hook
15. ReplayControls
16. RealtimePage
17. Active Well Dashboard
18. Documents detail
19. AI session/context
20. Search filters
21. Comparison
22. Analytics
23. Audit
24. Admin
```

---

# 81. EXACT FRONTEND FILES TO CREATE/MODIFY

## Modify

```text
src/App.jsx
src/api/client.js
src/contexts/AuthContext.jsx
src/components/layout/Sidebar.jsx
src/components/layout/Topbar.jsx
src/pages/Dashboard.jsx
src/pages/Wells.jsx
src/pages/WellDetail.jsx
src/pages/MapPage.jsx
src/pages/DocumentsPage.jsx
src/pages/SearchPage.jsx
src/pages/RisksPage.jsx
src/pages/AssistantPage.jsx
src/index.css
```

## Replace placeholder

```text
src/pages/PlaceholderPages.jsx
```

with real pages/components, or split into:

```text
src/pages/RealtimePage.jsx
src/pages/AnalyticsPage.jsx
src/pages/AuditPage.jsx
src/pages/SettingsPage.jsx
```

## Create

```text
src/hooks/useWellRealtime.js
src/hooks/useDebounce.js
src/hooks/usePermissions.js

src/utils/permissions.js
src/utils/formatters.js
src/utils/normalizers.js
src/utils/searchNormalizer.js

src/components/auth/ProtectedRoute.jsx
src/components/auth/RoleGate.jsx

src/components/wells/WellSelector.jsx
src/components/wells/WellSummary.jsx
src/components/wells/NearbyWellsPanel.jsx
src/components/wells/SimilarWellsPanel.jsx
src/components/wells/WellComparisonTable.jsx
src/components/wells/TrajectoryPanel.jsx

src/components/drilling/ParameterStrip.jsx
src/components/drilling/ParameterCharts.jsx
src/components/drilling/FormationTrack.jsx
src/components/drilling/EventTimeline.jsx
src/components/drilling/DepthCorrelation.jsx

src/components/risk/RiskCard.jsx
src/components/risk/RiskEvidenceCard.jsx
src/components/risk/RiskExplanation.jsx

src/components/alerts/AlertCard.jsx
src/components/alerts/AlertPanel.jsx
src/components/alerts/AlertActions.jsx

src/components/evidence/EvidencePanel.jsx
src/components/evidence/EvidenceItem.jsx
src/components/evidence/SourceDocumentLink.jsx

src/components/documents/DocumentDrawer.jsx
src/components/documents/DocumentStatus.jsx
src/components/documents/ChunkViewer.jsx
src/components/documents/EntityViewer.jsx
src/components/documents/PdfViewer.jsx

src/components/realtime/ReplayControls.jsx
src/components/realtime/RealtimeHeader.jsx
src/components/realtime/LiveParameterStrip.jsx
src/components/realtime/LiveAlertPanel.jsx

src/pages/CorrelationPage.jsx
src/pages/ComparePage.jsx
src/pages/WellForm.jsx
src/pages/DocumentDetailPage.jsx
src/pages/AdminUsersPage.jsx
```

Not every file must be separate if a simpler architecture is better. Avoid unnecessary fragmentation.

---

# 82. TESTING REQUIREMENTS

Before declaring frontend complete, test:

## Authentication

- login
- refresh
- logout
- expired token
- protected route

## Wells

- list
- filter
- open detail
- create
- edit
- delete according to role

## GIS

- active well
- radius
- nearby wells
- selected well
- trajectory
- map navigation

## Events

- list
- filter
- detail
- mitigation
- source evidence

## Parameters

- latest
- trends
- realtime updates

## Similarity

- result list
- score breakdown

## Risk

- evaluate
- active risk
- explanation
- evidence

## Alerts

- generated
- acknowledgement
- resolution
- realtime alert delivery

## Replay

- start
- frames update
- stop
- status

## AI

- query
- well context
- session
- history
- clear history
- sources
- follow-up questions

## Documents

- list
- upload
- processing status
- chunks
- entities
- source file

## Search

- keyword
- filters
- autocomplete
- semantic search

## Analytics

- all six endpoints
- filters

## RBAC

Test at least:

```text
DRILLING_ENGINEER
SUPERVISOR
FIELD_PERSONNEL
DATA_ADMIN
SYSTEM_ADMIN
```

---

# 83. ERROR STATES TO TEST

Test:

```text
Backend offline
401
403
404
500
empty nearby wells
empty events
empty documents
empty similarity
AI unavailable
SSE disconnect
replay unavailable
document processing failure
```

Never replace an API error with fake data.

---

# 84. FINAL DEFINITION OF DONE

The frontend is complete when an evaluator can perform:

```text
LOGIN
 ↓
SELECT ACTIVE WELL
 ↓
SEE CURRENT DEPTH / FORMATION / PARAMETERS
 ↓
OPEN GIS
 ↓
SET RADIUS
 ↓
SEE REAL NEARBY WELLS
 ↓
SELECT OFFSET WELL
 ↓
SEE SIMILARITY
 ↓
SEE DEPTH / FORMATION OVERLAP
 ↓
SEE HISTORICAL EVENTS
 ↓
OPEN EVENT
 ↓
SEE MITIGATION
 ↓
OPEN SOURCE DOCUMENT
 ↓
ASK AI
 ↓
GET GROUNDED ANSWER
 ↓
START REPLAY
 ↓
WATCH PARAMETERS CHANGE
 ↓
APPROACH HISTORICAL RISK ZONE
 ↓
RECEIVE SSE RISK / ALERT
 ↓
CLICK WHY
 ↓
SEE HISTORICAL EVIDENCE
 ↓
ACKNOWLEDGE
 ↓
COMPARE WELLS
 ↓
REVIEW DECISION SUPPORT
```

If any of the above requires hardcoded frontend data while the backend already has the information, the implementation is not complete.

---

# 85. FINAL SIH PRESENTATION SCREEN ORDER

For the live presentation:

```text
1. Login
2. Active Well
3. Current Parameters
4. GIS Nearby Wells
5. Similar Well
6. Depth + Formation Correlation
7. Historical Event
8. Source Document
9. Historical Mitigation
10. AI Assistant
11. Realtime Replay
12. Contextual Risk
13. Alert
14. Alert Evidence
15. Well Comparison
16. Engineer Decision
```

Do not spend the majority of live presentation time on:

```text
Settings
Audit
User Management
CRUD
```

Those should be available but not the centerpiece.

---

# 86. MOST IMPORTANT IMPLEMENTATION PRINCIPLE

The frontend must communicate this chain:

```text
CURRENT CONDITION
       ↓
HISTORICAL CONTEXT
       ↓
CORRELATION
       ↓
EVIDENCE
       ↓
RISK SIGNAL
       ↓
HISTORICAL LESSON
       ↓
ENGINEER REVIEW
```

Not:

```text
INPUT
 ↓
AI
 ↓
MAGIC ANSWER
```

That distinction is central to the identity of eRTMAC-NWIS.

---

# 87. BACKEND/FRONTEND MISMATCHES ALREADY IDENTIFIED

Fix these explicitly:

### Mismatch 1 — realtime endpoint

Frontend currently:

```text
/realtime/:wellId/status
```

Backend:

```text
/realtime/:wellId/state
```

Fix frontend.

### Mismatch 2 — RAG well field

Frontend currently sends:

```text
wellId
```

Backend RAG contract is based around:

```text
wellId / well_id depending on validator
```

Inspect `assistant.validator.js` and use its exact schema. Do not guess.

### Mismatch 3 — search result shape

Frontend expects:

```text
title
subtitle
score
```

Backend returns domain-specific fields such as:

```text
wellName
eventType
depth
formation
description
filename
page
section
relevance
```

Normalize these.

### Mismatch 4 — old frontend demo IDs

Frontend mocks use:

```text
WELL-NHK-014
```

Backend replay is:

```text
NWIS-DEMO-01
```

Use backend canonical demo.

### Mismatch 5 — radius slider

Frontend currently changes a circle.

It must trigger actual nearby-well backend query.

### Mismatch 6 — frontend random parameters

Current:

```js
Math.random()
```

Remove.

Use backend parameter data.

### Mismatch 7 — frontend mock formations

Remove.

Use backend.

### Mismatch 8 — frontend mock events

Remove.

Use backend.

### Mismatch 9 — frontend mock risks

Remove.

Use backend risk engine.

### Mismatch 10 — fake AI fallback

Remove fabricated answer.

Use honest unavailable/error state.

---

# 88. BACKEND CAPABILITIES CURRENTLY UNUSED BY FRONTEND

For reference, these are the backend features that must not remain hidden:

```text
GET /dashboard/overview
GET /dashboard/:wellId

GET /wells/:id/trajectory

GET /wells/:id/formations

GET /wells/:id/events
GET /wells/:id/events/summary
GET /events/:id
GET /events/:id/mitigations

GET /wells/:id/parameters
GET /wells/:id/parameters/latest
GET /wells/:id/parameters/trends

GET /documents/:id/status
GET /documents/:id/chunks
GET /documents/:id/entities
GET /documents/file/:key
POST /documents/:id/reprocess

GET /search/autocomplete
POST /search/vector

GET /assistant/history
DELETE /assistant/history

GET /similarity/:wellId

POST /risks/evaluate
GET /risks/:wellId
GET /risks/:wellId/active

GET /alerts/:wellId
GET /alerts/item/:id
PATCH /alerts/:id/acknowledge
PATCH /alerts/:id/resolve

POST /realtime/replay/start
POST /realtime/replay/stop
GET /realtime/replay/status
GET /realtime/:wellId/state
GET /realtime/:wellId  ← SSE

GET /analytics/events
GET /analytics/formations
GET /analytics/risks
GET /analytics/alerts
GET /analytics/npt
GET /analytics/drilling-performance

POST /compare

GET /audit

GET /users
POST /users
GET /users/:id
PATCH /users/:id
DELETE /users/:id
```

---

# 89. IMPLEMENTATION ORDER FOR THE IDE AGENT

Execute in this order.

## Phase 1 — Integration foundation

```text
1. Fix API client
2. Add missing API methods
3. Add normalizers
4. Add protected routing
5. Add role utilities
6. Remove fake API fallback behavior
```

## Phase 2 — Core active-well intelligence

```text
7. Dashboard backend integration
8. Well detail backend integration
9. Real parameters
10. Real formations
11. Real events
12. Event details
13. Mitigations
14. Evidence panel
```

## Phase 3 — GIS intelligence

```text
15. Active well selector
16. Nearby radius API
17. Nearby metadata
18. Similarity
19. Trajectory
20. Depth/formation correlation
```

## Phase 4 — Risk and realtime

```text
21. Real risk page
22. Risk evaluation
23. Alert lifecycle
24. SSE
25. Replay controls
26. Realtime page
```

## Phase 5 — AI/document intelligence

```text
27. RAG well context
28. RAG sessions
29. RAG sources
30. Follow-up questions
31. Document detail
32. Chunks
33. Entities
34. PDF evidence viewer
35. Search filters
36. Autocomplete
37. Vector search
```

## Phase 6 — Secondary modules

```text
38. Compare
39. Analytics
40. Audit
41. Settings
42. User admin
43. Well CRUD forms
```

## Phase 7 — polish

```text
44. Loading states
45. Empty states
46. Error states
47. Responsive behavior
48. Accessibility
49. visual consistency
50. final build/lint
```

---

# 90. FINAL COMMAND TO THE IDE AGENT

After reading this document:

> Inspect the existing frontend and backend code yourself before changing anything. Implement the missing frontend functionality against the actual backend routes, validators, controllers, services, and response shapes. Do not assume API fields. Do not replace backend functionality. Do not introduce mock data where backend data exists. Reuse existing React, Axios, React Query, Leaflet, Recharts, Framer Motion, and Lucide dependencies. Keep the existing application functional while incrementally replacing placeholders and mocks with real backend integrations.

> Build the P0 SIH workflow first:
>
> **Active Well → Nearby Wells → Similar Wells → Depth/Formation Correlation → Historical Event → Source Evidence → Historical Mitigation → RAG → Realtime Replay → Risk → SSE Alert → Alert Evidence → Well Comparison → Engineer Review.**

> At every step, verify the actual backend contract. If the frontend and backend disagree, fix the frontend contract where possible and do not silently fabricate data.

> When finished, run:
>
> ```bash
> npm run build
> npm run lint
> ```
>
> and fix all build errors and all material lint errors.

> Then perform a manual end-to-end test using the backend's canonical synthetic demo well:
>
> **NWIS-DEMO-01**
>
> and verify that the full SIH presentation workflow can be completed without hardcoded frontend mock data.

---

# 91. FINAL ACCEPTANCE CHECKLIST

## Authentication

- [ ] Login works
- [ ] Refresh works
- [ ] Logout works
- [ ] Protected routes work
- [ ] RBAC visibility works

## Dashboard

- [ ] Real overview endpoint
- [ ] Real alert counts
- [ ] Real risk counts
- [ ] Real event counts
- [ ] Active wells
- [ ] AI health

## Wells

- [ ] Real registry
- [ ] Search/filter
- [ ] Create
- [ ] Edit
- [ ] Delete where authorized

## GIS

- [ ] Active well
- [ ] Radius query
- [ ] Nearby wells
- [ ] Formation match
- [ ] Depth overlap
- [ ] Similarity
- [ ] Trajectory
- [ ] Selected-well intelligence panel

## Well Intelligence

- [ ] Real parameters
- [ ] Real trends
- [ ] Real formations
- [ ] Real events
- [ ] Event detail
- [ ] Mitigations
- [ ] Correlation

## Documents

- [ ] Upload
- [ ] Processing status
- [ ] Document detail
- [ ] Chunks
- [ ] Entities
- [ ] PDF source

## Search

- [ ] Keyword
- [ ] Filters
- [ ] Autocomplete
- [ ] Semantic search
- [ ] Correct result normalization

## AI

- [ ] Well context
- [ ] Session
- [ ] History
- [ ] Sources
- [ ] Follow-up questions
- [ ] No fake fallback

## Risk

- [ ] Real evaluation
- [ ] Active risks
- [ ] Explanation
- [ ] Evidence
- [ ] Model version

## Alerts

- [ ] Real alerts
- [ ] SSE alert
- [ ] Acknowledge
- [ ] Resolve
- [ ] Status lifecycle

## Realtime

- [ ] Current state
- [ ] SSE
- [ ] Replay start
- [ ] Replay stop
- [ ] Replay status
- [ ] Parameter updates
- [ ] Risk updates

## Analytics

- [ ] Events
- [ ] Formations
- [ ] Risks
- [ ] Alerts
- [ ] NPT
- [ ] Drilling performance

## Governance

- [ ] Audit
- [ ] Users
- [ ] Settings
- [ ] Role restrictions

## Quality

- [ ] No random parameter data
- [ ] No fake API fallback records
- [ ] No fake AI answers
- [ ] Demo data visibly labeled
- [ ] Build passes
- [ ] Lint passes
- [ ] SIH demo flow works end-to-end

---

# 92. THE SINGLE MOST IMPORTANT SUCCESS CRITERION

If a judge asks:

> **"Show me what happens when the active well approaches a problematic zone."**

The frontend must be able to do this live:

```text
NWIS-DEMO-01
      ↓
2850m
      ↓
Kopili Formation
      ↓
Nearby historical wells
      ↓
Similarity
      ↓
Historical mud-loss events
      ↓
Source report
      ↓
Historical mitigation
      ↓
Replay starts
      ↓
Torque ↑
ROP ↓
      ↓
Risk engine
      ↓
HIGH / contextual mud-loss signal
      ↓
SSE alert
      ↓
"Why?"
      ↓
2 historical wells
3 evidence events
      ↓
Engineer reviews evidence
```

That is the frontend implementation that turns the existing backend into a complete SIH demonstration.

**Do not optimize for number of pages. Optimize for completion of this operational intelligence loop.**