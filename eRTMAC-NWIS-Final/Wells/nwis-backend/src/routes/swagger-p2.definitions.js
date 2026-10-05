// =============================================================================
// NWIS Backend — Swagger / OpenAPI Definitions for Person 2 Routes
// =============================================================================
// This file contains OpenAPI 3.0 JSDoc annotations for all intelligence-layer
// endpoints: Search, Assistant (RAG), Similarity, Risk, Alert, Realtime/SSE,
// Dashboard, and Analytics.
// =============================================================================

// ── SEARCH ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/search:
 *   post:
 *     tags: [Search]
 *     summary: Hybrid search across wells, events, documents, formations
 *     description: Unified search that combines keyword search with optional AI vector search
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [q]
 *             properties:
 *               q:
 *                 type: string
 *                 description: Search query
 *                 example: "mud loss Kopili"
 *               well_id:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [all, wells, events, documents, formations]
 *                 default: all
 *               use_ai:
 *                 type: boolean
 *                 default: false
 *               limit:
 *                 type: integer
 *                 default: 20
 *     responses:
 *       200:
 *         description: Search results sorted by relevance
 */

/**
 * @swagger
 * /api/search/autocomplete:
 *   get:
 *     tags: [Search]
 *     summary: Autocomplete suggestions
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 8
 *     responses:
 *       200:
 *         description: Autocomplete suggestions for wells, formations, event types
 */

/**
 * @swagger
 * /api/search/vector:
 *   post:
 *     tags: [Search]
 *     summary: Semantic/vector search via AI service
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *               well_id:
 *                 type: string
 *                 format: uuid
 *               limit:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Vector search results with relevance scores
 */

// ── ASSISTANT (RAG) ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assistant/query:
 *   post:
 *     tags: [Assistant]
 *     summary: RAG-powered drilling assistant query
 *     description: Retrieves well context (events, formations, nearby wells, parameters, document chunks) and synthesizes an AI answer. Supports multi-turn conversations via session_id.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties:
 *               question:
 *                 type: string
 *                 example: "What risks should I expect at 2850m depth?"
 *               well_id:
 *                 type: string
 *                 format: uuid
 *               well_name:
 *                 type: string
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 description: Session ID for multi-turn conversation
 *               context:
 *                 type: object
 *                 properties:
 *                   depth:
 *                     type: number
 *                   formation:
 *                     type: string
 *                   include_nearby:
 *                     type: boolean
 *                     default: true
 *     responses:
 *       200:
 *         description: AI-synthesized answer with sources and follow-up suggestions
 */

/**
 * @swagger
 * /api/assistant/history:
 *   get:
 *     tags: [Assistant]
 *     summary: Get conversation history for a session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: session_id
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation history
 *       404:
 *         description: Session not found
 *   delete:
 *     tags: [Assistant]
 *     summary: Clear session conversation history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: session_id
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session cleared
 */

// ── SIMILARITY ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/similarity/{wellId}:
 *   get:
 *     tags: [Similarity]
 *     summary: Find similar wells using multi-factor ranking
 *     description: Computes similarity based on formation overlap, depth range, spatial proximity, trajectory match, and historical event correlation.
 *     parameters:
 *       - name: wellId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: radius
 *         in: query
 *         schema:
 *           type: number
 *           default: 20
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Ranked list of similar wells with composite scores
 *       404:
 *         description: Well not found
 */

/**
 * @swagger
 * /api/similarity:
 *   post:
 *     tags: [Similarity]
 *     summary: Find similar wells (POST variant)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [wellId]
 *             properties:
 *               wellId:
 *                 type: string
 *                 format: uuid
 *               radius:
 *                 type: number
 *                 default: 20
 *               limit:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Ranked list of similar wells
 */

// ── RISK ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/risks/evaluate:
 *   post:
 *     tags: [Risk]
 *     summary: Evaluate risk for a well at a given depth
 *     description: Rules-based + historical evidence engine that evaluates 8 risk types (mud_loss, stuck_pipe, kick, etc.)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [well_id]
 *             properties:
 *               well_id:
 *                 type: string
 *                 format: uuid
 *               depth:
 *                 type: number
 *                 description: Depth to evaluate (defaults to current well depth)
 *     responses:
 *       200:
 *         description: Risk evaluation with scores, levels, evidence, and explanations
 */

/**
 * @swagger
 * /api/risks/{wellId}/active:
 *   get:
 *     tags: [Risk]
 *     summary: Get active risks at current depth
 *     parameters:
 *       - name: wellId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Active risk predictions for current depth
 */

/**
 * @swagger
 * /api/risks/{wellId}:
 *   get:
 *     tags: [Risk]
 *     summary: Get risk prediction history for a well
 *     parameters:
 *       - name: wellId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: risk_type
 *         in: query
 *         schema:
 *           type: string
 *       - name: risk_level
 *         in: query
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *     responses:
 *       200:
 *         description: Paginated risk predictions
 */

