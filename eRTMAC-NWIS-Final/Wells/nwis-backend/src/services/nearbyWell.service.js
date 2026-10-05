// =============================================================================
// NWIS Backend — Nearby Well Service
// =============================================================================
// Core spatial intelligence: finds nearby wells using PostGIS and computes
// formation/depth overlap metadata for each result.
// =============================================================================

const wellRepository = require('../repositories/well.repository');
const db = require('../config/database');
const aiClient = require('../config/ai');
const logger = require('../utils/logger');

// ── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Fetch formations for multiple wells in a single query and return a Map
 * keyed by well_id.
 *
 * @param {string[]} wellIds - array of UUID strings
 * @returns {Promise<Map<string, Array>>} Map of wellId → formation rows
 */
async function getWellFormationsBulk(wellIds) {
  if (!wellIds || wellIds.length === 0) return new Map();

  const result = await db.query(
    `SELECT wf.well_id,
            wf.top_depth,
            wf.bottom_depth,
            f.id   AS formation_id,
            f.name AS formation_name
       FROM well_formations wf
       JOIN formations f ON wf.formation_id = f.id
      WHERE wf.well_id = ANY($1::uuid[])
      ORDER BY wf.well_id, wf.top_depth ASC`,
    [wellIds]
  );

  const map = new Map();
  for (const row of result.rows) {
    if (!map.has(row.well_id)) map.set(row.well_id, []);
    map.get(row.well_id).push(row);
  }
  return map;
}

/**
 * Merge an array of {top_depth, bottom_depth} formation rows into a sorted,
 * non-overlapping list of [top, bottom] intervals.
 * Rows with top >= bottom (or NaN) are silently discarded.
 *
 * @param {Array} formations
 * @returns {Array<[number,number]>} merged intervals sorted by top_depth
 */
function mergeDepthIntervals(formations) {
  const intervals = (formations || [])
    .map((f) => [parseFloat(f.top_depth), parseFloat(f.bottom_depth)])
    .filter(([t, b]) => !isNaN(t) && !isNaN(b) && b > t)
    .sort((a, b) => a[0] - b[0]);

  if (intervals.length === 0) return [];

  const merged = [intervals[0].slice()];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const [t, b] = intervals[i];
    if (t <= last[1]) {
      last[1] = Math.max(last[1], b);
    } else {
      merged.push([t, b]);
    }
  }
  return merged;
}

/**
 * Given two sorted merged interval lists, return all overlapping sub-intervals.
 *
 * @param {Array<[number,number]>} a
 * @param {Array<[number,number]>} b
 * @returns {Array<[number,number]>} overlapping intervals
 */
function intervalIntersection(a, b) {
  const result = [];
  let ai = 0;
  let bi = 0;
  while (ai < a.length && bi < b.length) {
    const lo = Math.max(a[ai][0], b[bi][0]);
    const hi = Math.min(a[ai][1], b[bi][1]);
    if (hi > lo) result.push([lo, hi]);
    if (a[ai][1] < b[bi][1]) {
      ai++;
    } else {
      bi++;
    }
  }
  return result;
}

// ── Service ──────────────────────────────────────────────────────────────────

