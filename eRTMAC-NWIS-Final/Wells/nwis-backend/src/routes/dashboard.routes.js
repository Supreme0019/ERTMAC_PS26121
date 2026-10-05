// =============================================================================
// NWIS Backend — Dashboard Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { dashboardQuerySchema } = require('../validators/analytics.validator');

// System-wide overview (all wells): GET /api/dashboard/overview
router.get('/overview', optionalAuth, validate({ query: dashboardQuerySchema }), dashboardController.getOverview);

// Aggregated well intelligence dashboard (single call for GIS map, risks, alerts, parameters)
router.get('/:wellId', optionalAuth, dashboardController.getWellDashboard);

module.exports = router;
