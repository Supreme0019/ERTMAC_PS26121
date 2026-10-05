// =============================================================================
// NWIS Backend — Wells Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const wellsController = require('../controllers/wells.controller');
const trajectoryController = require('../controllers/trajectory.controller');
const formationController = require('../controllers/formation.controller');
const eventController = require('../controllers/event.controller');
const parameterController = require('../controllers/parameter.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole, requireAdmin, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const {
  createWellSchema,
  updateWellSchema,
  nearbyQuerySchema,
  trajectoryBatchSchema,
  formationAssignSchema,
} = require('../validators/well.validator');
const { eventQuerySchema } = require('../validators/event.validator');

// Spatial nearby query (PostGIS): GET /api/wells/nearby?lat=...&lon=...&radius=10
router.get('/nearby', validate({ query: nearbyQuerySchema }), wellsController.nearby);

// Well comparison: POST /api/wells/compare
router.post('/compare', optionalAuth, wellsController.compare);

// Well CRUD
router.get('/', optionalAuth, wellsController.getAll);
router.post(
  '/',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ body: createWellSchema }),
  wellsController.create
);

// Individual well nearby spatial analysis: GET /api/wells/:id/nearby?radius=10
router.get('/:id/nearby', optionalAuth, wellsController.nearbyByWell);

// Scoped Sub-resources for a Well:
// 1. Trajectory
router.get('/:id/trajectory', optionalAuth, trajectoryController.get);
router.post(
  '/:id/trajectory',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ body: trajectoryBatchSchema }),
  trajectoryController.add
);

// 2. Formations
router.get('/:id/formations', optionalAuth, formationController.getWellFormations);
router.post(
  '/:id/formations',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ body: formationAssignSchema }),
  formationController.assignToWell
);

// 3. Events
router.get('/:id/events', optionalAuth, validate({ query: eventQuerySchema }), eventController.getByWell);
router.get('/:id/events/summary', optionalAuth, eventController.getSummary);

// 4. Drilling Parameters
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

// 5. Shift Handover Report: GET /api/wells/:id/handover
router.get('/:id/handover', optionalAuth, wellsController.getHandoverReport);

// Single Well Details, Update & Delete
router.get('/:id', optionalAuth, wellsController.getById);
router.patch(
  '/:id',
  authenticate,
  requireRole(ROLES.DRILLING_ENGINEER, ROLES.SUPERVISOR, ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN),
  validate({ body: updateWellSchema }),
  wellsController.update
);
router.delete('/:id', authenticate, requireAdmin, wellsController.delete);

module.exports = router;
