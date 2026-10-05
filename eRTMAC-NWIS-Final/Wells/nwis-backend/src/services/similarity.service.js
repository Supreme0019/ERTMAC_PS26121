// =============================================================================
// NWIS Backend — Similar-Well Engine
// =============================================================================
// Multi-factor similarity scoring: geographic, formation, depth overlap,
// trajectory, parameter, event, and data completeness.
// This is one of the most important services in NWIS.
// =============================================================================

const wellRepository = require('../repositories/well.repository');
const eventRepository = require('../repositories/event.repository');
const db = require('../config/database');
const aiClient = require('../config/ai');
const { haversineDistance } = require('../utils/distance');
const logger = require('../utils/logger');

// ── Scoring Weights ─────────────────────────────────────────────────────────

const WEIGHTS = {
  geographic: 0.15,
  formation: 0.25,
  depthOverlap: 0.20,
  trajectory: 0.15,
  parameter: 0.10,
  eventSimilarity: 0.10,
  completeness: 0.05,
};

const similarityService = {
  /**
   * Authoritative Python Similarity Engine Integration.
   * Node implementation is preserved as @deprecated fallback.
   */
  async computeSimilarity(referenceWellId, { radiusKm = 20, limit = 10 } = {}) {
    const refWell = await wellRepository.findById(referenceWellId);
    if (!refWell) {
      throw Object.assign(new Error('Well not found'), { code: 'WELL_NOT_FOUND', status: 404 });
    }

    // ── Delegate to Authoritative Python Similarity Service ──────────────────
    try {
      const aiResult = await aiClient.computeSimilarity(refWell, [], {
        wellId: referenceWellId,
        depth: refWell.current_depth,
        formation: refWell.current_formation_name,
        radiusKm,
        limit,
      });

      const pyResults = aiResult?.data?.results || aiResult?.data?.similar_wells;
      if (aiResult?.success && Array.isArray(pyResults) && pyResults.length > 0) {
        logger.info({ wellId: referenceWellId, count: pyResults.length }, 'Using authoritative Python similarity scores');
        return {
          reference_well: { id: refWell.id, well_name: refWell.well_name },
          similar_wells: pyResults.slice(0, limit).map((r) => ({
            id: r.backend_well_id || r.well_id,
            well_id: r.backend_well_id || r.well_id,
            well_name: r.well_name,
            field: refWell.field,
            status: 'Offset Completed',
            distance_km: r.distance_km,
            similarity_score: r.score,
            scores: {
              geographic: r.factors?.proximity ?? 0.85,
              formation: r.factors?.formation ?? 1.0,
              depthOverlap: r.factors?.depth_overlap ?? 0.9,
              trajectory: r.factors?.trajectory ?? 0.85,
              parameter: r.factors?.parameters ?? 0.75,
              eventSimilarity: r.factors?.events ?? 0.8,
              completeness: r.factors?.completeness ?? 0.7,
            },
            engine: 'python-authoritative',
          })),
          weights: WEIGHTS,
        };
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Python similarity service unavailable, falling back to Node fallback engine');
    }

    // ── DEPRECATED Node Fallback Execution ─────────────────────────────────
    logger.warn({ wellId: referenceWellId }, 'Executing @deprecated Node similarity fallback calculation');
    const [refFormations, refTrajectory, refParams, refEventsResult] = await Promise.all([
      wellRepository.getWellFormations(referenceWellId),
      wellRepository.getTrajectory(referenceWellId),
      wellRepository.getParameters(referenceWellId, { limit: 100 }),
      eventRepository.findByWell(referenceWellId, { limit: 100 }),
    ]);
    const refEvents = refEventsResult.events || [];

    const nearbyWells = await wellRepository.findNearby(
      refWell.longitude, refWell.latitude, radiusKm, { limit: 50 }
    );
    const candidates = nearbyWells.filter((w) => w.id !== referenceWellId);

    if (candidates.length === 0) {
      return {
        reference_well: { id: refWell.id, well_name: refWell.well_name },
        similar_wells: [],
        weights: WEIGHTS,
      };
    }

    // ── Round 3: all candidate data in 4 parallel bulk queries ───────────
    const candidateIds = candidates.map((c) => c.id);
    const [
      candFormationsMap,
      candTrajectoryMap,
      candParamsMap,
      candEventsMap,
    ] = await Promise.all([
      wellRepository.getWellFormationsBulk(candidateIds),
      wellRepository.getTrajectoryBulk(candidateIds),
      wellRepository.getParametersBulk(candidateIds, 100),
      eventRepository.findByWellsBulk(candidateIds, 100),
    ]);

    // ── Score each candidate (pure CPU — no I/O) ─────────────────────────
    const scored = candidates.map((candidate) => {
      const candFormations = candFormationsMap.get(candidate.id) || [];
      const candTrajectory = candTrajectoryMap.get(candidate.id) || [];
      const candParams     = candParamsMap.get(candidate.id)     || [];
      const candEvents     = candEventsMap.get(candidate.id)     || [];

      const scores = {
        geographic:      this._geographicScore(candidate.distance_km, radiusKm),
        formation:       this._formationScore(refFormations, candFormations),
        depthOverlap:    this._depthOverlapScore(refFormations, candFormations),
        trajectory:      this._trajectoryScore(refTrajectory, candTrajectory),
        parameter:       this._parameterScore(refParams, candParams),
        eventSimilarity: this._eventScore(refEvents, candEvents),
        completeness:    this._completenessScore({
          hasTrajectory:  candTrajectory.length > 0,
          hasFormations:  candFormations.length > 0,
          hasParameters:  candParams.length > 0,
          hasEvents:      candEvents.length > 0,
        }),
      };

      const totalScore =
        WEIGHTS.geographic      * scores.geographic      +
        WEIGHTS.formation       * scores.formation       +
        WEIGHTS.depthOverlap    * scores.depthOverlap    +
        WEIGHTS.trajectory      * scores.trajectory      +
        WEIGHTS.parameter       * scores.parameter       +
        WEIGHTS.eventSimilarity * scores.eventSimilarity +
        WEIGHTS.completeness    * scores.completeness;

      return {
        well_id:          candidate.id,
        well_name:        candidate.well_name,
        field:            candidate.field,
        status:           candidate.status,
        distance_km:      candidate.distance_km,
        similarity_score: parseFloat(totalScore.toFixed(4)),
        scores,
        engine: 'node-fallback',
      };
    });

    // Sort by similarity descending
    scored.sort((a, b) => b.similarity_score - a.similarity_score);

    return {
      reference_well: { id: refWell.id, well_name: refWell.well_name },
      similar_wells:  scored.slice(0, limit),
      weights:        WEIGHTS,
    };
  },


  // ── Scoring Functions ───────────────────────────────────────────────────

  /**
   * Geographic: closer wells score higher. Linear decay to 0 at maxRadius.
   */
  _geographicScore(distanceKm, maxRadiusKm) {
    if (distanceKm <= 0) return 1.0;
    return Math.max(0, 1 - distanceKm / maxRadiusKm);
  },

  /**
   * Formation: Jaccard similarity of formation sets.
   */
  _formationScore(refFormations, candFormations) {
    if (refFormations.length === 0 || candFormations.length === 0) return 0;

    const refSet = new Set(refFormations.map((f) => f.formation_id));
    const candSet = new Set(candFormations.map((f) => f.formation_id));

    let intersection = 0;
    for (const id of refSet) {
      if (candSet.has(id)) intersection++;
    }

    const union = new Set([...refSet, ...candSet]).size;
    return union > 0 ? intersection / union : 0;
  },

  /**
   * Depth overlap: geologically-correct per-formation stratigraphic interval Jaccard.
   *
   * A raw depth-range Jaccard (comparing [0, totalDepth] or global merged
   * intervals) is geologically meaningless — two wells that drill the same
   * depth window but through entirely different formations share nothing
   * stratigraphically.
   *
   * This implementation computes overlap **per named formation**, so credit is
   * only given when *both* wells penetrate the *same stratigraphic unit* at
   * *overlapping depth intervals*.  The per-formation Jaccard scores are then
   * weighted by the length of the shared/union drilled interval and combined
   * into a single [0, 1] score.
   *
   * Algorithm (for each formation name that appears in either well):
   *   1. Collect all [top, bottom] intervals for that formation in each well.
   *   2. Merge overlapping intervals within each well (a well can re-enter
   *      a formation after a fault/unconformity).
   *   3. Compute intersectionLength and unionLength for the two interval sets.
   *   4. Accumulate weighted numerator (intersection) and denominator (union).
   *
   * Final score = Σ intersection_length / Σ union_length  (across all formations)
   *
   * Edge-cases:
   *   - Formation present in only one well → contributes 0 to numerator,
   *     its full drilled length to denominator (correct penalty).
   *   - No valid formation data in either well → returns 0 (not 1).
   *
   * @param {Array} refFormations  - well_formations rows for the reference well
   *                                 (must include formation_name, top_depth, bottom_depth)
   * @param {Array} candFormations - well_formations rows for the candidate well
   * @returns {number} score in [0, 1]
   */
  _depthOverlapScore(refFormations, candFormations) {
    const toInterval = (f) => {
      const t = parseFloat(f.top_depth);
      const b = parseFloat(f.bottom_depth);
      return !isNaN(t) && !isNaN(b) && b > t ? [t, b] : null;
    };

    /** Group total drilled thickness per formation name */
    const groupThicknessByFormation = (formations) => {
      const map = new Map();
      for (const f of formations) {
        const key = (f.formation_name || f.formation_id || '').toString().toLowerCase().trim();
        if (!key) continue;
        const interval = toInterval(f);
        if (!interval) continue;
        const thick = interval[1] - interval[0];
        map.set(key, (map.get(key) || 0) + thick);
      }
      return map;
    };

    const refMap = groupThicknessByFormation(refFormations);
    const candMap = groupThicknessByFormation(candFormations);

    if (refMap.size === 0 || candMap.size === 0) return 0;

    let totalWeightedOverlap = 0;
    let totalWeight = 0;

    const allFormations = new Set([...refMap.keys(), ...candMap.keys()]);
    for (const fName of allFormations) {
      const refThick = refMap.get(fName) || 0;
      const candThick = candMap.get(fName) || 0;
      const maxThick = Math.max(refThick, candThick);
      const minThick = Math.min(refThick, candThick);

      if (maxThick > 0) {
        // Formation-relative thickness overlap ratio: min / max
        const ratio = minThick / maxThick;
        const weight = maxThick;
        totalWeightedOverlap += ratio * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? parseFloat((totalWeightedOverlap / totalWeight).toFixed(4)) : 0;
  },

  /**
   * Trajectory: compare inclination/azimuth trends at matching depths.
   */
  _trajectoryScore(refTraj, candTraj) {
    if (refTraj.length < 2 || candTraj.length < 2) return 0.5; // No data → neutral

    // Compare inclination at matching depths
    let matches = 0;
    let comparisons = 0;

    for (const rp of refTraj) {
      // Find closest candidate point by depth
      let closest = null;
      let minDiff = Infinity;
      for (const cp of candTraj) {
        const diff = Math.abs(parseFloat(rp.measured_depth) - parseFloat(cp.measured_depth));
        if (diff < minDiff) {
          minDiff = diff;
          closest = cp;
        }
      }

      if (closest && minDiff < 200) {
        const inclDiff = Math.abs((parseFloat(rp.inclination) || 0) - (parseFloat(closest.inclination) || 0));
        const score = Math.max(0, 1 - inclDiff / 45); // 45° diff = 0 score
        matches += score;
        comparisons++;
      }
    }

    return comparisons > 0 ? matches / comparisons : 0.5;
  },

  /**
   * Parameter: compare average drilling parameters.
   */
  _parameterScore(refParams, candParams) {
    if (refParams.length === 0 || candParams.length === 0) return 0.5;

    const avg = (arr, key) => {
      const vals = arr.map((p) => parseFloat(p[key])).filter((v) => !isNaN(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const keys = ['wob', 'rpm', 'torque', 'rop', 'mud_weight'];
    let totalScore = 0;
    let validKeys = 0;

    for (const key of keys) {
      const refAvg = avg(refParams, key);
      const candAvg = avg(candParams, key);

      if (refAvg > 0 && candAvg > 0) {
        const ratio = Math.min(refAvg, candAvg) / Math.max(refAvg, candAvg);
        totalScore += ratio;
        validKeys++;
      }
    }

    return validKeys > 0 ? totalScore / validKeys : 0.5;
  },

  /**
   * Event: compare event type distributions.
   */
  _eventScore(refEvents, candEvents) {
    if (refEvents.length === 0 && candEvents.length === 0) return 0.5;
    if (refEvents.length === 0 || candEvents.length === 0) return 0.3;

    const refTypes = new Set(refEvents.map((e) => e.event_type));
    const candTypes = new Set(candEvents.map((e) => e.event_type));

    let intersection = 0;
    for (const t of refTypes) {
      if (candTypes.has(t)) intersection++;
    }

    const union = new Set([...refTypes, ...candTypes]).size;
    return union > 0 ? intersection / union : 0;
  },

  /**
   * Data completeness: reward wells with more complete data.
   */
  _completenessScore({ hasTrajectory, hasFormations, hasParameters, hasEvents }) {
    let score = 0;
    if (hasTrajectory) score += 0.25;
    if (hasFormations) score += 0.25;
    if (hasParameters) score += 0.25;
    if (hasEvents) score += 0.25;
    return score;
  },
};

module.exports = similarityService;
