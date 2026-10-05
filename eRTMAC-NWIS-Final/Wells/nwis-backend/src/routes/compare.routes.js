// =============================================================================
// NWIS Backend — Compare Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const wellsController = require('../controllers/wells.controller');
const { optionalAuth } = require('../middleware/auth');

// Side-by-side well comparison: POST /api/compare
router.post('/', optionalAuth, wellsController.compare);

module.exports = router;
