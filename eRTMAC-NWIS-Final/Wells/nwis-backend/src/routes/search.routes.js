// =============================================================================
// NWIS Backend — Search Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { searchQuerySchema, autocompleteSchema, vectorSearchSchema } = require('../validators/search.validator');

// Unified search (hybrid structured + keyword + AI vector search)
router.post('/', optionalAuth, validate({ body: searchQuerySchema }), searchController.search);

// Autocomplete suggestions
router.get('/autocomplete', optionalAuth, validate({ query: autocompleteSchema }), searchController.autocomplete);

// Vector/semantic search
router.post('/vector', optionalAuth, validate({ body: vectorSearchSchema }), searchController.vectorSearch);

module.exports = router;
