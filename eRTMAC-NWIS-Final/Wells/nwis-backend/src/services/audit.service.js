// =============================================================================
// NWIS Backend — Audit Service
// =============================================================================

const db = require('../config/database');
const logger = require('../utils/logger');

const auditService = {
  /**
   * Log an audit event.
   */
  async log({ userId, action, resourceType, resourceId, oldData, newData, req }) {
    try {
      const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
      const userAgent = req?.headers?.['user-agent'] || null;

      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_data, new_data, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId, action, resourceType, resourceId,
          oldData ? JSON.stringify(oldData) : null,
          newData ? JSON.stringify(newData) : null,
          ipAddress, userAgent,
        ]
      );
    } catch (err) {
      // Audit logging should never break the main flow
      logger.error({ err, action, resourceType, resourceId }, 'Audit log failed');
    }
  },

  /**
   * Get audit logs with filters.
   */
  async getLogs({ userId, action, resourceType, resourceId, from, to, limit = 50, offset = 0 }) {
    const params = [];
    const conditions = [];

    if (userId) {
      params.push(userId);
      conditions.push(`al.user_id = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`al.action = $${params.length}`);
    }
    if (resourceType) {
      params.push(resourceType);
      conditions.push(`al.resource_type = $${params.length}`);
    }
    if (resourceId) {
      params.push(resourceId);
      conditions.push(`al.resource_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`al.timestamp >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`al.timestamp <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const result = await db.query(
      `SELECT al.*, u.name AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.timestamp DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
      countParams
    );

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  },
};

module.exports = auditService;
