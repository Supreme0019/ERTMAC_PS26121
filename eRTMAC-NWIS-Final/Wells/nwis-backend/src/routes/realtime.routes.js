// =============================================================================
// NWIS Backend — Realtime Routes (SSE & Replay & WITSML)
// =============================================================================

const express = require('express');
const router = express.Router();
const realtimeController = require('../controllers/realtime.controller');
const replayService = require('../services/replay.service');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { pushDataSchema, replayStartSchema, wellIdParamSchema } = require('../validators/realtime.validator');
const { success } = require('../utils/response');

// Replay simulation controls (for live SIH demonstrations)
router.post('/replay/start', authenticate, validate({ body: replayStartSchema }), (req, res) => {
  const result = replayService.start(req.body.wellId, req.body.speedMs);
  return success(res, result);
});

router.post('/replay/stop', authenticate, (req, res) => {
  const result = replayService.stop();
  return success(res, result);
});

router.get('/replay/status', optionalAuth, (req, res) => {
  return success(res, replayService.getStatus());
});

// Current realtime state
router.get('/:wellId/state', optionalAuth, validate({ params: wellIdParamSchema }), realtimeController.getState);

// Push drilling data point (eRTMAC connector with quality gate)
router.post(
  '/:wellId/push',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ params: wellIdParamSchema, body: pushDataSchema }),
  realtimeController.pushData
);

// Ingest WITSML 1.4 XML log document through Data Quality Gate
router.post(
  '/:wellId/witsml',
  optionalAuth,
  realtimeController.uploadWitsml
);

// Realtime SSE stream: GET /api/realtime/:wellId
router.get('/:wellId', realtimeController.stream);

module.exports = router;
