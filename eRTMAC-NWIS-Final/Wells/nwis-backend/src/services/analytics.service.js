// =============================================================================
// NWIS Backend — Analytics Service
// =============================================================================

const db = require('../config/database');

const analyticsService = {
  /**
   * Get event analytics (events per formation, per type, etc.).
   */
  async getEventAnalytics({ wellId, fromDate, toDate } = {}) {
    const { where, params } = buildWellDateFilter('de', wellId, fromDate, toDate);

    // Events per type
    const byType = await db.query(
      `SELECT event_type, COUNT(*) AS count, AVG(confidence) AS avg_confidence
       FROM drilling_events de ${where}
       GROUP BY event_type ORDER BY count DESC`,
      params
    );

    // Events per severity
    const bySeverity = await db.query(
      `SELECT severity, COUNT(*) AS count
       FROM drilling_events de ${where}
       GROUP BY severity ORDER BY count DESC`,
      params
    );

    // Events per formation
    const byFormation = await db.query(
      `SELECT f.name AS formation, COUNT(*) AS count
       FROM drilling_events de
       LEFT JOIN formations f ON de.formation_id = f.id
       ${where}
       GROUP BY f.name ORDER BY count DESC`,
      params
    );

    return {
      by_type: byType.rows,
      by_severity: bySeverity.rows,
      by_formation: byFormation.rows,
    };
  },

  /**
   * Get formation-specific analytics (distinct from event analytics).
   */
  async getFormationAnalytics({ wellId } = {}) {
    const wellFilter = wellId ? 'WHERE wf.well_id = $1' : '';
    const params = wellId ? [wellId] : [];

    // Formation traversal summary
    const traversal = await db.query(
      `SELECT f.name AS formation, f.description,
              COUNT(DISTINCT wf.well_id) AS wells_drilled,
              MIN(wf.top_depth) AS min_top, MAX(wf.bottom_depth) AS max_bottom,
              AVG(wf.bottom_depth - wf.top_depth) AS avg_thickness
       FROM well_formations wf
       JOIN formations f ON wf.formation_id = f.id
       ${wellFilter}
       GROUP BY f.name, f.description
       ORDER BY min_top ASC`,
      params
    );

    // Events per formation across all wells
    const eventsPerFormation = await db.query(
      `SELECT f.name AS formation,
              COUNT(*) AS total_events,
              COUNT(*) FILTER (WHERE de.severity = 'critical') AS critical_events,
              COUNT(*) FILTER (WHERE de.severity = 'high') AS high_events,
              json_agg(DISTINCT de.event_type) AS event_types
       FROM drilling_events de
       JOIN formations f ON de.formation_id = f.id
       ${wellFilter ? 'WHERE de.well_id = $1' : ''}
       GROUP BY f.name
       ORDER BY total_events DESC`,
      params
    );

    return {
      formation_traversal: traversal.rows,
      events_per_formation: eventsPerFormation.rows,
    };
  },

  /**
   * Get risk analytics.
   */
  async getRiskAnalytics({ wellId, fromDate, toDate } = {}) {
    const { where, params } = buildWellDateFilter('rp', wellId, fromDate, toDate, 'predicted_at');

    const byType = await db.query(
      `SELECT risk_type, risk_level, COUNT(*) AS count, AVG(score) AS avg_score
       FROM risk_predictions rp ${where}
       GROUP BY risk_type, risk_level ORDER BY avg_score DESC`,
      params
    );

    return { by_type_and_level: byType.rows };
  },

  /**
   * Get alert analytics.
   */
  async getAlertAnalytics({ wellId, fromDate, toDate } = {}) {
    const { where, params } = buildWellDateFilter('a', wellId, fromDate, toDate, 'generated_at');

    const byStatus = await db.query(
      `SELECT status, severity, COUNT(*) AS count
       FROM alerts a ${where}
       GROUP BY status, severity ORDER BY count DESC`,
      params
    );

    // Average acknowledgement time
    const ackTimeWhere = where
      ? `${where} AND a.acknowledged_at IS NOT NULL`
      : 'WHERE a.acknowledged_at IS NOT NULL';

    const ackTime = await db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (a.acknowledged_at - a.generated_at))) AS avg_ack_seconds
       FROM alerts a ${ackTimeWhere}`,
      params
    );

    return {
      by_status_severity: byStatus.rows,
      avg_acknowledgement_seconds: parseFloat(ackTime.rows[0]?.avg_ack_seconds) || null,
    };
  },

  /**
   * Get NPT (Non-Productive Time) analytics.
   */
  async getNPTAnalytics({ wellId, fromDate, toDate } = {}) {
    const conditions = ['de.start_time IS NOT NULL', 'de.end_time IS NOT NULL'];
    const params = [];

    if (wellId) {
      params.push(wellId);
      conditions.push(`de.well_id = $${params.length}`);
    }
    if (fromDate) {
      params.push(fromDate);
      conditions.push(`de.start_time >= $${params.length}`);
    }
    if (toDate) {
      params.push(toDate);
      conditions.push(`de.end_time <= $${params.length}`);
    }

    const result = await db.query(
      `SELECT de.event_type, w.well_name,
              SUM(EXTRACT(EPOCH FROM (de.end_time - de.start_time)) / 3600) AS npt_hours
       FROM drilling_events de
       JOIN wells w ON de.well_id = w.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY de.event_type, w.well_name
       ORDER BY npt_hours DESC`,
      params
    );

    return { npt_by_type_well: result.rows };
  },

  /**
   * Get drilling performance analytics (ROP trends, cost metrics).
   */
  async getDrillingPerformanceAnalytics({ wellId } = {}) {
    const wellFilter = wellId ? 'WHERE dp.well_id = $1' : '';
    const params = wellId ? [wellId] : [];

    // ROP statistics
    const ropStats = await db.query(
      `SELECT
         w.well_name,
         AVG(dp.rop) AS avg_rop,
         MAX(dp.rop) AS max_rop,
         MIN(dp.rop) FILTER (WHERE dp.rop > 0) AS min_rop,
         STDDEV(dp.rop) AS rop_stddev,
         AVG(dp.wob) AS avg_wob,
         AVG(dp.torque) AS avg_torque,
         AVG(dp.rpm) AS avg_rpm,
         COUNT(*) AS data_points
       FROM drilling_parameters dp
       JOIN wells w ON dp.well_id = w.id
       ${wellFilter}
       GROUP BY w.well_name
       ORDER BY avg_rop DESC`,
      params
    );

    // Depth progression (time per 100m)
    const depthProgression = await db.query(
      `SELECT
         w.well_name,
         FLOOR(dp.depth / 100) * 100 AS depth_bin,
         AVG(dp.rop) AS avg_rop_at_depth,
         AVG(dp.torque) AS avg_torque_at_depth,
         COUNT(*) AS readings
       FROM drilling_parameters dp
       JOIN wells w ON dp.well_id = w.id
       ${wellFilter}
       GROUP BY w.well_name, depth_bin
       ORDER BY w.well_name, depth_bin`,
      params
    );

    return {
      rop_statistics: ropStats.rows,
      depth_progression: depthProgression.rows,
    };
  },

  /**
   * Get feedback precision breakdown by risk type.
   */
  async getFeedbackPrecision() {
    const result = await db.query(`
      SELECT
        a.risk_type,
        COUNT(*) FILTER (WHERE a.feedback = 'true_positive') AS true_positives,
        COUNT(*) FILTER (WHERE a.feedback = 'false_positive') AS false_positives,
        COUNT(*) FILTER (WHERE a.feedback IS NOT NULL) AS total_labeled,
        COUNT(*) AS total_alerts,
        ROUND(
          COUNT(*) FILTER (WHERE a.feedback = 'true_positive')::numeric /
          NULLIF(COUNT(*) FILTER (WHERE a.feedback IS NOT NULL), 0), 3
        ) AS precision
      FROM alerts a
      WHERE a.risk_type IS NOT NULL
      GROUP BY a.risk_type
      ORDER BY total_alerts DESC
    `);
    return result.rows;
  },
};

// ── Helper: Build WHERE clause with well_id + date range filters ────────────
function buildWellDateFilter(alias, wellId, fromDate, toDate, dateColumn = 'created_at') {
  const conditions = [];
  const params = [];

  if (wellId) {
    params.push(wellId);
    conditions.push(`${alias}.well_id = $${params.length}`);
  }
  if (fromDate) {
    params.push(fromDate);
    conditions.push(`${alias}.${dateColumn} >= $${params.length}`);
  }
  if (toDate) {
    params.push(toDate);
    conditions.push(`${alias}.${dateColumn} <= $${params.length}`);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return { where, params };
}

module.exports = analyticsService;
