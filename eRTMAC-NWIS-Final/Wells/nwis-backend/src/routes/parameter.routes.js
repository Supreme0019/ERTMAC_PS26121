// =============================================================================
// NWIS Backend — Parameter Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const parameterController = require('../controllers/parameter.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');

// Parameter routes scoped by well: /api/wells/:id/parameters...
router.get('/:id/parameters', optionalAuth, parameterController.getByWell);
router.post(
  '/:id/parameters',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  parameterController.add
);
router.post(
  '/:id/parameters/batch',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  parameterController.addBatch
);
router.get('/:id/parameters/latest', optionalAuth, parameterController.getLatest);
router.get('/:id/parameters/trends', optionalAuth, parameterController.getTrends);

module.exports = router;
