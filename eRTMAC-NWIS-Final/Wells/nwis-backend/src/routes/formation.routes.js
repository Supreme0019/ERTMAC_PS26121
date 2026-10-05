// =============================================================================
// NWIS Backend — Formation Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const formationController = require('../controllers/formation.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { formationAssignSchema } = require('../validators/well.validator');

// List all formations
router.get('/', optionalAuth, formationController.listAll);

// Create a formation (Admin)
router.post('/', authenticate, requireAdmin, formationController.create);

// Get single formation details
router.get('/:id', optionalAuth, formationController.getById);

// Get wells penetrating a formation
router.get('/:id/wells', optionalAuth, formationController.getWellsByFormation);

module.exports = router;