// ── ALERTS ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/alerts/{wellId}:
 *   get:
 *     tags: [Alerts]
 *     summary: Get alerts for a well
 *     parameters:
 *       - name: wellId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Paginated alerts
 */

/**
 * @swagger
 * /api/alerts/item/{id}:
 *   get:
 *     tags: [Alerts]
 *     summary: Get a single alert by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Alert details (auto-marks as viewed)
 */

/**
 * @swagger
 * /api/alerts/{id}/acknowledge:
 *   patch:
 *     tags: [Alerts]
 *     summary: Acknowledge an alert
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Alert acknowledged
 */

/**
 * @swagger
 * /api/alerts/{id}/resolve:
 *   patch:
 *     tags: [Alerts]
 *     summary: Resolve an alert
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Alert resolved
 */

// ── REALTIME / SSE ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/realtime/{wellId}:
 *   get:
 *     tags: [Realtime]
 *     summary: SSE stream for realtime well updates
 *     description: Server-Sent Events endpoint. Streams well-update, alert, risk-update, and alert-acknowledged events.
 *     parameters:
 *       - name: wellId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: SSE stream (text/event-stream)
 */

/**
 * @swagger
 * /api/realtime/{wellId}/state:
 *   get:
 *     tags: [Realtime]
 *     summary: Get current realtime state for a well
 *     parameters:
 *       - name: wellId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Current drilling parameter state
 */

/**
 * @swagger
 * /api/realtime/{wellId}/push:
 *   post:
 *     tags: [Realtime]
 *     summary: Push a drilling data point (eRTMAC connector)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: wellId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [depth]
 *             properties:
 *               depth:
 *                 type: number
 *               wob:
 *                 type: number
 *               rpm:
 *                 type: number
 *               torque:
 *                 type: number
 *               rop:
 *                 type: number
 *               mud_weight:
 *                 type: number
 *               standpipe_pressure:
 *                 type: number
 *     responses:
 *       200:
 *         description: Updated state
 */

/**
 * @swagger
 * /api/realtime/replay/start:
 *   post:
 *     tags: [Realtime]
 *     summary: Start drilling replay simulation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wellId:
 *                 type: string
 *                 format: uuid
 *               speedMs:
 *                 type: integer
 *                 default: 3000
 *     responses:
 *       200:
 *         description: Replay started
 */

/**
 * @swagger
 * /api/realtime/replay/stop:
 *   post:
 *     tags: [Realtime]
 *     summary: Stop drilling replay simulation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Replay stopped
 */

/**
 * @swagger
 * /api/realtime/replay/status:
 *   get:
 *     tags: [Realtime]
 *     summary: Get current replay status
 *     responses:
 *       200:
 *         description: Replay status including current frame
 */

// ── DASHBOARD ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     tags: [Dashboard]
 *     summary: System-wide overview dashboard
 *     description: Aggregated statistics across all wells — alert counts, risk summaries, active wells, AI service health.
 *     parameters:
 *       - name: field
 *         in: query
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, completed, suspended, abandoned, planned]
 *     responses:
 *       200:
 *         description: System overview with well summary, alert/risk/event counts, and active well states
 */

/**
 * @swagger
 * /api/dashboard/{wellId}:
 *   get:
 *     tags: [Dashboard]
 *     summary: Per-well intelligence dashboard
 *     description: Single aggregated endpoint returning well data, nearby wells, similar wells, active risks, alerts, events, formations, and parameters.
 *     parameters:
 *       - name: wellId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Complete well intelligence dashboard
 *       404:
 *         description: Well not found
 */

// ── ANALYTICS ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/analytics/events:
 *   get:
 *     tags: [Analytics]
 *     summary: Event analytics (by type, severity, formation)
 *     parameters:
 *       - name: well_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: from_date
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: to_date
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Event breakdowns by type, severity, and formation
 */

/**
 * @swagger
 * /api/analytics/formations:
 *   get:
 *     tags: [Analytics]
 *     summary: Formation analytics (traversal stats, events per formation)
 *     parameters:
 *       - name: well_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Formation traversal and event statistics
 */

/**
 * @swagger
 * /api/analytics/risks:
 *   get:
 *     tags: [Analytics]
 *     summary: Risk distribution analytics
 *     parameters:
 *       - name: well_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Risk breakdowns by type and level
 */

/**
 * @swagger
 * /api/analytics/alerts:
 *   get:
 *     tags: [Analytics]
 *     summary: Alert statistics (status breakdown, avg acknowledgement time)
 *     parameters:
 *       - name: well_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Alert status/severity breakdown and average ack time
 */

/**
 * @swagger
 * /api/analytics/npt:
 *   get:
 *     tags: [Analytics]
 *     summary: Non-Productive Time (NPT) analytics
 *     parameters:
 *       - name: well_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: NPT hours by event type and well
 */

/**
 * @swagger
 * /api/analytics/drilling-performance:
 *   get:
 *     tags: [Analytics]
 *     summary: Drilling performance analytics (ROP stats, depth progression)
 *     parameters:
 *       - name: well_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: ROP statistics and depth progression data
 */
