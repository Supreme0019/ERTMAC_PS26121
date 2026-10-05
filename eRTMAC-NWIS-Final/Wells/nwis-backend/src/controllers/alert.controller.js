// =============================================================================
// NWIS Backend — Alert Controller
// =============================================================================

const alertService = require('../services/alert.service');
const { success, paginated, notFound } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const alertController = {
  async getByWell(req, res, next) {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const result = await alertService.getAlerts(req.params.wellId, { ...req.query, limit, offset });
      return paginated(res, { alerts: result.alerts }, buildPaginationMeta(result.total, page, limit));
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const alert = await alertService.getAlert(req.params.id);
      return success(res, { alert });
    } catch (err) {
      if (err.code === 'ALERT_NOT_FOUND') return notFound(res, 'Alert');
      next(err);
    }
  },

  async acknowledge(req, res, next) {
    try {
      const alert = await alertService.acknowledge(req.params.id, req.user?.id, req);
      return success(res, { alert });
    } catch (err) {
      if (err.code === 'ALERT_NOT_FOUND') return notFound(res, 'Alert');
      next(err);
    }
  },

  async resolve(req, res, next) {
    try {
      const alert = await alertService.resolve(req.params.id, req.user?.id, req);
      return success(res, { alert });
    } catch (err) {
      if (err.code === 'ALERT_NOT_FOUND') return notFound(res, 'Alert');
      next(err);
    }
  },

  async feedback(req, res, next) {
    try {
      const { feedback } = req.body;
      const alert = await alertService.recordFeedback(req.params.id, feedback, req.user?.id, req);
      return success(res, { alert }, 'Feedback recorded successfully');
    } catch (err) {
      if (err.code === 'ALERT_NOT_FOUND') return notFound(res, 'Alert');
      next(err);
    }
  },
};

module.exports = alertController;
