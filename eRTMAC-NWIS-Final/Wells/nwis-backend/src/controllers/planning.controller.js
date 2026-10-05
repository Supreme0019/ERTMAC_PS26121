// =============================================================================
// NWIS Backend — Planning Controller
// =============================================================================

const planningService = require('../services/planning.service');
const { success, error } = require('../utils/response');

const planningController = {
  /**
   * Get DGH Blocks list
   */
  async getBlocks(req, res, next) {
    try {
      const blocks = await planningService.getBlocks();
      return success(res, { blocks });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Evaluate proposed well planning coordinates
   */
  async evaluate(req, res, next) {
    try {
      const { latitude, longitude, target_depth } = req.body;
      if (!latitude || !longitude) {
        return error(res, 'VALIDATION_ERROR', 'latitude and longitude are required', 400);
      }
      if (!target_depth || isNaN(target_depth) || target_depth <= 0) {
        return error(res, 'VALIDATION_ERROR', 'target_depth must be a positive number', 400);
      }

      const evaluation = await planningService.evaluateLocation(req.body);
      return success(res, evaluation);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get P10/P50/P90 formation top statistics from nearby offset wells
   */
  async getFormationStats(req, res, next) {
    try {
      const { well_id, wellId, formation } = req.query;
      const targetWellId = well_id || wellId;
      if (!targetWellId) {
        return error(res, 'VALIDATION_ERROR', 'well_id query parameter is required', 400);
      }
      const stats = await planningService.getFormationTopStatistics(targetWellId, formation || 'kopili');
      return success(res, stats);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = planningController;
