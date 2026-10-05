// =============================================================================
// NWIS Backend — Risk Service
// =============================================================================
// Rules-based + historical evidence + physics anomaly risk engine.
// Uses formation-relative depth alignment and real-time surface telemetry physics.
// =============================================================================

const wellRepository = require('../repositories/well.repository');
const eventRepository = require('../repositories/event.repository');
const riskRepository = require('../repositories/risk.repository');
const nearbyWellService = require('./nearbyWell.service');
const parameterService = require('./parameter.service');
const { alignDepth } = require('../utils/depth');
const { detectPhysicsAnomalies } = require('../utils/anomaly');
const aiClient = require('../config/ai');
const logger = require('../utils/logger');

const MODEL_VERSION = 'NWIS-Risk-v2';

// ── Risk Types ──────────────────────────────────────────────────────────────
const RISK_TYPES = [
  'mud_loss', 'stuck_pipe', 'kick', 'lost_circulation',
  'gas_cut', 'wellbore_instability', 'tight_hole', 'well_control',
];

/**
 * Pure scoring function — no I/O.
 * Used by both live evaluation and leave-one-well-out backtest.
 *
 * @param {object} params
 * @param {string} params.riskType
 * @param {number} params.depth
 * @param {object|null} params.alignedDepth - { formation_id, formation_name, top_depth, depth_below_top, tvd }
 * @param {object|null} params.formation
 * @param {Array} params.nearbyEvents - events from offset wells
 * @param {object|null} params.paramTrends
 * @param {object|null} params.physicsAnomaly - { detected: boolean, score: number, signals: string[] }
 * @param {number} [params.depthRange=500]
 * @returns {{ score: number, level: string, depth_range: number[], evidence: Array, evidence_refs: Array, explanation: string, signals: string[] }}
 */
