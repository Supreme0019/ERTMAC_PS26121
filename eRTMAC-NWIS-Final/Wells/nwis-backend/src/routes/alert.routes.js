// =============================================================================
// NWIS Backend — Alert Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');

// Acknowledge alert: PATCH /api/alerts/:id/acknowledge
router.patch(
  '/:id/acknowledge',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.SYSTEM_ADMIN),
  alertController.acknowledge
);

// Resolve alert: PATCH /api/alerts/:id/resolve
router.patch(
  '/:id/resolve',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.SYSTEM_ADMIN),
  alertController.resolve
);

// Feedback on alert: PATCH /api/alerts/:id/feedback
router.patch(
  '/:id/feedback',
  authenticate,
  alertController.feedback
);

// Get single alert: GET /api/alerts/item/:id
router.get('/item/:id', optionalAuth, alertController.getById);

// Get alerts for a well: GET /api/alerts/:wellId
router.get('/:wellId', optionalAuth, alertController.getByWell);

module.exports = router;
