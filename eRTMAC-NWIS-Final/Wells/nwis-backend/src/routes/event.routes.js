// =============================================================================
// NWIS Backend — Event Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole, requireAdmin, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createEventSchema, updateEventSchema, eventQuerySchema, mitigationSchema } = require('../validators/event.validator');

// Create a new event
router.post(
  '/',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ body: createEventSchema }),
  eventController.create
);

// Add mitigation to an event
router.post(
  '/mitigations',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ body: mitigationSchema }),
  eventController.addMitigation
);

// Single event operations
router.get('/:id', optionalAuth, eventController.getById);
router.patch(
  '/:id',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ body: updateEventSchema }),
  eventController.update
);
router.delete('/:id', authenticate, requireAdmin, eventController.delete);

// Mitigations for an event
router.get('/:id/mitigations', optionalAuth, eventController.getMitigations);

module.exports = router;
