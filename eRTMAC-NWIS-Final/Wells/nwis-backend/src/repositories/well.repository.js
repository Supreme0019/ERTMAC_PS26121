// =============================================================================
// NWIS Backend — Well Repository
// =============================================================================
// Handles all well-related database queries including PostGIS spatial queries.
// =============================================================================

const db = require('../config/database');

const wellRepository = {
  /**
   * Create a new well.
   */
  async create(wellData) {
    const {
      well_name, field, status, latitude, longitude,
      spud_date, total_depth, current_depth, current_formation_id,
    } = wellData;

    const result = await db.query(
      `INSERT INTO wells (well_name, field, status, latitude, longitude, spud_date, total_depth, current_depth, current_formation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [well_name, field, status, latitude, longitude, spud_date, total_depth, current_depth || 0, current_formation_id]
    );
    return result.rows[0];
  },

  /**
   * Find a well by ID.
   */
  async findById(id) {
    if (!id) return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(String(id).trim())) {
      const result = await db.query(
        `SELECT w.*, f.name AS current_formation_name
         FROM wells w
         LEFT JOIN formations f ON w.current_formation_id = f.id
         WHERE w.id = $1`,
        [id]
      );
      return result.rows[0] || null;
    }
    return this.findByName(String(id).trim());
  },

  /**
   * Find a well by name (case-insensitive).
   */
  async findByName(name) {
    if (!name) return null;
    const result = await db.query(
      `SELECT w.*, f.name AS current_formation_name
       FROM wells w
       LEFT JOIN formations f ON w.current_formation_id = f.id
       WHERE LOWER(w.well_name) = LOWER($1)`,
      [name]
    );
    return result.rows[0] || null;
  },

  /**
   * List all wells with optional filtering.
   */
  async findAll({ status, field, limit = 20, offset = 0 }) {
    let whereClause = '';
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`w.status = $${params.length}`);
    }
    if (field) {
      params.push(field);
      conditions.push(`w.field = $${params.length}`);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const result = await db.query(
      `SELECT w.*, f.name AS current_formation_name
       FROM wells w
       LEFT JOIN formations f ON w.current_formation_id = f.id
       ${whereClause}
       ORDER BY w.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    // Count query
    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*) FROM wells w ${whereClause}`,
      countParams
    );

    return {
      wells: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  },

  /**
   * Find nearby wells using PostGIS ST_DWithin.
   * @param {number} lon - Longitude of center point
   * @param {number} lat - Latitude of center point
   * @param {number} radiusKm - Search radius in kilometers
   * @param {object} [filters] - Optional filters (formation, status, limit)
   */
  async findNearby(lon, lat, radiusKm, filters = {}) {
    const radiusMeters = radiusKm * 1000;
    const params = [lon, lat, radiusMeters];
    const conditions = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`w.status = $${params.length}`);
    }

    let formationJoin = '';
    if (filters.formation) {
      formationJoin = `
        LEFT JOIN well_formations wf ON w.id = wf.well_id
        LEFT JOIN formations filt ON wf.formation_id = filt.id`;
      params.push(`%${filters.formation}%`);
      conditions.push(`filt.name ILIKE $${params.length}`);
    }

    const extraWhere = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

    params.push(filters.limit || 20);
    const limitIdx = params.length;

    const result = await db.query(
      `SELECT
          w.id, w.well_name, w.field, w.status,
          w.latitude, w.longitude,
          w.current_depth, w.total_depth,
          f.name AS current_formation_name,
          ST_Distance(
            w.location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) AS distance_m
       FROM wells w
       LEFT JOIN formations f ON w.current_formation_id = f.id
       ${formationJoin}
       WHERE ST_DWithin(
         w.location,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       )
       ${extraWhere}
       ORDER BY distance_m
       LIMIT $${limitIdx}`,
      params
    );

    return result.rows.map((row) => ({
      ...row,
      distance_km: parseFloat((row.distance_m / 1000).toFixed(2)),
    }));
  },

  /**
   * Update a well.
   */
  async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const values = Object.values(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const result = await db.query(
      `UPDATE wells SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a well.
   */
  async delete(id) {
    const result = await db.query('DELETE FROM wells WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  },

  // ── Trajectory ──────────────────────────────────────────────────────────

  /**
   * Get trajectory points for a well.
   */
  async getTrajectory(wellId) {
    const result = await db.query(
      `SELECT id, measured_depth, tvd, latitude, longitude, inclination, azimuth, created_at
       FROM well_trajectories
       WHERE well_id = $1
       ORDER BY measured_depth ASC`,
      [wellId]
    );
    return result.rows;
  },

  /**
   * Add trajectory points (batch).
   */
  async addTrajectoryPoints(wellId, points) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const inserted = [];
      for (const p of points) {
        const result = await client.query(
          `INSERT INTO well_trajectories (well_id, measured_depth, tvd, latitude, longitude, inclination, azimuth)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [wellId, p.measured_depth, p.tvd, p.latitude, p.longitude, p.inclination, p.azimuth]
        );
        inserted.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ── Formations ──────────────────────────────────────────────────────────

  /**
   * Get formations for a well.
   */
  async getWellFormations(wellId) {
    const result = await db.query(
      `SELECT wf.id, wf.top_depth, wf.bottom_depth, wf.metadata,
              f.id AS formation_id, f.name AS formation_name, f.description, f.geological_attributes
       FROM well_formations wf
       JOIN formations f ON wf.formation_id = f.id
       WHERE wf.well_id = $1
       ORDER BY wf.top_depth ASC`,
      [wellId]
    );
    return result.rows;
  },

  /**
   * Get the formation at a specific depth for a well.
   */
  async getFormationAtDepth(wellId, depth) {
    const result = await db.query(
      `SELECT wf.*, f.name AS formation_name, f.geological_attributes
       FROM well_formations wf
       JOIN formations f ON wf.formation_id = f.id
       WHERE wf.well_id = $1 AND $2 BETWEEN wf.top_depth AND wf.bottom_depth
       LIMIT 1`,
      [wellId, depth]
    );
    return result.rows[0] || null;
  },

  /**
   * Assign a formation to a well.
   */
  async assignFormation(wellId, formationData) {
    const { formation_id, top_depth, bottom_depth, metadata } = formationData;
    const result = await db.query(
      `INSERT INTO well_formations (well_id, formation_id, top_depth, bottom_depth, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [wellId, formation_id, top_depth, bottom_depth, metadata || {}]
    );
    return result.rows[0];
  },

  // ── Trajectory (bulk) ───────────────────────────────────────────────────

  /**
   * Get trajectory points for many wells in a single query.
   *
   * @param {string[]} wellIds - array of UUID strings
   * @returns {Promise<Map<string, Array>>} Map of wellId → trajectory rows[]
   */
  async getTrajectoryBulk(wellIds) {
    if (!wellIds || wellIds.length === 0) return new Map();

    const result = await db.query(
      `SELECT id, well_id, measured_depth, tvd, latitude, longitude, inclination, azimuth, created_at
         FROM well_trajectories
        WHERE well_id = ANY($1::uuid[])
        ORDER BY well_id, measured_depth ASC`,
      [wellIds]
    );

    const map = new Map();
    for (const row of result.rows) {
      if (!map.has(row.well_id)) map.set(row.well_id, []);
      map.get(row.well_id).push(row);
    }
    return map;
  },

  // ── Formations (bulk) ───────────────────────────────────────────────────

  /**
   * Get well_formations rows for many wells in a single query.
   * Mirrors getWellFormations but for an array of well IDs.
   *
   * @param {string[]} wellIds - array of UUID strings
   * @returns {Promise<Map<string, Array>>} Map of wellId → formation rows[]
   */
  async getWellFormationsBulk(wellIds) {
    if (!wellIds || wellIds.length === 0) return new Map();

    const result = await db.query(
      `SELECT wf.well_id,
              wf.id, wf.top_depth, wf.bottom_depth, wf.metadata,
              f.id   AS formation_id,
              f.name AS formation_name,
              f.description,
              f.geological_attributes
         FROM well_formations wf
         JOIN formations f ON wf.formation_id = f.id
        WHERE wf.well_id = ANY($1::uuid[])
        ORDER BY wf.well_id, wf.top_depth ASC`,
      [wellIds]
    );

    const map = new Map();
    for (const row of result.rows) {
      if (!map.has(row.well_id)) map.set(row.well_id, []);
      map.get(row.well_id).push(row);
    }
    return map;
  },

  // ── Drilling Parameters ─────────────────────────────────────────────────

  /**
   * Get up to `limit` drilling parameters for many wells in a single query.
   * Uses a window function to cap rows per well, avoiding a runaway result set.
   *
   * @param {string[]} wellIds - array of UUID strings
   * @param {number}   [limit=100] - max rows returned per well
   * @returns {Promise<Map<string, Array>>} Map of wellId → parameter rows[]
   */
  async getParametersBulk(wellIds, limit = 100) {
    if (!wellIds || wellIds.length === 0) return new Map();

    const result = await db.query(
      `SELECT *
         FROM (
           SELECT *,
                  ROW_NUMBER() OVER (PARTITION BY well_id ORDER BY timestamp ASC) AS rn
             FROM drilling_parameters
            WHERE well_id = ANY($1::uuid[])
         ) sub
        WHERE rn <= $2
        ORDER BY well_id, timestamp ASC`,
      [wellIds, limit]
    );

    const map = new Map();
    for (const row of result.rows) {
      if (!map.has(row.well_id)) map.set(row.well_id, []);
      map.get(row.well_id).push(row);
    }
    return map;
  },

  // ── Drilling Parameters (single well) ───────────────────────────────────

  /**
   * Get drilling parameters for a well.
   */
  async getParameters(wellId, { fromDepth, toDepth, limit = 500 }) {
    let whereClause = 'WHERE well_id = $1';
    const params = [wellId];

    if (fromDepth !== undefined) {
      params.push(fromDepth);
      whereClause += ` AND depth >= $${params.length}`;
    }
    if (toDepth !== undefined) {
      params.push(toDepth);
      whereClause += ` AND depth <= $${params.length}`;
    }

    params.push(limit);

    const result = await db.query(
      `SELECT * FROM drilling_parameters
       ${whereClause}
       ORDER BY timestamp ASC
       LIMIT $${params.length}`,
      params
    );
    return result.rows;
  },

  /**
   * Add a drilling parameter record.
   */
  async addParameter(paramData) {
    const {
      well_id, timestamp, depth, wob, rpm, torque, rop,
      mud_weight, mud_flow_rate, standpipe_pressure, annular_pressure,
      hook_load, additional_parameters,
    } = paramData;

    const result = await db.query(
      `INSERT INTO drilling_parameters
       (well_id, timestamp, depth, wob, rpm, torque, rop, mud_weight, mud_flow_rate, standpipe_pressure, annular_pressure, hook_load, additional_parameters)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [well_id, timestamp, depth, wob, rpm, torque, rop, mud_weight, mud_flow_rate, standpipe_pressure, annular_pressure, hook_load, additional_parameters || {}]
    );
    return result.rows[0];
  },

  /**
   * Get latest drilling parameters for a well.
   */
  async getLatestParameters(wellId) {
    const result = await db.query(
      `SELECT * FROM drilling_parameters
       WHERE well_id = $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [wellId]
    );
    return result.rows[0] || null;
  },
};

module.exports = wellRepository;
