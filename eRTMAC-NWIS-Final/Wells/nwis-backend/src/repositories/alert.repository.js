// =============================================================================
// NWIS Backend — Alert Repository
// =============================================================================

const db = require('../config/database');

const alertRepository = {
  /**
   * Create an alert.
   */
  async create(alertData) {
    const {
      well_id, risk_prediction_id, risk_type, severity,
      message, evidence_refs, dedupe_key, score, occurrence_count = 1,
      first_seen_depth, last_seen_depth, parameter_snapshot = {}, thresholds = {},
    } = alertData;

    const result = await db.query(
      `INSERT INTO alerts (
        well_id, risk_prediction_id, risk_type, severity, message, evidence_refs,
        dedupe_key, score, occurrence_count, first_seen_depth, last_seen_depth,
        last_seen_at, parameter_snapshot, thresholds
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)
      RETURNING *`,
      [
        well_id, risk_prediction_id, risk_type, severity, message,
        JSON.stringify(evidence_refs || []),
        dedupe_key || null,
        score !== undefined ? score : null,
        occurrence_count,
        first_seen_depth !== undefined ? first_seen_depth : null,
        last_seen_depth !== undefined ? last_seen_depth : null,
        JSON.stringify(parameter_snapshot || {}),
        JSON.stringify(thresholds || {}),
      ]
    );
    return result.rows[0];
  },

  /**
   * Find open alert by dedupe key (status NOT 'resolved').
   */
  async findOpenByDedupeKey(dedupeKey) {
    const result = await db.query(
      `SELECT a.*, w.well_name
       FROM alerts a
       JOIN wells w ON a.well_id = w.id
       WHERE a.dedupe_key = $1 AND a.status NOT IN ('resolved')
       ORDER BY a.generated_at DESC
       LIMIT 1`,
      [dedupeKey]
    );
    return result.rows[0] || null;
  },

  /**
   * Update existing open alert on re-detection.
   */
  async updateExistingAlert(id, { occurrence_count, last_seen_depth, score, severity, risk_prediction_id, evidence_refs, parameter_snapshot, message } = {}) {
    const result = await db.query(
      `UPDATE alerts
       SET occurrence_count = COALESCE($2, occurrence_count + 1),
           last_seen_at = NOW(),
           last_seen_depth = COALESCE($3, last_seen_depth),
           score = GREATEST(score, $4),
           severity = COALESCE($5, severity),
           risk_prediction_id = COALESCE($6, risk_prediction_id),
           evidence_refs = CASE WHEN $7::jsonb IS NOT NULL THEN $7::jsonb ELSE evidence_refs END,
           parameter_snapshot = CASE WHEN $8::jsonb IS NOT NULL THEN $8::jsonb ELSE parameter_snapshot END,
           message = COALESCE($9, message)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        occurrence_count || null,
        last_seen_depth !== undefined ? last_seen_depth : null,
        score !== undefined ? score : null,
        severity || null,
        risk_prediction_id || null,
        evidence_refs ? JSON.stringify(evidence_refs) : null,
        parameter_snapshot ? JSON.stringify(parameter_snapshot) : null,
        message || null,
      ]
    );
    return result.rows[0] || null;
  },

  /**
   * Auto-resolve alert (when score drops below clearing threshold).
   */
  async autoResolveAlert(id, { last_seen_depth, score, reason } = {}) {
    const result = await db.query(
      `UPDATE alerts
       SET status = 'resolved',
           resolved_at = NOW(),
           last_seen_at = NOW(),
           last_seen_depth = COALESCE($2, last_seen_depth),
           score = COALESCE($3, score),
           message = CASE WHEN $4::text IS NOT NULL THEN message || ' (' || $4::text || ')' ELSE message END
       WHERE id = $1
       RETURNING *`,
      [id, last_seen_depth !== undefined ? last_seen_depth : null, score !== undefined ? score : null, reason || null]
    );
    return result.rows[0] || null;
  },

  /**
   * Update feedback on alert.
   */
  async updateFeedback(id, feedback, userId) {
    const result = await db.query(
      `UPDATE alerts
       SET feedback = $2,
           feedback_by = $3,
           feedback_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, feedback, userId || null]
    );
    return result.rows[0] || null;
  },

  /**
   * Find alerts for a well.
   */
  async findByWell(wellId, filters = {}) {
    const params = [wellId];
    const conditions = ['a.well_id = $1'];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`a.status = $${params.length}`);
    }
    if (filters.severity) {
      params.push(filters.severity);
      conditions.push(`a.severity = $${params.length}`);
    }

    params.push(filters.limit || 20);
    const limitIdx = params.length;
    params.push(filters.offset || 0);
    const offsetIdx = params.length;

    const result = await db.query(
      `SELECT a.*, w.well_name, u.name AS acknowledger_name
       FROM alerts a
       JOIN wells w ON a.well_id = w.id
       LEFT JOIN users u ON a.acknowledged_by = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.generated_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*) FROM alerts a WHERE ${conditions.join(' AND ')}`,
      countParams
    );

    return {
      alerts: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  },

  /**
   * Find alert by ID.
   */
  async findById(id) {
    const result = await db.query(
      `SELECT a.*, w.well_name
       FROM alerts a
       JOIN wells w ON a.well_id = w.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Acknowledge an alert.
   */
  async acknowledge(id, userId) {
    const result = await db.query(
      `UPDATE alerts
       SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Resolve an alert.
   */
  async resolve(id) {
    const result = await db.query(
      `UPDATE alerts SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update alert status.
   */
  async updateStatus(id, status) {
    const result = await db.query(
      `UPDATE alerts SET status = $2 WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return result.rows[0] || null;
  },

  /**
   * Get unresolved alert count for a well.
   */
  async getUnresolvedCount(wellId) {
    const result = await db.query(
      `SELECT COUNT(*) FROM alerts WHERE well_id = $1 AND status NOT IN ('resolved')`,
      [wellId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = alertRepository;
