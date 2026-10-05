// =============================================================================
// NWIS Backend — Audit Controller
// =============================================================================
// Allows administrators to query and filter operational audit logs.
// =============================================================================

const auditService = require('../services/audit.service');
const { paginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const auditController = {
  /**
   * Get filtered audit logs with pagination.
   */
  async getLogs(req, res, next) {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { userId, action, resourceType, resourceId, from, to } = req.query;

      const { logs, total } = await auditService.getLogs({
        userId,
        action,
        resourceType,
        resourceId,
        from,
        to,
        limit,
        offset,
      });

      return paginated(res, { logs }, buildPaginationMeta(total, page, limit));
    } catch (err) {
      next(err);
    }
  },
};

module.exports = auditController;
