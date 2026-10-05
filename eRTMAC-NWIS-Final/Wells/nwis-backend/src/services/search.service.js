// =============================================================================
// NWIS Backend — Search Service
// =============================================================================
// Hybrid search: keyword + metadata filters + (optional) vector search via AI.
// =============================================================================

const db = require('../config/database');
const documentRepository = require('../repositories/document.repository');
const eventRepository = require('../repositories/event.repository');
const wellRepository = require('../repositories/well.repository');
const aiClient = require('../config/ai');
const logger = require('../utils/logger');

const searchService = {
  /**
   * Hybrid search across events, documents, and wells.
   */
  async search({ query, wellId, type = 'all', formation, eventType, severity, fromDepth, toDepth, useAI = false, limit = 20 }) {
    const results = [];

    // 1. Search drilling events
    if (type === 'all' || type === 'events') {
      const eventResults = await this._searchEvents(query, { wellId, fromDepth, toDepth, eventType, severity, formation });
      results.push(...eventResults);
    }

    // 2. Search document chunks (keyword)
    if (type === 'all' || type === 'documents') {
      const chunkResults = await documentRepository.searchChunks(query, { wellId, limit });
      for (const chunk of chunkResults) {
        results.push({
          type: 'document_chunk',
          wellId: chunk.well_id,
          wellName: chunk.well_name,
          documentId: chunk.document_id,
          filename: chunk.original_filename,
          page: chunk.page,
          section: chunk.section,
          text: chunk.text.substring(0, 300),
          relevance: 0.7,
        });
      }
    }

    // 3. Search wells
    if (type === 'all' || type === 'wells') {
      const wellResults = await this._searchWells(query);
      results.push(...wellResults);
    }

    // 4. Search formations
    if (type === 'all' || type === 'formations') {
      const formationResults = await this._searchFormations(query);
      results.push(...formationResults);
    }

    // 5. Try vector search via AI service (non-blocking, only if requested)
    if (useAI) {
      try {
        const vectorResult = await aiClient.vectorSearch(query, { wellId, limit });
        if (vectorResult.success && vectorResult.data?.results) {
          for (const vr of vectorResult.data.results) {
            results.push({
              type: 'vector_match',
              wellId: vr.well_id,
              documentId: vr.document_id,
              text: vr.text,
              relevance: vr.score || 0.9,
              page: vr.page,
            });
          }
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Vector search unavailable, using keyword search only');
      }
    }

    // Sort by relevance
    results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    return results.slice(0, limit);
  },

  /**
   * Autocomplete suggestions for search input.
   */
  async autocomplete(query, { limit = 8 } = {}) {
    const suggestions = [];
    const q = `${query}%`;
    const iq = `%${query}%`;

    // Well name suggestions
    const wells = await db.query(
      `SELECT DISTINCT well_name, field FROM wells WHERE well_name ILIKE $1 LIMIT $2`,
      [q, Math.ceil(limit / 3)]
    );
    for (const w of wells.rows) {
      suggestions.push({ type: 'well', value: w.well_name, label: `${w.well_name} (${w.field})` });
    }

    // Formation name suggestions
    const formations = await db.query(
      `SELECT DISTINCT name FROM formations WHERE name ILIKE $1 LIMIT $2`,
      [iq, Math.ceil(limit / 3)]
    );
    for (const f of formations.rows) {
      suggestions.push({ type: 'formation', value: f.name, label: f.name });
    }

    // Event type suggestions
    const eventTypes = [
      'mud_loss', 'kick', 'stuck_pipe', 'fishing', 'npt', 'wellbore_instability',
      'gas_cut', 'tight_hole', 'lost_circulation', 'well_control',
      'equipment_failure', 'casing_issue', 'cementing_issue',
    ];
    const matchingTypes = eventTypes.filter((t) => t.includes(query.toLowerCase()));
    for (const t of matchingTypes.slice(0, Math.ceil(limit / 3))) {
      suggestions.push({ type: 'event_type', value: t, label: t.replace(/_/g, ' ') });
    }

    return suggestions.slice(0, limit);
  },

  /**
   * Vector/semantic search via AI service.
   */
  async vectorSearch(query, { wellId, limit = 10 } = {}) {
    const result = await aiClient.vectorSearch(query, { wellId, limit });

    if (result.success && result.data?.results) {
      return result.data.results.map((vr) => ({
        type: 'vector_match',
        wellId: vr.well_id,
        documentId: vr.document_id,
        text: vr.text,
        relevance: vr.score || 0.9,
        page: vr.page,
        section: vr.section,
      }));
    }

    // Fallback to keyword search
    logger.info('Vector search unavailable — falling back to keyword search');
    const chunks = await documentRepository.searchChunks(query, { wellId, limit });
    return chunks.map((c) => ({
      type: 'keyword_fallback',
      wellId: c.well_id,
      wellName: c.well_name,
      documentId: c.document_id,
      text: c.text?.substring(0, 300),
      relevance: 0.6,
      page: c.page,
      section: c.section,
    }));
  },

  /**
   * Search drilling events by text.
   */
  async _searchEvents(query, { wellId, fromDepth, toDepth, eventType, severity, formation }) {
    const params = [`%${query}%`];
    const conditions = ['(de.description ILIKE $1 OR de.event_type ILIKE $1)'];

    if (wellId) {
      params.push(wellId);
      conditions.push(`de.well_id = $${params.length}`);
    }
    if (fromDepth !== undefined) {
      params.push(fromDepth);
      conditions.push(`de.depth >= $${params.length}`);
    }
    if (toDepth !== undefined) {
      params.push(toDepth);
      conditions.push(`de.depth <= $${params.length}`);
    }
    if (eventType) {
      params.push(eventType);
      conditions.push(`de.event_type = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      conditions.push(`de.severity = $${params.length}`);
    }
    if (formation) {
      params.push(`%${formation}%`);
      conditions.push(`f.name ILIKE $${params.length}`);
    }

    const result = await db.query(
      `SELECT de.*, w.well_name, f.name AS formation_name
       FROM drilling_events de
       JOIN wells w ON de.well_id = w.id
       LEFT JOIN formations f ON de.formation_id = f.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY de.depth ASC
       LIMIT 20`,
      params
    );

    return result.rows.map((row) => ({
      type: 'event',
      wellId: row.well_id,
      wellName: row.well_name,
      eventId: row.id,
      eventType: row.event_type,
      severity: row.severity,
      depth: parseFloat(row.depth),
      formation: row.formation_name,
      description: row.description?.substring(0, 300),
      relevance: 0.8,
    }));
  },

  /**
   * Search wells by name or field.
   */
  async _searchWells(query) {
    const result = await db.query(
      `SELECT w.*, f.name AS current_formation_name
       FROM wells w
       LEFT JOIN formations f ON w.current_formation_id = f.id
       WHERE w.well_name ILIKE $1 OR w.field ILIKE $1
       LIMIT 10`,
      [`%${query}%`]
    );

    return result.rows.map((row) => ({
      type: 'well',
      wellId: row.id,
      wellName: row.well_name,
      field: row.field,
      status: row.status,
      currentDepth: parseFloat(row.current_depth) || 0,
      currentFormation: row.current_formation_name,
      relevance: row.well_name.toLowerCase().includes(query.toLowerCase()) ? 0.95 : 0.75,
    }));
  },

  /**
   * Search formations by name.
   */
  async _searchFormations(query) {
    const result = await db.query(
      `SELECT * FROM formations WHERE name ILIKE $1 OR description ILIKE $1 LIMIT 10`,
      [`%${query}%`]
    );

    return result.rows.map((row) => ({
      type: 'formation',
      formationId: row.id,
      name: row.name,
      description: row.description?.substring(0, 200),
      attributes: row.geological_attributes,
      relevance: 0.75,
    }));
  },

  /**
   * Authoritative Vector Search: delegates to Python pgvector semantic search.
   */
  async vectorSearch(query, { wellId, limit = 8, depthFrom, depthTo, eventType } = {}) {
    try {
      const aiResult = await aiClient.vectorSearch(query, { wellId, limit, depthFrom, depthTo, eventType });
      if (aiResult?.success && aiResult?.data) {
        const chunks = (aiResult.data.chunks || []).map((c) => ({
          type: 'document_chunk',
          id: c.id,
          wellId: c.well_id,
          wellName: c.well_name,
          documentId: c.document_id,
          page: c.page,
          text: c.text,
          relevance: c.sim || c.similarity || 0.85,
        }));

        const events = (aiResult.data.events || []).map((e) => ({
          type: 'event',
          id: e.id,
          wellId: e.well_id,
          wellName: e.well_name,
          depth: e.depth,
          eventType: e.event_type,
          severity: e.severity,
          formation: e.formation,
          mitigation: e.mitigation,
          description: e.description,
          relevance: 0.9,
        }));

        return [...chunks, ...events];
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Python vector search failed, falling back to database keyword chunks');
    }

    // Keyword fallback
    const chunks = await documentRepository.searchChunks(query, { wellId, limit });
    return chunks.map((c) => ({
      type: 'document_chunk',
      wellId: c.well_id,
      wellName: c.well_name,
      documentId: c.document_id,
      filename: c.original_filename,
      page: c.page,
      section: c.section,
      text: c.text?.substring(0, 300),
      relevance: 0.7,
    }));
  },
};

module.exports = searchService;
