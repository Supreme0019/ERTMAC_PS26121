// =============================================================================
// NWIS Backend — Search Controller
// =============================================================================

const searchService = require('../services/search.service');
const { success } = require('../utils/response');

const searchController = {
  async search(req, res, next) {
    try {
      const results = await searchService.search({
        query: req.body.q,
        wellId: req.body.well_id,
        type: req.body.type,
        formation: req.body.formation,
        eventType: req.body.event_type,
        severity: req.body.severity,
        fromDepth: req.body.from_depth,
        toDepth: req.body.to_depth,
        useAI: req.body.use_ai,
        limit: req.body.limit,
      });
      return success(res, { results, total: results.length });
    } catch (err) { next(err); }
  },

  async autocomplete(req, res, next) {
    try {
      const suggestions = await searchService.autocomplete(req.query.q, {
        limit: parseInt(req.query.limit, 10) || 8,
      });
      return success(res, { suggestions });
    } catch (err) { next(err); }
  },

  async vectorSearch(req, res, next) {
    try {
      const results = await searchService.vectorSearch(req.body.query, {
        wellId: req.body.well_id,
        limit: req.body.limit,
      });
      return success(res, { results, total: results.length });
    } catch (err) { next(err); }
  },
};

module.exports = searchController;
