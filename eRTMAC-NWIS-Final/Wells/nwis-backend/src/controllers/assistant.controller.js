// =============================================================================
// NWIS Backend — Assistant (RAG) Controller
// =============================================================================

const ragService = require('../services/rag.service');
const auditService = require('../services/audit.service');
const { success, notFound } = require('../utils/response');

const assistantController = {
  async query(req, res, next) {
    try {
      const result = await ragService.query({
        question: req.body.question,
        wellId: req.body.well_id,
        wellName: req.body.well_name,
        sessionId: req.body.session_id,
        context: req.body.context,
      });

      await auditService.log({
        userId: req.user.id, action: 'RAG_QUERY',
        resourceType: 'assistant', resourceId: null,
        newData: { question: req.body.question, wellId: req.body.well_id, sessionId: req.body.session_id },
        req,
      });

      return success(res, result);
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },

  async getHistory(req, res, next) {
    try {
      const history = ragService.getHistory(req.query.session_id);
      if (!history) return notFound(res, 'Session');
      return success(res, history);
    } catch (err) { next(err); }
  },

  async clearHistory(req, res, next) {
    try {
      const cleared = ragService.clearHistory(req.query.session_id);
      return success(res, { cleared, session_id: req.query.session_id });
    } catch (err) { next(err); }
  },
};

module.exports = assistantController;