function scoreRisk({
  riskType,
  depth,
  alignedDepth = null,
  formation = null,
  nearbyEvents = [],
  paramTrends = null,
  physicsAnomaly = null,
  depthRange = 500,
}) {
  let score = 0;
  const evidence = [];
  const evidenceRefs = [];
  const contributingSignals = [];

  // ── Factor 1: Event frequency in offset wells ───────────────────────────
  const eventFrequency = nearbyEvents.length;
  if (eventFrequency >= 3) score += 0.30;
  else if (eventFrequency >= 2) score += 0.25;
  else if (eventFrequency >= 1) score += 0.15;

  // ── Factor 2: Severity of historical events ─────────────────────────────
  const hasCritical = nearbyEvents.some((e) => e.severity === 'critical');
  const hasHigh = nearbyEvents.some((e) => e.severity === 'high');
  if (hasCritical) score += 0.20;
  else if (hasHigh) score += 0.15;

  // ── Factor 3 & 4: Formation Match & Relative Depth Alignment ────────────
  let closestEvent = null;
  let closestDelta = Infinity;
  let usedRelativeAlignment = false;
  let fellBackToAbsolute = false;

  const formationName = alignedDepth?.formation_name || formation?.formation_name || 'formation';

  if (nearbyEvents.length > 0) {
    if (alignedDepth?.formation_id && alignedDepth?.depth_below_top !== null) {
      // Stratigraphic formation-relative matching
      for (const e of nearbyEvents) {
        let eDepthBelowTop = null;
        if (e.metadata?.depth_below_top !== undefined) {
          eDepthBelowTop = parseFloat(e.metadata.depth_below_top);
        } else if (e.top_depth !== undefined && e.top_depth !== null) {
          eDepthBelowTop = parseFloat(e.depth) - parseFloat(e.top_depth);
        }

        if (e.formation_id === alignedDepth.formation_id && eDepthBelowTop !== null) {
          const delta = Math.abs(alignedDepth.depth_below_top - eDepthBelowTop);
          if (delta < closestDelta) {
            closestDelta = delta;
            closestEvent = { event: e, delta, mode: 'relative' };
            usedRelativeAlignment = true;
          }
        }
      }

      if (usedRelativeAlignment && closestEvent) {
        // Matched within same formation top
        score += 0.20; // formation match
        // Proximity below formation top (within 150m)
        score += Math.max(0, 1 - closestEvent.delta / 150) * 0.15;
      }
    }

    // Fall back to absolute MD if no formation match or formation tops missing
    if (!closestEvent) {
      fellBackToAbsolute = true;
      for (const e of nearbyEvents) {
        const dist = Math.abs(parseFloat(e.depth) - depth);
        if (dist < closestDelta) {
          closestDelta = dist;
          closestEvent = { event: e, delta: dist, mode: 'absolute' };
        }
      }

      if (formation && nearbyEvents.some((e) => e.formation_id === formation.formation_id)) {
        score += 0.15;
      }
      if (closestEvent) {
        score += Math.max(0, 1 - closestEvent.delta / depthRange) * 0.15;
      }
    }
  }

  // ── Factor 5: Parameter Trends & Physics Anomaly Layer ──────────────────
  if (paramTrends) {
    if (riskType === 'stuck_pipe' && paramTrends.torque?.increasing && paramTrends.rop?.increasing === false) {
      score += 0.10;
      contributingSignals.push('Torque increasing with ROP dropping');
    }
    if (riskType === 'mud_loss' && paramTrends.wob?.increasing) {
      score += 0.05;
      contributingSignals.push('WOB trending upward');
    }
  }

  // Physics-based telemetry anomaly signatures (kick, loss, stuck)
  if (physicsAnomaly) {
    if (physicsAnomaly.signals && physicsAnomaly.signals.length > 0) {
      contributingSignals.push(...physicsAnomaly.signals);
    }
    if (physicsAnomaly.detected) {
      // Bounded parameter boost from physical anomaly
      score = Math.max(score, physicsAnomaly.score);
    } else if (physicsAnomaly.score > 0) {
      score = Math.max(score, Math.min(0.40, score + 0.15));
    }
  }

  // Zero-offset fallback: produce score directly from telemetry when offset events = 0
  if (nearbyEvents.length === 0 && physicsAnomaly && physicsAnomaly.score > 0) {
    score = physicsAnomaly.score;
  }

  score = Math.min(1.0, parseFloat(score.toFixed(4)));

  // Determine risk level
  let level;
  if (score >= 0.7) level = 'critical';
  else if (score >= 0.5) level = 'high';
  else if (score >= 0.3) level = 'medium';
  else level = 'low';

  // Build evidence list (cap at 5 items)
  if (nearbyEvents.length === 0) {
    evidenceRefs.push({
      provenance: 'INFERENCE',
      snippet: 'Physics/telemetry anomaly — no direct offset events available within search radius',
    });
  } else {
    for (const event of nearbyEvents.slice(0, 5)) {
      const dist = event.distance_km !== undefined ? event.distance_km : null;
      const provenance = (dist === 0) ? 'DIRECT'
        : (dist !== null && dist <= 15) ? 'REGIONAL'
        : (event.formation_id === alignedDepth?.formation_id || event.formation_name === formationName) ? 'ANALOG'
        : 'REGIONAL';

      const snippet = `${(event.event_type || 'Incident').replace(/_/g, ' ')} at ${event.depth}m in ${event.well_name || 'offset well'}${dist !== null ? ` (${dist.toFixed(1)} km away)` : ''}`;

      evidence.push({
        well: event.well_name,
        well_id: event.well_id,
        event_id: event.id,
        event_type: event.event_type,
        depth: parseFloat(event.depth),
        severity: event.severity,
        description: event.description?.substring(0, 150),
        source_document_id: event.source_document_id || null,
        document_id: event.source_document_id || null,
        page: event.metadata?.page || 1,
        provenance,
        snippet,
      });

      evidenceRefs.push({
        well_id: event.well_id,
        well_name: event.well_name,
        event_id: event.id,
        event_type: event.event_type,
        depth: parseFloat(event.depth),
        document_id: event.source_document_id || null,
        page: event.metadata?.page || 1,
        provenance,
        snippet,
      });
    }
  }

  const distances = nearbyEvents.map((e) => (e.distance_km !== undefined ? e.distance_km : 15));
  const closestKm = distances.length > 0 ? Math.min(...distances) : null;
  const provenanceSummary = {
    source_count: nearbyEvents.length,
    has_direct: nearbyEvents.some((e) => e.distance_km === 0),
    closest_km: closestKm !== null ? parseFloat(closestKm.toFixed(1)) : null,
    message: nearbyEvents.length === 0
      ? 'No direct offset events within search radius. Score derived from telemetry signals.'
      : `Based on ${nearbyEvents.length} offset event(s) from ${closestKm !== null ? closestKm.toFixed(1) : '15.0'} km away.`,
  };

  const eventDepths = nearbyEvents.map((e) => parseFloat(e.depth));
  const minDepth = eventDepths.length > 0 ? Math.min(...eventDepths) : depth;
  const maxDepth = eventDepths.length > 0 ? Math.max(...eventDepths) : depth;

  // Build transparent geological & physical explanation
  let explanation = '';
  if (nearbyEvents.length > 0) {
    explanation = `${level.toUpperCase()} risk of ${riskType.replace(/_/g, ' ')} based on ${nearbyEvents.length} historical incident(s) in offset wells. `;

    if (usedRelativeAlignment && closestEvent) {
      explanation += `${Math.round(closestEvent.delta)} m below ${formationName} top in ${closestEvent.event.well_name} vs ${Math.round(alignedDepth.depth_below_top)} m here. `;
    } else if (fellBackToAbsolute && closestEvent) {
      explanation += `Closest incident was at ${closestEvent.event.depth} m in ${closestEvent.event.well_name} (formation tops missing for relative alignment; fell back to absolute MD). `;
    }
  } else if (contributingSignals.length > 0) {
    explanation = `Surface telemetry anomaly: ${level.toUpperCase()} risk of ${riskType.replace(/_/g, ' ')} detected from real-time drilling physics alone (zero offset incidents in this zone). `;
  } else {
    explanation = `Nominal conditions for ${riskType.replace(/_/g, ' ')} at ${depth} m. `;
  }

  if (contributingSignals.length > 0) {
    explanation += `Contributing signals: ${contributingSignals.join('; ')}.`;
  }

  return {
    score,
    level,
    depth_range: [minDepth, maxDepth],
    evidence,
    evidence_refs: evidenceRefs,
    provenance_summary: provenanceSummary,
    explanation: explanation.trim(),
    signals: contributingSignals,
  };
}

