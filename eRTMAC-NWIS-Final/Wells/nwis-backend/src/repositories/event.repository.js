// =============================================================================
// NWIS Backend — Event Repository
// =============================================================================

const db = require('../config/database');

const eventRepository = {
  /**
   * Create a drilling event.
   */
  async create(eventData) {
    const {
      well_id, formation_id, depth, event_type, severity,
      description, start_time, end_time, source_document_id,
      confidence, metadata,
    } = eventData;

    const result = await db.query(
      `INSERT INTO drilling_events
       (well_id, formation_id, depth, event_type, severity, description, start_time, end_time, source_document_id, confidence, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [well_id, formation_id, depth, event_type, severity, description, start_time, end_time, source_document_id, confidence, metadata || {}]
    );
    return result.rows[0];
  },

  /**
   * Find event by ID.
   */
  async findById(id) {
    const result = await db.query(
      `SELECT de.*, f.name AS formation_name
       FROM drilling_events de
       LEFT JOIN formations f ON de.formation_id = f.id
       WHERE de.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * List events for a well with filters.
   */
  async findByWell(wellId, filters = {}) {
    const params = [wellId];
    const conditions = ['de.well_id = $1'];

    if (filters.from_depth !== undefined) {
      params.push(filters.from_depth);
      conditions.push(`de.depth >= $${params.length}`);
    }
    if (filters.to_depth !== undefined) {
      params.push(filters.to_depth);
      conditions.push(`de.depth <= $${params.length}`);
    }
    if (filters.event_type) {
      params.push(filters.event_type);
      conditions.push(`de.event_type = $${params.length}`);
    }
    if (filters.severity) {
      params.push(filters.severity);
      conditions.push(`de.severity = $${params.length}`);
    }
    if (filters.formation) {
      params.push(`%${filters.formation}%`);
      conditions.push(`f.name ILIKE $${params.length}`);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    params.push(filters.limit || 20);
    const limitIdx = params.length;
    params.push(filters.offset || 0);
    const offsetIdx = params.length;

    const result = await db.query(
      `SELECT de.*, f.name AS formation_name
       FROM drilling_events de
       LEFT JOIN formations f ON de.formation_id = f.id
       ${whereClause}
       ORDER BY de.depth ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    // Count
    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*) FROM drilling_events de
       LEFT JOIN formations f ON de.formation_id = f.id
       ${whereClause}`,
      countParams
    );

    return {
      events: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  },

  /**
   * Fetch events for many wells in a single query.
   * Uses a window function to cap rows per well so a high-event well doesn't
   * dominate the result set (equivalent to calling findByWell with limit per well).
   *
   * @param {string[]} wellIds  - array of UUID strings
   * @param {number}   [limit=100] - max events returned per well
   * @returns {Promise<Map<string, Array>>} Map of wellId → event rows[]
   */
  async findByWellsBulk(wellIds, limit = 100) {
    if (!wellIds || wellIds.length === 0) return new Map();

    const result = await db.query(
      `SELECT *
         FROM (
           SELECT de.*,
                  f.name AS formation_name,
                  ROW_NUMBER() OVER (
                    PARTITION BY de.well_id
                    ORDER BY de.depth ASC
                  ) AS rn
             FROM drilling_events de
             LEFT JOIN formations f ON de.formation_id = f.id
            WHERE de.well_id = ANY($1::uuid[])
         ) sub
        WHERE rn <= $2
        ORDER BY well_id, depth ASC`,
      [wellIds, limit]
    );

    const map = new Map();
    for (const row of result.rows) {
      if (!map.has(row.well_id)) map.set(row.well_id, []);
      map.get(row.well_id).push(row);
    }
    return map;
  },

  /**
   * Find events by type across multiple wells.
   */
  async findByTypeAcrossWells(wellIds, eventType, { fromDepth, toDepth } = {}) {
    const params = [wellIds, eventType];
    let depthFilter = '';

    if (fromDepth !== undefined) {
      params.push(fromDepth);
      depthFilter += ` AND depth >= $${params.length}`;
    }
    if (toDepth !== undefined) {
      params.push(toDepth);
      depthFilter += ` AND depth <= $${params.length}`;
    }

    const result = await db.query(
      `SELECT de.*, w.well_name, f.name AS formation_name
       FROM drilling_events de
       JOIN wells w ON de.well_id = w.id
       LEFT JOIN formations f ON de.formation_id = f.id
       WHERE de.well_id = ANY($1) AND de.event_type = $2 ${depthFilter}
       ORDER BY de.depth ASC`,
      params
    );
    return result.rows;
  },

  /**
   * Update an event.
   */
  async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const values = Object.values(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const result = await db.query(
      `UPDATE drilling_events SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete an event.
   */
  async delete(id) {
    const result = await db.query('DELETE FROM drilling_events WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  },

  // ── Mitigations ─────────────────────────────────────────────────────────

  /**
   * Get mitigations for an event.
   */
  async getMitigations(eventId) {
    const result = await db.query(
      `SELECT * FROM mitigations WHERE event_id = $1 ORDER BY created_at ASC`,
      [eventId]
    );
    return result.rows;
  },

  /**
   * Add a mitigation record.
   */
  async addMitigation(mitigationData) {
    const { event_id, action, outcome, notes, source_document_id } = mitigationData;
    const result = await db.query(
      `INSERT INTO mitigations (event_id, action, outcome, notes, source_document_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [event_id, action, outcome, notes, source_document_id]
    );
    return result.rows[0];
  },

  /**
   * Get event count summary for a well.
   */
  async getEventSummary(wellId) {
    const result = await db.query(
      `SELECT event_type, severity, COUNT(*) AS count
       FROM drilling_events
       WHERE well_id = $1
       GROUP BY event_type, severity
       ORDER BY count DESC`,
      [wellId]
    );
    return result.rows;
  },
};

module.exports = eventRepository;
