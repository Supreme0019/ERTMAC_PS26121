// =============================================================================
// NWIS Backend — RAG Service (Retrieval-Augmented Generation)
// =============================================================================
// Builds a structured context from well data, events, formations, documents,
// and nearby wells, then delegates to the AI service for synthesis.
// Supports multi-turn conversation via session history.
// =============================================================================

const wellRepository = require('../repositories/well.repository');
const eventRepository = require('../repositories/event.repository');
const documentRepository = require('../repositories/document.repository');
const nearbyWellService = require('./nearbyWell.service');
const parameterService = require('./parameter.service');
const aiClient = require('../config/ai');
const logger = require('../utils/logger');

// ── In-memory session store (MVP; replace with Redis for production) ────────
// Map<sessionId, { wellId, history: [{ role, content, timestamp }], createdAt }>
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getOrCreateSession(sessionId, wellId) {
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    // Extend TTL on access
    session.lastAccessedAt = Date.now();
    return session;
  }
  const session = {
    wellId,
    history: [],
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

function addToHistory(sessionId, role, content) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.history.push({ role, content, timestamp: new Date().toISOString() });
  // Keep only last 20 turns to avoid context overflow
  if (session.history.length > 20) {
    session.history = session.history.slice(-20);
  }
}

// Periodic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccessedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000).unref(); // Clean up every 5 minutes

// ── RAG Service ─────────────────────────────────────────────────────────────

