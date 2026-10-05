// =============================================================================
// NWIS Backend — Risk Repository
// =============================================================================

const db = require('../config/database');

const riskRepository = {
  /**
   * Create a risk prediction.
   */
  async create(riskData) {
    const {
      well_id, depth, risk_type, score, risk_level,
      depth_range, evidence_refs, model_version, explanation,
    } = riskData;

    const result = await db.query(
      `INSERT INTO risk_predictions (well_id, depth, risk_type, score, risk_level, depth_range, evidence_refs, model_version, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [well_id, depth, risk_type, score, risk_level,
       JSON.stringify(depth_range), JSON.stringify(evidence_refs || []),
       model_version, explanation]
    );
    return result.rows[0];
  },

  /**
   * Upsert a risk prediction by (well_id, risk_type, depth_bucket).
   */
  async upsert(riskData) {
    const {
      well_id, depth, depth_bucket, risk_type, score, risk_level,
      depth_range, evidence_refs, model_version, explanation,
    } = riskData;

    const bucket = depth_bucket !== undefined ? depth_bucket : (depth !== null ? Math.floor(parseFloat(depth) / 25) : 0);

    const result = await db.query(
      `INSERT INTO risk_predictions (well_id, depth, depth_bucket, risk_type, score, risk_level, depth_range, evidence_refs, model_version, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (well_id, risk_type, depth_bucket)
       DO UPDATE SET
         depth = EXCLUDED.depth,
         score = EXCLUDED.score,
         risk_level = EXCLUDED.risk_level,
         depth_range = EXCLUDED.depth_range,
         evidence_refs = EXCLUDED.evidence_refs,
         model_version = EXCLUDED.model_version,
         explanation = EXCLUDED.explanation,
         created_at = NOW()
       RETURNING *`,
      [well_id, depth, bucket, risk_type, score, risk_level,
       JSON.stringify(depth_range), JSON.stringify(evidence_refs || []),
       model_version, explanation]
    );
    return result.rows[0];
  },

  /**
   * Find risk predictions for a well.
   */
  async findByWell(wellId, filters = {}) {
    const params = [wellId];
    const conditions = ['well_id = $1'];

    if (filters.risk_type) {
      params.push(filters.risk_type);
      conditions.push(`risk_type = $${params.length}`);
    }
    if (filters.risk_level) {
      params.push(filters.risk_level);
      conditions.push(`risk_level = $${params.length}`);
    }
    if (filters.from_depth !== undefined) {
      params.push(filters.from_depth);
      conditions.push(`depth >= $${params.length}`);
    }
    if (filters.to_depth !== undefined) {
      params.push(filters.to_depth);
      conditions.push(`depth <= $${params.length}`);
    }

    params.push(filters.limit || 20);
    const limitIdx = params.length;
    params.push(filters.offset || 0);
    const offsetIdx = params.length;

    const result = await db.query(
      `SELECT * FROM risk_predictions
       WHERE ${conditions.join(' AND ')}
       ORDER BY score DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*) FROM risk_predictions WHERE ${conditions.join(' AND ')}`,
      countParams
    );

    return {
      predictions: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  },

  /**
   * Find active high-risk predictions for a well at a given depth.
   */
  async findActiveRisks(wellId, currentDepth) {
    const result = await db.query(
      `SELECT DISTINCT ON (risk_type) * FROM risk_predictions
       WHERE well_id = $1
         AND (depth_range->0)::numeric <= $2 + 100
         AND (depth_range->1)::numeric >= $2 - 100
       ORDER BY risk_type, score DESC`,
      [wellId, currentDepth]
    );
    return result.rows;
  },

  /**
   * Find by ID.
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM risk_predictions WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
};

module.exports = riskRepository;
