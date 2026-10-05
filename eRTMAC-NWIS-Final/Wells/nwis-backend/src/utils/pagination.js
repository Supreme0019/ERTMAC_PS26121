// =============================================================================
// NWIS Backend — Pagination Helper
// =============================================================================

/**
 * Parse pagination parameters from query string.
 * @param {object} query - Express req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Build pagination metadata from total count.
 * @param {number} total - Total number of records
 * @param {number} page - Current page
 * @param {number} limit - Records per page
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
const buildPaginationMeta = (total, page, limit) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

module.exports = { parsePagination, buildPaginationMeta };