const ragService = {
  /**
   * Process a RAG query with full contextual enrichment.
   * @param {object} params
   * @param {string} params.question - The user's question
   * @param {string} [params.wellId] - Target well UUID
   * @param {string} [params.wellName] - Target well name (alternative to UUID)
   * @param {string} [params.sessionId] - Conversation session ID
   * @param {object} [params.context] - Additional context overrides
   */
  async query({ question, wellId, wellName, sessionId, context = {} }) {
    logger.info({ question: question.substring(0, 80), wellId, sessionId }, 'RAG query started');

    // ── Hallucination guard: extract well-like tokens from the question ──
    const wellTokenRegex = /\b([A-Z]{2,5}-[A-Z]?-?\d{2,4})\b/gi;
    const mentionedWells = [...new Set((question.match(wellTokenRegex) || []).map(w => w.toUpperCase()))];
    if (mentionedWells.length > 0) {
      // Check all mentioned wells against the backend well list
      const unknownWells = [];
      for (const token of mentionedWells) {
        const found = await wellRepository.findByName(token);
        if (!found) unknownWells.push(token);
      }
      if (unknownWells.length > 0) {
        logger.info({ unknownWells }, 'RAG hallucination guard: unknown well(s) in question');
        return {
          answer: `Insufficient evidence: the well(s) ${unknownWells.join(', ')} were not found in the database. Please verify the well names and try again.`,
          sources: [],
          well: null,
          session_id: sessionId || null,
          follow_up_questions: ['What wells are currently in the database?'],
          context_summary: { well_found: false, events_count: 0, nearby_wells_count: 0, document_chunks_count: 0, formations_count: 0 },
          engine: 'hallucination-guard',
        };
      }
    }

    // Resolve well
    let well = null;
    if (wellId) {
      well = await wellRepository.findById(wellId);
    } else if (wellName) {
      well = await wellRepository.findByName(wellName);
    } else if (mentionedWells.length === 1) {
      well = await wellRepository.findByName(mentionedWells[0]);
    }

    // Build structured context
    const structuredContext = await this._buildContext(well, context);

    // Get session history for multi-turn
    let conversationHistory = [];
    if (sessionId) {
      const session = getOrCreateSession(sessionId, wellId);
      conversationHistory = session.history.map((h) => ({
        role: h.role,
        content: h.content,
      }));
      addToHistory(sessionId, 'user', question);
    }

    // Attempt AI service RAG
    const aiResult = await aiClient.ragQuery(question, {
      ...structuredContext,
      conversation_history: conversationHistory,
    });

    let answer;
    let sources = [];
    let engine = 'python-authoritative';

    if (aiResult.success && aiResult.data) {
      // Check for grounded:false — AI could not ground its answer
      if (aiResult.data.grounded === false) {
        answer = 'Insufficient evidence: the AI could not find enough supporting data to provide a reliable answer for this query.';
        sources = [];
        engine = 'grounding-guard';
      } else {
        answer = aiResult.data.answer || aiResult.data.response || 'AI processed the query but returned no answer.';
        sources = aiResult.data.sources || [];

        // Enrich document-chunk sources with backend document filenames
        for (const src of sources) {
          if (src.type === 'document_chunk' || src.document_id) {
            try {
              const wellNameForLookup = src.well_name || src.well_id;
              if (wellNameForLookup) {
                const docs = await documentRepository.findAll({ well_name: wellNameForLookup });
                if (docs && docs.length > 0) {
                  const match = docs.find(d => d.original_filename) || docs[0];
                  src.original_filename = match.original_filename;
                  src.file_uri = match.file_uri;
                }
              }
            } catch (docErr) {
              logger.debug('Failed to enrich RAG source with document filename:', docErr.message);
            }
          }
        }
      }
    } else {
      // Fallback: generate a structured answer from the context
      answer = this._generateFallbackAnswer(question, structuredContext, well);
      sources = structuredContext.nearby_wells?.map((w) => ({
        type: 'well',
        name: w.well_name,
        relevance: 'nearby',
      })) || [];
      engine = 'node-fallback';
    }

    // Store assistant response in session
    if (sessionId) {
      addToHistory(sessionId, 'assistant', answer);
    }

    // Build follow-up suggestions based on context, not hardcoded
    const followUps = this._generateFollowUps(question, structuredContext, well);

    return {
      answer,
      sources,
      well: well ? { id: well.id, name: well.well_name, field: well.field } : null,
      session_id: sessionId || null,
      follow_up_questions: followUps,
      context_summary: {
        well_found: !!well,
        events_count: structuredContext.events?.length || 0,
        nearby_wells_count: structuredContext.nearby_wells?.length || 0,
        document_chunks_count: structuredContext.document_chunks?.length || 0,
        formations_count: structuredContext.formations?.length || 0,
      },
      engine,
    };
  },

  /**
   * Get session history.
   */
  getHistory(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    return {
      session_id: sessionId,
      well_id: session.wellId,
      history: session.history,
      created_at: new Date(session.createdAt).toISOString(),
      message_count: session.history.length,
    };
  },

  /**
   * Clear session history.
   */
  clearHistory(sessionId) {
    return sessions.delete(sessionId);
  },

  /**
   * Build the full structured context for the RAG query.
   */
  async _buildContext(well, overrides = {}) {
    const ctx = {};

    if (!well) return ctx;

    const currentDepth = overrides.depth || parseFloat(well.current_depth) || 0;

    // Well metadata
    ctx.well = {
      id: well.id,
      name: well.well_name,
      field: well.field,
      status: well.status,
      current_depth: currentDepth,
      total_depth: parseFloat(well.total_depth) || null,
      current_formation: well.current_formation_name,
    };

    // Parallel data fetching for performance
    const [formations, events, nearbyData, paramTrends, docChunks] = await Promise.all([
      wellRepository.getWellFormations(well.id).catch(() => []),
      eventRepository.findByWell(well.id, { limit: 20 }).catch(() => ({ events: [] })),
      overrides.include_nearby !== false
        ? nearbyWellService.findNearbyWithAnalysis(well.id, 15).catch(() => ({ nearby_wells: [] }))
        : { nearby_wells: [] },
      overrides.include_parameters !== false
        ? parameterService.computeTrends(well.id, {
            fromDepth: Math.max(0, currentDepth - 200),
            toDepth: currentDepth,
          }).catch(() => ({ data: [], trends: null }))
        : { data: [], trends: null },
      documentRepository.searchChunks(well.well_name, { wellId: well.id, limit: 10 }).catch(() => []),
    ]);

    ctx.formations = formations.map((f) => ({
      name: f.formation_name,
      top: f.top_depth,
      bottom: f.bottom_depth,
      attributes: f.geological_attributes,
    }));

    ctx.events = events.events.map((e) => ({
      type: e.event_type,
      depth: parseFloat(e.depth),
      severity: e.severity,
      description: e.description?.substring(0, 200),
      formation: e.formation_name,
    }));

    ctx.nearby_wells = (nearbyData.nearby_wells || []).slice(0, 8).map((nw) => ({
      well_name: nw.well_name,
      field: nw.field,
      distance_km: nw.distance_km,
      formation_match: nw.formation_match,
      matching_formations: nw.matching_formations,
    }));

    ctx.parameter_trends = paramTrends.trends;

    ctx.document_chunks = docChunks.slice(0, 8).map((c) => ({
      text: c.text?.substring(0, 300),
      document: c.original_filename,
      section: c.section,
    }));

    return ctx;
  },

  /**
   * Generate a fallback answer when AI service is unavailable.
   */
  _generateFallbackAnswer(question, context, well) {
    if (!well) {
      return 'I could not find the specified well. Please provide a valid well ID or name and try again.';
    }

    const parts = [`Based on the available data for well **${well.well_name}** (${well.field}):`];

    if (context.events && context.events.length > 0) {
      const criticalEvents = context.events.filter((e) => e.severity === 'critical' || e.severity === 'high');
      if (criticalEvents.length > 0) {
        parts.push(`\n**Critical/High Events (${criticalEvents.length}):**`);
        criticalEvents.slice(0, 3).forEach((e) => {
          parts.push(`- ${e.type.replace(/_/g, ' ')} at ${e.depth}m (${e.severity}): ${e.description || 'No details'}`);
        });
      }
    }

    if (context.nearby_wells && context.nearby_wells.length > 0) {
      const matched = context.nearby_wells.filter((nw) => nw.formation_match);
      parts.push(`\n**Nearby Wells:** ${context.nearby_wells.length} found within radius, ${matched.length} share formations.`);
    }

    if (context.formations && context.formations.length > 0) {
      parts.push(`\n**Formations traversed:** ${context.formations.map((f) => f.name).join(', ')}`);
    }

    parts.push('\n*Note: The AI service is currently unavailable. This is a data-only summary. Full AI analysis will be available when the service is restored.*');

    return parts.join('\n');
  },

  /**
   * Generate dynamic follow-up questions based on context.
   */
  _generateFollowUps(question, context, well) {
    const followUps = [];

    if (!well) {
      return ['What wells are currently active?', 'Show me wells in the Lakwa Field.'];
    }

    // Formation-aware follow-ups
    if (context.formations && context.formations.length > 0) {
      const currentFormation = context.formations.find(
        (f) => f.name === well?.current_formation_name
      );
      if (currentFormation) {
        followUps.push(`What are the known risks in the ${currentFormation.name}?`);
      }
    }

    // Event-aware follow-ups
    if (context.events && context.events.length > 0) {
      const eventTypes = [...new Set(context.events.map((e) => e.type))];
      if (eventTypes.includes('mud_loss') || eventTypes.includes('lost_circulation')) {
        followUps.push('What mitigation strategies were used for mud loss in nearby wells?');
      }
      if (eventTypes.includes('stuck_pipe')) {
        followUps.push('How was the stuck pipe incident resolved in offset wells?');
      }
    }

    // Nearby well follow-ups
    if (context.nearby_wells && context.nearby_wells.length > 0) {
      followUps.push(`Compare drilling parameters between ${well.well_name} and nearby wells.`);
    }

    // Parameter trend follow-ups
    if (context.parameter_trends) {
      followUps.push('What do the current drilling parameter trends indicate?');
    }

    // Ensure at least 2 follow-ups
    if (followUps.length < 2) {
      followUps.push(`What is the current risk assessment for ${well.well_name}?`);
      followUps.push(`Show similar wells to ${well.well_name}.`);
    }

    return followUps.slice(0, 4);
  },
};

module.exports = ragService;
