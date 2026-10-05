// =============================================================================
// NWIS Backend — Risk Controller
// =============================================================================

const riskService = require('../services/risk.service');
const auditService = require('../services/audit.service');
const { success, paginated, notFound } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const riskController = {
  async getByWell(req, res, next) {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const result = await riskService.getRisks(req.params.wellId, { ...req.query, limit, offset });
      return paginated(res, { predictions: result.predictions }, buildPaginationMeta(result.total, page, limit));
    } catch (err) { next(err); }
  },

  async evaluate(req, res, next) {
    try {
      const result = await riskService.evaluate(req.body.well_id, req.body.depth);
      await auditService.log({
        userId: req.user.id, action: 'EVALUATE_RISK',
        resourceType: 'risk', resourceId: req.body.well_id,
        newData: { depth: req.body.depth, risksFound: result.risks.length },
        req,
      });
      return success(res, result);
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },

  async getActive(req, res, next) {
    try {
      const risks = await riskService.getActiveRisks(req.params.wellId);
      return success(res, { risks });
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },
};

module.exports = riskController;
