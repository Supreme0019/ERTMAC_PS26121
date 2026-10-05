// =============================================================================
// NWIS Backend — Trajectory Controller
// =============================================================================

const wellService = require('../services/well.service');
const { success, notFound } = require('../utils/response');

const trajectoryController = {
  async get(req, res, next) {
    try {
      const trajectory = await wellService.getTrajectory(req.params.id);
      return success(res, { wellId: req.params.id, trajectory });
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },

  async add(req, res, next) {
    try {
      const points = await wellService.addTrajectoryPoints(req.params.id, req.body.points);
      return success(res, { points }, 201);
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },
};

module.exports = trajectoryController;
