// =============================================================================
// NWIS Backend — Trajectory Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const trajectoryController = require('../controllers/trajectory.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { trajectoryBatchSchema } = require('../validators/well.validator');

// Trajectory for a well: GET /api/wells/:id/trajectory
router.get('/:id/trajectory', optionalAuth, trajectoryController.get);
router.post(
  '/:id/trajectory',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ body: trajectoryBatchSchema }),
  trajectoryController.add
);

module.exports = router;
