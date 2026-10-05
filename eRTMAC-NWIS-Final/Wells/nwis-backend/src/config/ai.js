// =============================================================================
// NWIS Backend — AI Service Client (FastAPI Integration Layer)
// =============================================================================
// Resilient HTTP client for communicating with the Python/FastAPI AI service.
// Authoritative intelligence provider for:
// - RAG / Assistant
// - Multi-factor Well Similarity
// - Risk Prediction Engine
// - Vector / Semantic Search
// =============================================================================

const env = require('./env');
const logger = require('../utils/logger');

const AI_BASE_URL = env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT = parseInt(env.AI_TIMEOUT, 10) || 30000;

// ── Circuit Breaker State ───────────────────────────────────────────────────
const circuitBreaker = {
  state: 'CLOSED',        // CLOSED | OPEN | HALF_OPEN
  failureCount: 0,
  failureThreshold: 5,    // Open after 5 consecutive failures
  resetTimeoutMs: 30000,  // Try again after 30s
  lastFailureTime: 0,
  successCount: 0,
  halfOpenMaxAttempts: 2,
};

function canRequest() {
  if (circuitBreaker.state === 'CLOSED') return true;
  if (circuitBreaker.state === 'OPEN') {
    const elapsed = Date.now() - circuitBreaker.lastFailureTime;
    if (elapsed >= circuitBreaker.resetTimeoutMs) {
      circuitBreaker.state = 'HALF_OPEN';
      circuitBreaker.successCount = 0;
      logger.info('AI circuit breaker transitioning to HALF_OPEN');
      return true;
    }
    return false;
  }
  // HALF_OPEN
  return true;
}

function recordSuccess() {
  if (circuitBreaker.state === 'HALF_OPEN') {
    circuitBreaker.successCount++;
    if (circuitBreaker.successCount >= circuitBreaker.halfOpenMaxAttempts) {
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.failureCount = 0;
      logger.info('AI circuit breaker CLOSED (service recovered)');
    }
  } else {
    circuitBreaker.failureCount = 0;
  }
}

function recordFailure() {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();
  if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
    circuitBreaker.state = 'OPEN';
    logger.warn({ failures: circuitBreaker.failureCount }, 'AI circuit breaker OPEN — AI service appears down');
  }
  if (circuitBreaker.state === 'HALF_OPEN') {
    circuitBreaker.state = 'OPEN';
    logger.warn('AI circuit breaker back to OPEN after HALF_OPEN failure');
  }
}

// ── Retry Helper ────────────────────────────────────────────────────────────

async function fetchWithRetry(url, options, { retries = 2, backoffMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const err = new Error(`AI service returned ${response.status}: ${errorText}`);
        err.statusCode = response.status;
        throw err;
      }

      return response;
    } catch (err) {
      lastError = err;
      // Don't retry 4xx responses (client errors, quota errors, etc.)
      if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
        throw err;
      }
      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        logger.debug({ attempt: attempt + 1, delay, url }, 'Retrying AI service request');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ── Core Request Function ───────────────────────────────────────────────────

