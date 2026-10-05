// =============================================================================
// NWIS Backend — Similarity Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const similarityController = require('../controllers/similarity.controller');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { similarityParamsSchema, similarityQuerySchema, similarityBodySchema } = require('../validators/similarity.validator');

// Multi-factor similar well engine
router.get(
  '/:wellId',
  optionalAuth,
  validate({ params: similarityParamsSchema, query: similarityQuerySchema }),
  similarityController.compute
);

router.post(
  '/',
  optionalAuth,
  validate({ body: similarityBodySchema }),
  similarityController.compute
);

module.exports = router;
