// =============================================================================
// NWIS Backend — Planning Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planning.controller');
const { optionalAuth } = require('../middleware/auth');

// Get DGH Blocks: GET /api/planning/blocks
router.get('/blocks', optionalAuth, planningController.getBlocks);

// Evaluate Location: POST /api/planning/evaluate
router.post('/evaluate', optionalAuth, planningController.evaluate);

// Formation Top Statistics (P10/P50/P90): GET /api/planning/formation-stats
router.get('/formation-stats', optionalAuth, planningController.getFormationStats);

module.exports = router;