async function aiRequest(method, path, body = null) {
  if (!canRequest()) {
    logger.debug({ path }, 'AI circuit breaker is OPEN — skipping request');
    return { success: false, error: 'AI service circuit breaker is OPEN', circuitOpen: true };
  }

  const url = `${AI_BASE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetchWithRetry(url, options);
    const data = await response.json();
    recordSuccess();
    return { success: true, data };
  } catch (err) {
    recordFailure();
    logger.warn({ err: err.message, path }, 'AI service request failed');
    return { success: false, error: err.message };
  }
}

// ── Well ID <-> Well Name Resolver ──────────────────────────────────────────
let wellCache = null;
let wellCacheTime = 0;
const CACHE_TTL_MS = 60000;

async function getWellMap() {
  const now = Date.now();
  if (wellCache && (now - wellCacheTime < CACHE_TTL_MS)) {
    return wellCache;
  }
  const uuidToName = new Map();
  const nameToUuid = new Map();

  // Static baseline fallback for demo well
  uuidToName.set('b1000000-0000-0000-0000-000000000001', 'WELL-A-102');
  nameToUuid.set('well-a-102', 'b1000000-0000-0000-0000-000000000001');

  try {
    const db = require('./database');
    const res = await db.query('SELECT id, well_name, metadata FROM wells');
    for (const row of res.rows) {
      const u = String(row.id).toLowerCase();
      const n = String(row.well_name);
      uuidToName.set(u, n);
      nameToUuid.set(n.toLowerCase(), row.id);

      // Support original synthetic ID if present in metadata
      if (row.metadata) {
        const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        if (meta && meta.original_id) {
          nameToUuid.set(String(meta.original_id).toLowerCase(), row.id);
        }
      }
    }
    wellCache = { uuidToName, nameToUuid };
    wellCacheTime = now;
    return wellCache;
  } catch (err) {
    logger.debug('Failed to refresh well map in ai.js: ' + err.message);
    if (!wellCache) {
      wellCache = { uuidToName, nameToUuid };
    }
    return wellCache;
  }
}

async function resolveToWellName(idOrName) {
  if (!idOrName) return null;
  const str = String(idOrName).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(str)) {
    return str;
  }
  const { uuidToName } = await getWellMap();
  return uuidToName.get(str.toLowerCase()) || str;
}

async function resolveToUuid(idOrName) {
  if (!idOrName) return null;
  const str = String(idOrName).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str;
  }
  const { nameToUuid } = await getWellMap();
  return nameToUuid.get(str.toLowerCase()) || str;
}

// ── AI Client Interface ─────────────────────────────────────────────────────

const aiClient = {
  resolveToWellName,
  resolveToUuid,

  /**
   * Get circuit breaker state (for monitoring).
   */
  getCircuitState() {
    return { ...circuitBreaker };
  },

  /**
   * Health check: ping the AI service.
   */
  async healthCheck() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${AI_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const ok = response.ok;
      if (ok) recordSuccess();
      return { available: ok, url: AI_BASE_URL };
    } catch (err) {
      recordFailure();
      return { available: false, url: AI_BASE_URL, error: err.message };
    }
  },

  /**
   * RAG Query: Calls Python /assistant/query with resolved well_name.
   * Maps returned source wells back to backend UUIDs.
   */
  async ragQuery(question, context = {}) {
    const rawId = context.well?.well_name || context.wellName || context.well_name || context.wellId || context.well_id || context.well?.id || null;
    const wellName = await resolveToWellName(rawId);
    if (!wellName) {
      return { success: false, error: 'No well specified for RAG query' };
    }
    const radiusKm = context.radius_km || context.radius || 15.0;
    const res = await aiRequest('POST', '/assistant/query', {
      question,
      well_id: wellName,
      radius_km: radiusKm,
      context,
    });

    if (res?.success && res.data?.sources && Array.isArray(res.data.sources)) {
      for (const s of res.data.sources) {
        const itemWellName = s.well_name || s.well_id;
        if (itemWellName) {
          s.backend_well_id = await resolveToUuid(itemWellName);
        }
      }
    }
    return res;
  },

  /**
   * Vector Search: Calls Python /search with resolved well_name.
   * Maps returned chunk and event wells back to backend UUIDs.
   */
  async vectorSearch(query, { wellId, limit = 8, depthFrom, depthTo, eventType } = {}) {
    const wellName = wellId ? await resolveToWellName(wellId) : null;
    const res = await aiRequest('POST', '/search', {
      query: query || '',
      well_id: wellName,
      depth_from: depthFrom || null,
      depth_to: depthTo || null,
      event_type: eventType || null,
      k: limit,
      limit,
    });

    if (res?.success && res.data) {
      const allItems = [
        ...(Array.isArray(res.data.results) ? res.data.results : []),
        ...(Array.isArray(res.data.events) ? res.data.events : []),
        ...(Array.isArray(res.data.chunks) ? res.data.chunks : []),
      ];
      for (const item of allItems) {
        const itemWellName = item.well_name || item.well_id;
        if (itemWellName) {
          item.backend_well_id = await resolveToUuid(itemWellName);
        }
      }
    }
    return res;
  },

  /**
   * Similarity: Calls Python /api/similarity/compute with resolved well_name
   * and maps returned offset wells to their backend UUIDs.
   */
  async computeSimilarity(referenceWell, candidateWells = [], options = {}) {
    const rawId = referenceWell?.well_name || referenceWell?.id || options.wellName || options.wellId || null;
    const wellName = await resolveToWellName(rawId);
    if (!wellName) {
      return { success: false, error: 'No well specified for similarity computation' };
    }
    const depth = options.depth || referenceWell?.current_depth || 2850.0;
    const formation = options.formation || referenceWell?.current_formation_name || 'Kopili';
    const radiusKm = options.radiusKm || 15.0;
    const topN = options.limit || 10;

    const res = await aiRequest('POST', '/api/similarity/compute', {
      well_id: wellName,
      reference_well: referenceWell,
      candidate_wells: candidateWells,
      depth: parseFloat(depth),
      formation,
      radius_km: parseFloat(radiusKm),
      top_n: topN,
    });

    const pyResults = res?.data?.results || res?.data?.similar_wells;
    if (res?.success && Array.isArray(pyResults)) {
      for (const item of pyResults) {
        const itemWellName = item.well_name || item.well_id;
        const mappedUuid = await resolveToUuid(itemWellName);
        item.backend_well_id = mappedUuid;
        item.well_name = itemWellName;
        if (!item.id || item.id === itemWellName) {
          item.id = mappedUuid || itemWellName;
        }
      }
    }
    return res;
  },

  /**
   * Risk: Calls Python /api/risk/evaluate with resolved well_name.
   * Maps returned evidence offset wells back to backend UUIDs.
   */
  async evaluateRisk(wellData, historicalEvents = [], options = {}) {
    const rawId = wellData?.well_name || wellData?.id || options.wellName || options.wellId || null;
    const wellName = await resolveToWellName(rawId);
    if (!wellName) {
      return { success: false, error: 'No well specified for risk evaluation' };
    }
    const depth = options.depth || wellData?.current_depth || 2850.0;
    const formation = options.formation || wellData?.current_formation_name || 'Kopili';

    const res = await aiRequest('POST', '/api/risk/evaluate', {
      well_id: wellName,
      well_data: wellData,
      historical_events: historicalEvents,
      depth: parseFloat(depth),
      formation,
      radius_km: options.radiusKm || 15.0,
    });

    const pyAlerts = res?.data?.alerts || res?.data?.risks;
    if (res?.success && Array.isArray(pyAlerts)) {
      for (const alert of pyAlerts) {
        if (Array.isArray(alert.evidence)) {
          for (const ev of alert.evidence) {
            const evWellName = ev.well_name || ev.well_id;
            if (evWellName) {
              ev.backend_well_id = await resolveToUuid(evWellName);
            }
          }
        }
      }
    }
    return res;
  },

  /**
   * Document Processing / Ingestion: Calls Python /documents/ingest
   * with multipart form-data (file + metadata) and resolved well_name.
   */
  async processDocument(documentId, filePath, wellId = null) {
    if (!canRequest()) {
      logger.debug({ path: '/documents/ingest' }, 'AI circuit breaker is OPEN — skipping request');
      return { success: false, error: 'AI service circuit breaker is OPEN', circuitOpen: true };
    }

    const url = `${AI_BASE_URL}/documents/ingest`;

    try {
      const fs = require('fs');
      const path = require('path');

      // Resolve local file path from file_uri
      let resolvedPath = filePath;
      if (filePath.startsWith('local://')) {
        const storage = require('./storage');
        resolvedPath = path.join(storage.UPLOAD_DIR, filePath.replace('local://', ''));
      }

      if (!fs.existsSync(resolvedPath)) {
        logger.warn({ filePath: resolvedPath }, 'File not found for AI ingestion');
        return { success: false, error: `File not found: ${resolvedPath}` };
      }

      const fileBuffer = fs.readFileSync(resolvedPath);
      const filename = path.basename(resolvedPath);
      const wellName = wellId ? await resolveToWellName(wellId) : null;

      // Build multipart form-data manually using standard FormData
      const { FormData, Blob } = require('buffer');
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), filename);
      formData.append('well_id', wellName);
      formData.append('doc_type', 'DDR');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT * 2);

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`AI service returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      recordSuccess();
      return { success: true, data };
    } catch (err) {
      recordFailure();
      logger.warn({ err: err.message, path: '/documents/ingest' }, 'AI document ingestion failed');
      return { success: false, error: err.message };
    }
  },

  /**
   * ML Model Prediction: Calls Python /ml/risk/{well_name}.
   * Returns experimental ML probability for a specific event type.
   */
  async mlPredict(wellId, depth, eventType = 'mud_loss', explain = false) {
    const wellName = await resolveToWellName(wellId);
    const params = new URLSearchParams({ depth: String(depth), event_type: eventType });
    if (explain) params.append('explain', 'true');
    return aiRequest('GET', `/ml/risk/${encodeURIComponent(wellName)}?${params.toString()}`);
  },

  /**
   * OCR / Document extraction helper
   */
  async ocr(filePath) {
    return aiRequest('POST', '/api/ocr', { file_path: filePath });
  },

  /**
   * Entity extraction helper
   */
  async extractEntities(text) {
    return aiRequest('POST', '/api/nlp/entities', { text });
  },

  /**
   * Embedding generation helper
   */
  async generateEmbedding(text) {
    return aiRequest('POST', '/api/embeddings', { text });
  },

  /**
   * Get the AI service base URL (for WebSocket connections from frontend).
   */
  getBaseUrl() {
    return AI_BASE_URL;
  },
};

module.exports = aiClient;
