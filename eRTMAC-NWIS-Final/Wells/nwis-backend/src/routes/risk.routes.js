// =============================================================================
// NWIS Backend — Risk Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const riskController = require('../controllers/risk.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { riskEvaluateSchema, riskQuerySchema } = require('../validators/risk.validator');

// Evaluate risk at depth: POST /api/risks/evaluate
router.post('/evaluate', authenticate, validate({ body: riskEvaluateSchema }), riskController.evaluate);

// Active risks for a well: GET /api/risks/:wellId/active
router.get('/:wellId/active', optionalAuth, riskController.getActive);

// Risk predictions history for a well: GET /api/risks/:wellId
router.get('/:wellId', optionalAuth, validate({ query: riskQuerySchema }), riskController.getByWell);

module.exports = router;
