// =============================================================================
// NWIS Backend — Central Router
// =============================================================================
// Combines and mounts all domain routes under the /api prefix.
// =============================================================================

const express = require('express');
const router = express.Router();
const http = require('http');

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const wellsRoutes = require('./wells.routes');
const formationRoutes = require('./formation.routes');
const eventRoutes = require('./event.routes');
const documentRoutes = require('./document.routes');
const searchRoutes = require('./search.routes');
const assistantRoutes = require('./assistant.routes');
const similarityRoutes = require('./similarity.routes');
const riskRoutes = require('./risk.routes');
const alertRoutes = require('./alert.routes');
const realtimeRoutes = require('./realtime.routes');
const dashboardRoutes = require('./dashboard.routes');
const auditRoutes = require('./audit.routes');
const analyticsRoutes = require('./analytics.routes');
const compareRoutes = require('./compare.routes');
const planningRoutes = require('./planning.routes');
const mlRoutes = require('./ml.routes');

// ─── Health Check helpers ────────────────────────────────────────────────────

/** Run SELECT 1 and PostGIS_Version() against the live pool. */
async function checkDatabase() {
  const db = require('../config/database');
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    const latency_ms = Date.now() - start;
    let postgis = { status: 'unavailable', version: null };
    try {
      const pgRes = await db.query('SELECT PostGIS_Version() AS version');
      postgis = { status: 'ok', version: pgRes.rows[0]?.version ?? null };
    } catch {
      postgis = { status: 'unavailable', version: null };
    }
    return { db: { status: 'ok', latency_ms }, postgis };
  } catch (err) {
    return {
      db: { status: 'down', error: err.message, latency_ms: Date.now() - start },
      postgis: { status: 'unknown', version: null },
    };
  }
}

/** Ping the AI (assistant) service. Non-critical — degraded, not down. */
function checkAiService() {
  const env = require('../config/env');
  const aiUrl = env.AI_SERVICE_URL || 'http://localhost:5001';
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(`${aiUrl}/health`, { timeout: 2000 }, (res) => {
      res.resume();
      resolve({ status: res.statusCode === 200 ? 'ok' : 'degraded', latency_ms: Date.now() - start, url: aiUrl });
    });
    req.on('error', (err) => {
      resolve({ status: 'unreachable', error: err.message, latency_ms: Date.now() - start, url: aiUrl });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'timeout', latency_ms: Date.now() - start, url: aiUrl });
    });
  });
}

/** Read per-well replay state without triggering any side effects. */
function checkReplay() {
  try {
    const replayService = require('../services/replay.service');
    const DEMO_WELL = 'b1000000-0000-0000-0000-000000000001';
    const status = replayService.getStatus(DEMO_WELL);
    return {
      status: 'ok',
      is_replaying: status.isReplaying,
      well_id: DEMO_WELL,
      progress_pct: status.progress,
      current_phase: status.currentPhaseLabel ?? null,
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

// Health Check — real I/O probes, returns 503 when DB is down
router.get('/health', async (req, res) => {
  try {
    const [dbChecks, aiCheck] = await Promise.all([checkDatabase(), checkAiService()]);
    const replayCheck = checkReplay();

    const isDown = dbChecks.db.status === 'down';
    const overallStatus = isDown ? 'unhealthy' : 'healthy';

    return res.status(isDown ? 503 : 200).json({
      status: overallStatus,
      system: 'eRTMAC-NWIS Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        db: dbChecks.db,
        postgis: dbChecks.postgis,
        ai_service: aiCheck,
        replay: replayCheck,
      },
    });
  } catch (err) {
    return res.status(503).json({
      status: 'unhealthy',
      system: 'eRTMAC-NWIS Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
});
const wellService = require('../services/well.service');
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Middleware to transparently resolve well names (e.g. WELL-A-102, SYN-001) to database UUIDs
router.use(async (req, res, next) => {
  try {
    if (req.query?.well_id && !uuidRegex.test(req.query.well_id)) {
      const w = await wellService.getWellByIdOrName(req.query.well_id);
      if (w) req.query.well_id = w.id;
    }
    if (req.body && typeof req.body === 'object') {
      if (req.body.well_id && !uuidRegex.test(req.body.well_id)) {
        const w = await wellService.getWellByIdOrName(req.body.well_id);
        if (w) req.body.well_id = w.id;
      }
      if (req.body.wellId && !uuidRegex.test(req.body.wellId)) {
        const w = await wellService.getWellByIdOrName(req.body.wellId);
        if (w) req.body.wellId = w.id;
      }
    }
    const urlParts = req.url.split('?');
    const segments = urlParts[0].split('/');
    for (let i = 1; i < segments.length; i++) {
      const seg = decodeURIComponent(segments[i]);
      if (seg && !uuidRegex.test(seg) && !['overview', 'latest', 'trends', 'handover', 'compare', 'nearby', 'events', 'formations', 'parameters', 'state', 'witsml', 'replay', 'vector', 'query', 'evaluate', 'compute', 'active', 'risk', 'ai-config', 'login', 'register', 'me', 'refresh', 'logout'].includes(seg.toLowerCase())) {
        const w = await wellService.getWellByIdOrName(seg);
        if (w) {
          segments[i] = w.id;
          req.url = segments.join('/') + (urlParts[1] ? '?' + urlParts[1] : '');
          break;
        }
      }
    }
  } catch (_) {
    // Continue cleanly
  }
  next();
});

// Domain Routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/wells', wellsRoutes);
router.use('/formations', formationRoutes);
router.use('/events', eventRoutes);
router.use('/documents', documentRoutes);
router.use('/search', searchRoutes);
router.use('/assistant', assistantRoutes);
router.use('/similarity', similarityRoutes);
router.use('/risks', riskRoutes);
router.use('/alerts', alertRoutes);
router.use('/realtime', realtimeRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/audit', auditRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/compare', compareRoutes);
router.use('/planning', planningRoutes);
router.use('/ml', mlRoutes);

module.exports = router;
