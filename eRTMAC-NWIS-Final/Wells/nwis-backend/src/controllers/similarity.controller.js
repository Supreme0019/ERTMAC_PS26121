// =============================================================================
// NWIS Backend — Similarity Controller
// =============================================================================

const similarityService = require('../services/similarity.service');
const { success, notFound } = require('../utils/response');

const similarityController = {
  async compute(req, res, next) {
    try {
      const wellId = req.params?.wellId || req.body?.wellId || req.query?.wellId;
      const radiusKm = parseFloat(req.query?.radiusKm || req.query?.radius || req.body?.radiusKm || req.body?.radius || 20);
      const limit = parseInt(req.query?.limit || req.body?.limit || 10, 10);

      const result = await similarityService.computeSimilarity(wellId, {
        radiusKm,
        limit,
      });
      return success(res, result);
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },
};

module.exports = similarityController;
