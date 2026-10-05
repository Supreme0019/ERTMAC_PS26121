// =============================================================================
// NWIS Backend — Formation Service
// =============================================================================

const db = require('../config/database');
const logger = require('../utils/logger');

const formationService = {
  /**
   * Create a formation.
   */
  async createFormation({ name, description, geological_attributes }) {
    const result = await db.query(
      `INSERT INTO formations (name, description, geological_attributes)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, description, geological_attributes || {}]
    );
    return result.rows[0];
  },

  /**
   * Get all formations.
   */
  async listFormations() {
    const result = await db.query('SELECT * FROM formations ORDER BY name ASC');
    return result.rows;
  },

  /**
   * Get formation by ID.
   */
  async getFormation(id) {
    const result = await db.query('SELECT * FROM formations WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Get wells that pass through a specific formation.
   */
  async getWellsByFormation(formationId) {
    const result = await db.query(
      `SELECT w.id, w.well_name, w.field, w.status, w.latitude, w.longitude,
              wf.top_depth, wf.bottom_depth
       FROM well_formations wf
       JOIN wells w ON wf.well_id = w.id
       WHERE wf.formation_id = $1
       ORDER BY w.well_name`,
      [formationId]
    );
    return result.rows;
  },

  /**
   * Update a formation.
   */
  async updateFormation(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const values = Object.values(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const result = await db.query(
      `UPDATE formations SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  },
};

module.exports = formationService;
