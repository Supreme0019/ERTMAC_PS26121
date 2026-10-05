// =============================================================================
// NWIS Backend — Well Service
// =============================================================================

const wellRepository = require('../repositories/well.repository');
const logger = require('../utils/logger');

const wellService = {
  /**
   * Create a new well.
   */
  async createWell(wellData) {
    const well = await wellRepository.create(wellData);
    logger.info({ wellId: well.id, name: well.well_name }, 'Well created');
    return well;
  },

  /**
   * Get a well by ID or Name.
   */
  async getWell(id) {
    const well = await this.getWellByIdOrName(id);
    if (!well) {
      throw Object.assign(new Error('Well not found'), { code: 'WELL_NOT_FOUND', status: 404 });
    }
    return well;
  },

  /**
   * Get a well by ID or name.
   */
  async getWellByIdOrName(idOrName) {
    // Try UUID first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrName)) {
      return await wellRepository.findById(idOrName);
    }
    return await wellRepository.findByName(idOrName);
  },

  /**
   * List wells.
   */
  async listWells(filters) {
    return await wellRepository.findAll(filters);
  },

  /**
   * Update a well.
   */
  async updateWell(id, fields) {
    const well = await wellRepository.update(id, fields);
    if (!well) {
      throw Object.assign(new Error('Well not found'), { code: 'WELL_NOT_FOUND', status: 404 });
    }
    logger.info({ wellId: id }, 'Well updated');
    return well;
  },

  /**
   * Delete a well.
   */
  async deleteWell(id) {
    const deleted = await wellRepository.delete(id);
    if (!deleted) {
      throw Object.assign(new Error('Well not found'), { code: 'WELL_NOT_FOUND', status: 404 });
    }
    logger.info({ wellId: id }, 'Well deleted');
    return true;
  },

  /**
   * Get trajectory.
   */
  async getTrajectory(wellId) {
    await this.getWell(wellId); // Verify well exists
    return await wellRepository.getTrajectory(wellId);
  },

  /**
   * Add trajectory points.
   */
  async addTrajectoryPoints(wellId, points) {
    await this.getWell(wellId);
    return await wellRepository.addTrajectoryPoints(wellId, points);
  },

  /**
   * Get formations for a well.
   */
  async getFormations(wellId) {
    await this.getWell(wellId);
    return await wellRepository.getWellFormations(wellId);
  },

  /**
   * Get formation at a specific depth.
   */
  async getFormationAtDepth(wellId, depth) {
    return await wellRepository.getFormationAtDepth(wellId, depth);
  },

  /**
   * Assign formation to well.
   */
  async assignFormation(wellId, formationData) {
    await this.getWell(wellId);
    return await wellRepository.assignFormation(wellId, formationData);
  },

  /**
   * Get drilling parameters.
   */
  async getParameters(wellId, filters) {
    await this.getWell(wellId);
    return await wellRepository.getParameters(wellId, filters);
  },

  /**
   * Add drilling parameter.
   */
  async addParameter(paramData) {
    return await wellRepository.addParameter(paramData);
  },

  /**
   * Get latest parameters for realtime display.
   */
  async getLatestParameters(wellId) {
    return await wellRepository.getLatestParameters(wellId);
  },

  /**
   * Compare multiple wells (2-4 wells) side-by-side with depth overlap and event metrics.
   * @param {string[]} wellIds - Array of well IDs or names
   */
  async compareWells(wellIds) {
    if (!Array.isArray(wellIds) || wellIds.length < 2) {
      throw Object.assign(new Error('At least 2 wells are required for comparison'), {
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    }

    // Resolve all wells
    const wells = await Promise.all(
      wellIds.map(async (idOrName) => {
        const well = await this.getWellByIdOrName(idOrName);
        if (!well) {
          throw Object.assign(new Error(`Well '${idOrName}' not found`), {
            code: 'WELL_NOT_FOUND',
            status: 404,
          });
        }
        return well;
      })
    );

    const refWell = wells[0];
    const { haversineDistance } = require('../utils/distance');
    const db = require('../config/database');

    const comparisons = await Promise.all(
      wells.map(async (well, idx) => {
        // Distance relative to reference well
        const distKm =
          idx === 0
            ? 0
            : parseFloat(
                haversineDistance(
                  refWell.latitude,
                  refWell.longitude,
                  well.latitude,
                  well.longitude
                ).toFixed(2)
              );

        // Depth overlap with reference well
        const refMaxDepth = parseFloat(refWell.total_depth || refWell.current_depth) || 0;
        const targetMaxDepth = parseFloat(well.total_depth || well.current_depth) || 0;
        const overlapEnd = Math.min(refMaxDepth, targetMaxDepth);
        const depthOverlap = overlapEnd > 0 ? `0-${overlapEnd}` : 'N/A';

        // Query historical event counts
        const eventCounts = await db.query(
          `SELECT
             COUNT(*) FILTER (WHERE event_type = 'mud_loss' OR event_type = 'lost_circulation') AS mud_loss_count,
             COUNT(*) FILTER (WHERE event_type = 'stuck_pipe') AS stuck_pipe_count,
             COUNT(*) FILTER (WHERE event_type = 'kick' OR event_type = 'well_control') AS kick_count,
             COUNT(*) AS total_events
           FROM drilling_events
           WHERE well_id = $1`,
          [well.id]
        );

        const counts = eventCounts.rows[0] || {};

        return {
          id: well.id,
          name: well.well_name,
          field: well.field,
          status: well.status,
          distance: distKm,
          currentDepth: parseFloat(well.current_depth) || 0,
          totalDepth: parseFloat(well.total_depth) || 0,
          currentFormation: well.current_formation_name,
          depthOverlap,
          mudLossEvents: parseInt(counts.mud_loss_count, 10) || 0,
          stuckPipeEvents: parseInt(counts.stuck_pipe_count, 10) || 0,
          kickEvents: parseInt(counts.kick_count, 10) || 0,
          totalEvents: parseInt(counts.total_events, 10) || 0,
        };
      })
    );

    return {
      referenceWell: refWell.well_name,
      wells: comparisons,
    };
  },
};

module.exports = wellService;
