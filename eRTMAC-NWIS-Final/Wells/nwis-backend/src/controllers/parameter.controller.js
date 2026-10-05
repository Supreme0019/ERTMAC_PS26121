// =============================================================================
// NWIS Backend — Parameter Controller
// =============================================================================

const parameterService = require('../services/parameter.service');
const { success, notFound } = require('../utils/response');

const parameterController = {
  async getByWell(req, res, next) {
    try {
      const params = await parameterService.getParameters(req.params.id, {
        fromDepth: req.query.from_depth ? parseFloat(req.query.from_depth) : undefined,
        toDepth: req.query.to_depth ? parseFloat(req.query.to_depth) : undefined,
        limit: parseInt(req.query.limit || 500),
      });
      return success(res, { wellId: req.params.id, parameters: params });
    } catch (err) { next(err); }
  },

  async add(req, res, next) {
    try {
      const param = await parameterService.addParameter({ ...req.body, well_id: req.params.id });
      return success(res, { parameter: param }, 201);
    } catch (err) { next(err); }
  },

  async addBatch(req, res, next) {
    try {
      const params = await parameterService.addBatchParameters(req.params.id, req.body.parameters);
      return success(res, { parameters: params }, 201);
    } catch (err) { next(err); }
  },

  async getLatest(req, res, next) {
    try {
      const latest = await parameterService.getLatest(req.params.id);
      if (!latest) return success(res, { parameter: null });
      return success(res, { parameter: latest });
    } catch (err) { next(err); }
  },

  async getTrends(req, res, next) {
    try {
      const trends = await parameterService.computeTrends(req.params.id, {
        fromDepth: req.query.from_depth ? parseFloat(req.query.from_depth) : undefined,
        toDepth: req.query.to_depth ? parseFloat(req.query.to_depth) : undefined,
      });
      return success(res, { wellId: req.params.id, ...trends });
    } catch (err) { next(err); }
  },
};

module.exports = parameterController;
