// =============================================================================
// NWIS Backend — Evidence Utility
// =============================================================================
// Helpers for building and validating standardized evidence references
// format: { well_id, event_id, document_id, page }
// =============================================================================

/**
 * Build a structured evidence reference object.
 * @param {string} wellId
 * @param {string} eventId
 * @param {string} [documentId=null]
 * @param {number} [page=1]
 * @returns {{ well_id: string, event_id: string, document_id: string|null, page: number }}
 */
const buildRef = (wellId, eventId, documentId = null, page = 1) => ({
  well_id: wellId,
  event_id: eventId,
  document_id: documentId,
  page: page || 1,
});

/**
 * Parse an evidence reference (supporting both structured objects and legacy strings).
 * @param {object|string} ref
 * @returns {{ wellId: string, eventId: string, documentId: string|null, page: number } | null}
 */
const parseRef = (ref) => {
  if (!ref) return null;
  if (typeof ref === 'object') {
    return {
      wellId: ref.well_id || ref.wellId || null,
      eventId: ref.event_id || ref.eventId || null,
      documentId: ref.document_id || ref.documentId || null,
      page: ref.page || 1,
    };
  }
  if (typeof ref === 'string') {
    const parts = ref.split(':');
    return {
      wellId: parts[0] || null,
      eventId: parts[1] || null,
      documentId: null,
      page: 1,
    };
  }
  return null;
};

/**
 * Validate that all evidence refs point to existing resources.
 * @param {Array<object|string>} refs
 * @param {import('pg').PoolClient|object} db - Database query interface
 * @returns {Promise<{ valid: boolean, missing: Array<object|string> }>}
 */
const validateRefs = async (refs, db) => {
  const missing = [];

  for (const ref of refs) {
    const parsed = parseRef(ref);
    if (!parsed || (!parsed.wellId && !parsed.eventId && !parsed.documentId)) {
      missing.push(ref);
      continue;
    }

    if (parsed.wellId) {
      const wellResult = await db.query('SELECT id FROM wells WHERE id = $1', [parsed.wellId]);
      if (wellResult.rows.length === 0) {
        missing.push(ref);
        continue;
      }
    }

    if (parsed.eventId) {
      const eventResult = await db.query('SELECT id FROM drilling_events WHERE id = $1', [parsed.eventId]);
      if (eventResult.rows.length === 0) {
        missing.push(ref);
        continue;
      }
    }

    if (parsed.documentId) {
      const docResult = await db.query('SELECT id FROM documents WHERE id = $1', [parsed.documentId]);
      if (docResult.rows.length === 0) {
        missing.push(ref);
      }
    }
  }

  return { valid: missing.length === 0, missing };
};

module.exports = {
  buildRef,
  parseRef,
  validateRefs,
};
