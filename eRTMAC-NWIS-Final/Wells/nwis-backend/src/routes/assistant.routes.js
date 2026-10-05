// =============================================================================
// NWIS Backend — Assistant (RAG) Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistant.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { askSchema, sessionQuerySchema } = require('../validators/assistant.validator');

// Assistant RAG query: retrieves offset wells, formation context, events, chunks -> AI synthesis
router.post('/query', authenticate, aiLimiter, validate({ body: askSchema }), assistantController.query);

// Get conversation history for a session
router.get('/history', authenticate, validate({ query: sessionQuerySchema }), assistantController.getHistory);

// Clear a session's conversation history
router.delete('/history', authenticate, validate({ query: sessionQuerySchema }), assistantController.clearHistory);

module.exports = router;
