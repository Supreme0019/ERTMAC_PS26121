// =============================================================================
// NWIS Backend — Formation Controller
// =============================================================================

const formationService = require('../services/formation.service');
const wellService = require('../services/well.service');
const { success, notFound } = require('../utils/response');

const formationController = {
  async listAll(req, res, next) {
    try {
      const formations = await formationService.listFormations();
      return success(res, { formations });
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const formation = await formationService.getFormation(req.params.id);
      if (!formation) return notFound(res, 'Formation');
      return success(res, { formation });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const formation = await formationService.createFormation(req.body);
      return success(res, { formation }, 201);
    } catch (err) { next(err); }
  },

  async getWellFormations(req, res, next) {
    try {
      const formations = await wellService.getFormations(req.params.id);
      return success(res, { wellId: req.params.id, formations });
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },

  async assignToWell(req, res, next) {
    try {
      const result = await wellService.assignFormation(req.params.id, req.body);
      return success(res, { assignment: result }, 201);
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },

  async getWellsByFormation(req, res, next) {
    try {
      const wells = await formationService.getWellsByFormation(req.params.id);
      return success(res, { wells });
    } catch (err) { next(err); }
  },
};

module.exports = formationController;