const riskService = {
  scoreRisk,

  /**
   * Evaluate risks for a well at a given depth.
   */
  async evaluate(wellId, depth = null) {
    // ── Round 0 ─────────────────────────────────────────────────────────
    const well = await wellRepository.findById(wellId);
    if (!well) {
      throw Object.assign(new Error('Well not found'), { code: 'WELL_NOT_FOUND', status: 404 });
    }

    const currentDepth = depth || parseFloat(well.current_depth) || 0;
    logger.info({ wellId, depth: currentDepth }, 'Authoritative risk evaluation started');

    // ── Delegate to Authoritative Python Risk Engine ─────────────────────────
    try {
      const aiResult = await aiClient.evaluateRisk(well, [], {
        wellId,
        depth: currentDepth,
        formation: well.current_formation_name,
        radiusKm: 15,
      });

      const pyAlerts = aiResult?.data?.alerts || aiResult?.data?.risks;
      if (aiResult?.success && Array.isArray(pyAlerts)) {
        logger.info({ wellId, depth: currentDepth, count: pyAlerts.length }, 'Using authoritative Python risk engine evaluation');

        // Persist top risks into database asynchronously
        for (const alert of pyAlerts.filter((a) => a.score >= 50)) {
          riskRepository.upsert({
            well_id: wellId,
            depth: currentDepth,
            risk_type: alert.risk_type,
            score: (alert.score || 50) / 100,
            risk_level: alert.risk_level || 'moderate',
            depth_range: alert.depth_range || [currentDepth - 25, currentDepth + 25],
            evidence_refs: alert.evidence?.map((e) => e.event_id) || [],
            model_version: alert.rule_version || 'NWIS-Risk-v1',
            explanation: Array.isArray(alert.reasons) ? alert.reasons.join('. ') : (alert.reasons || alert.note || ''),
          }).catch((err) => {
            logger.debug('Risk prediction upsert skipped:', err.message);
          });
        }

        return {
          well_id: wellId,
          evaluated_depth: currentDepth,
          risks: pyAlerts.map((a) => {
            // Map 'moderate' -> 'medium' for consistent alert thresholds
            let level = a.risk_level;
            if (level === 'moderate') level = 'medium';
            // Normalize score: AI returns 0-100, alert.service.js expects 0-1
            const rawScore = typeof a.score === 'number' ? a.score : parseFloat(a.score) || 0;
            const score01 = rawScore > 1 ? rawScore / 100 : rawScore;
            const score100 = rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);
            return {
              risk_type: a.risk_type,
              level,
              score: score01,
              score_100: score100,
              depth_range: a.depth_range,
              evidence: a.evidence || [],
              evidence_refs: Array.isArray(a.evidence) ? a.evidence.map((e) => e.event_id || e.id).filter(Boolean) : [],
              explanation: Array.isArray(a.reasons) ? a.reasons.join('. ') : (a.reasons || a.note || 'Identified based on offset well intelligence'),
              signals: a.score_breakdown ? Object.keys(a.score_breakdown) : [],
              rule_version: a.rule_version || 'NWIS-Risk-v1',
              engine: 'python-authoritative',
            };
          }),
          evaluated_at: new Date().toISOString(),
          model_version: 'NWIS-Python-Risk-v1',
          active_count: pyAlerts.filter((a) => {
            const s = typeof a.score === 'number' ? a.score : parseFloat(a.score) || 0;
            return s > 1 ? s >= 60 : s >= 0.6;
          }).length,
        };
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Python risk engine unavailable, falling back to Node fallback engine');
    }

    // ── DEPRECATED Node Fallback Execution ─────────────────────────────────
    logger.warn({ wellId, depth: currentDepth }, 'Executing @deprecated Node risk fallback calculation');
    // ── Round 1: all context queries in parallel ─────────────────────────
    const [
      formation,
      alignedDepth,
      nearbyData,
      paramTrendsResult,
      latestParams,
      recentParams,
    ] = await Promise.all([
      wellRepository.getFormationAtDepth(wellId, currentDepth),
      alignDepth(wellId, currentDepth).catch(() => null),
      nearbyWellService.findNearbyWithAnalysis(wellId, 15),
      parameterService.computeTrends(wellId, {
        fromDepth: Math.max(0, currentDepth - 200),
        toDepth: currentDepth,
      }),
      wellRepository.getLatestParameters(wellId).catch(() => null),
      wellRepository.getParameters(wellId, { limit: 20 }).catch(() => []),
    ]);

    const nearbyWellIds = nearbyData.nearby_wells.map((w) => w.id);
    const paramTrends = paramTrendsResult.trends;
    const allWellIds = [wellId, ...nearbyWellIds];

    // Compute physics anomalies from surface telemetry
    const historicalSeries = {
      torque: (recentParams || []).map((p) => parseFloat(p.torque)).filter((v) => !isNaN(v)).reverse(),
      rop: (recentParams || []).map((p) => parseFloat(p.rop)).filter((v) => !isNaN(v)).reverse(),
      spp: (recentParams || []).map((p) => parseFloat(p.standpipe_pressure)).filter((v) => !isNaN(v)).reverse(),
    };
    const physicsAnomalies = detectPhysicsAnomalies(latestParams || {}, historicalSeries);

    // ── Round 2: all 8 risk-type event lookups in parallel ───────────────
    const DEPTH_RANGE = 500;
    const eventResults = await Promise.all(
      RISK_TYPES.map((riskType) =>
        eventRepository.findByTypeAcrossWells(allWellIds, riskType, {
          fromDepth: currentDepth - DEPTH_RANGE,
          toDepth: currentDepth + DEPTH_RANGE,
        })
      )
    );

    // ── Score each risk type using pure scoreRisk ─────────────────────────
    const scoredRisks = [];

    for (let i = 0; i < RISK_TYPES.length; i++) {
      const riskType = RISK_TYPES[i];
      const allEvents = eventResults[i] || [];
      const nearbyEvents = allEvents.filter((e) => e.well_id !== wellId);
      const physicsAnomaly = physicsAnomalies[riskType] || null;

      const result = scoreRisk({
        riskType,
        depth: currentDepth,
        alignedDepth,
        formation,
        nearbyEvents,
        paramTrends,
        physicsAnomaly,
        depthRange: DEPTH_RANGE,
      });

      if (result && result.score > 0.3) {
        scoredRisks.push({ riskType, result });
      }
    }

    // ── Round 3: batch-upsert all surviving predictions ──────────────────
    // Uses ON CONFLICT (well_id, risk_type, depth_bucket)
    const depthBucket = Math.floor(currentDepth / 25);
    const predictionRows = await Promise.all(
      scoredRisks.map(({ riskType, result }) =>
        riskRepository.upsert({
          well_id: wellId,
          depth: currentDepth,
          depth_bucket: depthBucket,
          risk_type: riskType,
          score: result.score,
          risk_level: result.level,
          depth_range: result.depth_range,
          evidence_refs: result.evidence_refs,
          model_version: MODEL_VERSION,
          explanation: result.explanation,
        })
      )
    );

    const risks = predictionRows.map((prediction, idx) => ({
      id: prediction.id,
      risk_type: scoredRisks[idx].riskType,
      score: scoredRisks[idx].result.score,
      score_100: Math.round(scoredRisks[idx].result.score * 100),
      level: scoredRisks[idx].result.level,
      depth_range: scoredRisks[idx].result.depth_range,
      explanation: scoredRisks[idx].result.explanation,
      evidence: scoredRisks[idx].result.evidence,
      signals: scoredRisks[idx].result.signals,
      engine: 'node-fallback',
    }));

    risks.sort((a, b) => b.score - a.score);

    logger.info({ wellId, risksFound: risks.length }, 'Risk evaluation completed');

    return {
      well_id: wellId,
      well_name: well.well_name,
      depth: currentDepth,
      formation: alignedDepth?.formation_name || formation?.formation_name || well.current_formation_name,
      aligned_depth: alignedDepth,
      indicators: physicsAnomalies.indicators,
      risks,
      model_version: MODEL_VERSION,
      evaluated_at: new Date().toISOString(),
    };
  },

  /**
   * Legacy method for backwards compatibility.
   */
  _scoreRiskType(riskType, depth, formation, nearbyEvents, paramTrends, depthRange) {
    return scoreRisk({
      riskType,
      depth,
      formation,
      nearbyEvents,
      paramTrends,
      depthRange,
    });
  },

  /**
   * Get existing risk predictions for a well.
   */
  async getRisks(wellId, filters) {
    return await riskRepository.findByWell(wellId, filters);
  },

  /**
   * Get active risks for the current depth.
   */
  async getActiveRisks(wellId) {
    const well = await wellRepository.findById(wellId);
    if (!well) {
      throw Object.assign(new Error('Well not found'), { code: 'WELL_NOT_FOUND', status: 404 });
    }
    const currentDepth = parseFloat(well.current_depth) || 0;
    try {
      const evalResult = await this.evaluate(wellId, currentDepth);
      if (evalResult && Array.isArray(evalResult.risks)) {
        return evalResult.risks;
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Live risk evaluation in getActiveRisks failed, falling back to DB');
    }
    return await riskRepository.findActiveRisks(wellId, currentDepth);
  },
};

module.exports = riskService;
