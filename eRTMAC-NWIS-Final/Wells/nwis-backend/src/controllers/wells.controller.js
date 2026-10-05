// =============================================================================
// NWIS Backend — Wells Controller
// =============================================================================

const wellService = require('../services/well.service');
const nearbyWellService = require('../services/nearbyWell.service');
const auditService = require('../services/audit.service');
const { success, paginated, notFound, error } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const wellsController = {
  async create(req, res, next) {
    try {
      const well = await wellService.createWell(req.body);
      await auditService.log({ userId: req.user.id, action: 'CREATE_WELL', resourceType: 'well', resourceId: well.id, newData: well, req });
      return success(res, { well }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getAll(req, res, next) {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { wells, total } = await wellService.listWells({ ...req.query, limit, offset });
      return paginated(res, { wells }, buildPaginationMeta(total, page, limit));
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const well = await wellService.getWellByIdOrName(req.params.id);
      if (!well) return notFound(res, 'Well');
      return success(res, { well });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const well = await wellService.updateWell(req.params.id, req.body);
      await auditService.log({ userId: req.user.id, action: 'UPDATE_WELL', resourceType: 'well', resourceId: req.params.id, newData: req.body, req });
      return success(res, { well });
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await wellService.deleteWell(req.params.id);
      await auditService.log({ userId: req.user.id, action: 'DELETE_WELL', resourceType: 'well', resourceId: req.params.id, req });
      return success(res, { message: 'Well deleted' });
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },

  async nearby(req, res, next) {
    try {
      const { lat, lon, radius, formation, status, limit } = req.query;
      const wells = await nearbyWellService.findNearby(
        parseFloat(lon), parseFloat(lat), parseFloat(radius || 10),
        { formation, status, limit: parseInt(limit || 20) }
      );
      return success(res, { wells, radius_km: parseFloat(radius || 10), total: wells.length });
    } catch (err) {
      next(err);
    }
  },

  async nearbyByWell(req, res, next) {
    try {
      const radius = parseFloat(req.query.radius || 10);
      const result = await nearbyWellService.findNearbyWithAnalysis(req.params.id, radius);
      return success(res, result);
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, 'Well');
      next(err);
    }
  },

  async compare(req, res, next) {
    try {
      const wellIds = req.body.wellIds || req.body.well_ids;
      if (!wellIds || !Array.isArray(wellIds)) {
        return error(res, 'VALIDATION_ERROR', 'wellIds must be an array of at least 2 well IDs or names', 400);
      }
      const result = await wellService.compareWells(wellIds);
      return success(res, result);
    } catch (err) {
      if (err.code === 'WELL_NOT_FOUND') return notFound(res, err.message);
      if (err.code === 'VALIDATION_ERROR') return error(res, err.code, err.message, 400);
      next(err);
    }
  },

  async getHandoverReport(req, res, next) {
    try {
      const handoverService = require('../services/handover.service');
      const report = await handoverService.generateHandoverReport(req.params.id);
      return success(res, report);
    } catch (err) {
      if (err.status === 404 || err.code === 'WELL_NOT_FOUND') return notFound(res, err.message);
      next(err);
    }
  },
};

module.exports = wellsController;