const nearbyWellService = {
  /**
   * Find nearby wells and enrich with formation/depth overlap metadata.
   * Uses a single bulk query for all formations instead of N+1 per-well calls.
   */
  async findNearby(lon, lat, radiusKm, filters = {}) {
    // Get nearby wells from PostGIS
    const nearbyWells = await wellRepository.findNearby(lon, lat, radiusKm, filters);

    if (nearbyWells.length === 0) return [];

    // Bulk-fetch all formations for every nearby well in one query
    const wellIds = nearbyWells.map((w) => w.id);
    const formationsMap = await getWellFormationsBulk(wellIds);

    // Build enriched result without any further async calls
    const enriched = nearbyWells.map((well) => {
      const formations = formationsMap.get(well.id) || [];
      const formationNames = formations.map((f) => f.formation_name);

      return {
        id: well.id,
        well_name: well.well_name,
        field: well.field,
        status: well.status,
        latitude: well.latitude,
        longitude: well.longitude,
        current_depth: parseFloat(well.current_depth) || 0,
        total_depth: parseFloat(well.total_depth) || 0,
        current_formation: well.current_formation_name,
        distance_km: well.distance_km,
        formations: formationNames,
      };
    });

    return enriched;
  },

  /**
   * Find nearby wells with formation match analysis.
   * Compares formations of the reference well with nearby wells.
   *
   * Uses a single bulk query for all nearby-well formations and computes depth
   * overlap from real stratigraphic intervals (top_depth / bottom_depth) rather
   * than the crude [0, total_depth] scalar range.
   */
  async findNearbyWithAnalysis(wellId, radiusKm = 10) {
    // Get reference well
    const well = await wellRepository.findById(wellId);
    if (!well) {
      throw Object.assign(new Error('Well not found'), { code: 'WELL_NOT_FOUND', status: 404 });
    }

    // Get reference well's formations
    const refFormations = await wellRepository.getWellFormations(wellId);
    const refFormationIds = new Set(refFormations.map((f) => f.formation_id));
    const refIntervals = mergeDepthIntervals(refFormations);

    // Find nearby wells
    const nearbyWells = await wellRepository.findNearby(
      well.longitude, well.latitude, radiusKm, { limit: 50 }
    );

    // Filter out the reference well itself
    const otherWells = nearbyWells.filter((nw) => nw.id !== wellId);

    if (otherWells.length === 0) {
      return {
        reference_well: {
          id: well.id,
          well_name: well.well_name,
          latitude: well.latitude,
          longitude: well.longitude,
          current_depth: parseFloat(well.current_depth) || 0,
          current_formation: well.current_formation_name,
        },
        radius_km: radiusKm,
        nearby_wells: [],
        total: 0,
      };
    }

    // Bulk-fetch all formations, events count, and similarity for nearby wells
    const nearbyIds = otherWells.map((nw) => nw.id);
    const [formationsMap, eventsCountResult] = await Promise.all([
      getWellFormationsBulk(nearbyIds),
      db.query(
        `SELECT well_id, COUNT(*)::int AS count
         FROM drilling_events
         WHERE well_id = ANY($1::uuid[])
         GROUP BY well_id`,
        [nearbyIds]
      ).catch(() => ({ rows: [] })),
    ]);

    const eventsCountMap = new Map((eventsCountResult.rows || []).map((r) => [r.well_id, r.count]));

    // Fetch authoritative Python similarity scores
    const similarityMap = new Map();
    try {
      const simResult = await aiClient.computeSimilarity(well, [], {
        wellId,
        radiusKm,
        limit: 50,
      });
      const pyResults = simResult?.data?.results || simResult?.data?.similar_wells || [];
      for (const r of pyResults) {
        const scoreVal = typeof r.score === 'number' ? r.score : (parseFloat(r.score) || 0.85);
        if (r.well_id) {
          similarityMap.set(String(r.well_id), scoreVal);
          similarityMap.set(String(r.well_id).toLowerCase(), scoreVal);
        }
        if (r.well_name) {
          similarityMap.set(String(r.well_name), scoreVal);
          similarityMap.set(String(r.well_name).toLowerCase(), scoreVal);
        }
        if (r.backend_well_id) {
          similarityMap.set(String(r.backend_well_id), scoreVal);
          similarityMap.set(String(r.backend_well_id).toLowerCase(), scoreVal);
        }
      }
    } catch (e) {
      logger.debug('Similarity fetch in nearbyWellService skipped:', e.message);
    }

    // Build enriched results — no per-well async calls needed
    const enriched = otherWells.map((nw) => {
      const formations = formationsMap.get(nw.id) || [];
      const matchingFormations = formations.filter((f) => refFormationIds.has(f.formation_id));

      // Compute depth overlap using real formation intervals
      const nwIntervals = mergeDepthIntervals(formations);
      const overlappingIntervals = intervalIntersection(refIntervals, nwIntervals);
      const hasDepthOverlap = overlappingIntervals.length > 0;

      let depthOverlapRange = null;
      if (hasDepthOverlap) {
        const minTop    = overlappingIntervals[0][0];
        const maxBottom = overlappingIntervals[overlappingIntervals.length - 1][1];
        depthOverlapRange = `${minTop}-${maxBottom}`;
      }

      const nwIdStr = String(nw.id);
      const nwNameStr = String(nw.well_name);
      const matchedScore =
        similarityMap.get(nwIdStr) ??
        similarityMap.get(nwIdStr.toLowerCase()) ??
        similarityMap.get(nwNameStr) ??
        similarityMap.get(nwNameStr.toLowerCase()) ??
        0.85;

      return {
        id: nw.id,
        well_name: nw.well_name,
        field: nw.field,
        status: nw.status,
        latitude: parseFloat(nw.latitude),
        longitude: parseFloat(nw.longitude),
        distance_km: nw.distance_km,
        formation_match: matchingFormations.length > 0,
        matching_formations: matchingFormations.map((f) => f.formation_name),
        depth_overlap: hasDepthOverlap,
        depth_overlap_range: depthOverlapRange,
        current_depth: parseFloat(nw.current_depth) || 0,
        total_depth: parseFloat(nw.total_depth) || 0,
        historical_events_count: eventsCountMap.get(nw.id) ?? 0,
        similarity_score: matchedScore,
      };
    });

    return {
      reference_well: {
        id: well.id,
        well_name: well.well_name,
        latitude: well.latitude,
        longitude: well.longitude,
        current_depth: parseFloat(well.current_depth) || 0,
        current_formation: well.current_formation_name,
      },
      radius_km: radiusKm,
      nearby_wells: enriched,
      total: enriched.length,
    };
  },
};

module.exports = nearbyWellService;
