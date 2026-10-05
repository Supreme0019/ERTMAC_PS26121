// =============================================================================
// NWIS Backend — Leave-One-Well-Out Backtest Service
// =============================================================================
// PURPOSE: Validates the risk engine against historical drilling events.
// Methodology: For each historical event in well W, we exclude W from the
// offset event pool, score the risk engine at 50m, 100m, and 200m BEFORE the
// event depth, and record whether the engine would have predicted it (hit vs miss).
//
// Label: "Prototype validation on synthetic and demo data — not a clinical study"
// =============================================================================

const db = require('../config/database');
const { scoreRisk } = require('./risk.service');
const wellRepository = require('../repositories/well.repository');

const RISK_TYPE_MAP = {
  stuck_pipe: 'stuck_pipe',
  mud_loss: 'mud_loss',
  lost_circulation: 'mud_loss',
  kick: 'kick',
  well_control: 'kick',
  tight_hole: 'stuck_pipe',
  wellbore_instability: 'stuck_pipe',
  gas_cut: 'kick',
  gas_show: 'kick',
  ballooning: 'mud_loss',
  bit_failure: 'bit_wear',
  formation_change: 'formation_change',
};

const backtestService = {
  /**
   * Run leave-one-well-out backtest across all historical events.
   * @param {object} [opts]
   * @param {string[]} [opts.riskTypes] - filter to specific event types
   * @param {number[]} [opts.leadDepths] - lead depths in meters before event (default [50, 100, 200])
   * @returns {Promise<object>} backtest results
   */
  async run({ riskTypes, leadDepths = [50, 100, 200] } = {}) {
    // 1. Fetch all drilling events with well and formation info
    const eventsResult = await db.query(`
      SELECT de.id, de.well_id, de.depth, de.event_type, de.severity, de.description, de.metadata,
             w.well_name, w.latitude, w.longitude,
             f.id AS formation_id, f.name AS formation_name
      FROM drilling_events de
      JOIN wells w ON de.well_id = w.id
      LEFT JOIN formations f ON de.formation_id = f.id
      ORDER BY de.well_id, de.depth ASC
    `);
    const allEvents = eventsResult.rows;

    const results = [];
    const confusion = {}; // by event_type

    // Pre-seed known event types
    for (const ev of allEvents) {
      if (!confusion[ev.event_type]) {
        confusion[ev.event_type] = { tp: 0, fp: 0, fn: 0, tn: 0, scores: [], lead_depths: [] };
      }
    }

    // ── Phase 1: Positive Evaluations (50m, 100m, 200m precursors) ──────────
    for (const ev of allEvents) {
      if (riskTypes && !riskTypes.includes(ev.event_type)) continue;

      const mappedRiskType = RISK_TYPE_MAP[ev.event_type] || 'general';

      // Leave-one-well-out: exclude this well's events
      const neighborEvents = allEvents.filter(
        (e) => e.well_id !== ev.well_id && (RISK_TYPE_MAP[e.event_type] || e.event_type) === mappedRiskType
      );

      for (const leadMeters of leadDepths) {
        const evalDepth = Math.max(0, parseFloat(ev.depth) - leadMeters);

        // Nearby events within proximity window (e.g. within 500m MD)
        const nearbyCandidates = neighborEvents
          .filter((ne) => Math.abs(parseFloat(ne.depth) - evalDepth) <= 500)
          .map((ne) => ({
            id: ne.id,
            well_id: ne.well_id,
            well_name: ne.well_name,
            depth: parseFloat(ne.depth),
            formation_id: ne.formation_id,
            event_type: ne.event_type,
            severity: ne.severity,
            metadata: ne.metadata || {},
            distance_km: 12.5, // Regional offset analog distance
          }));

        let score = 0;
        let explanation = '';
        let level = 'low';

        try {
          const evalResult = scoreRisk({
            riskType: mappedRiskType,
            depth: evalDepth,
            alignedDepth: null,
            formation: ev.formation_id ? { formation_id: ev.formation_id, formation_name: ev.formation_name } : null,
            nearbyEvents: nearbyCandidates,
            paramTrends: null,
            physicsAnomaly: { detected: false, score: 0, signals: [] },
            depthRange: 500,
          });

          score = evalResult.score || 0;
          explanation = evalResult.explanation || '';
          level = evalResult.level || 'low';
        } catch {
          score = 0;
        }

        const hit = score >= 0.50; // Standard NWIS alert threshold
        const c = confusion[ev.event_type];
        if (hit) {
          c.tp++;
          c.lead_depths.push(leadMeters);
        } else {
          c.fn++;
        }
        c.scores.push(score);

        results.push({
          sample_type: 'event_precursor',
          event_id: ev.id,
          well_id: ev.well_id,
          well_name: ev.well_name,
          event_type: ev.event_type,
          mapped_risk_type: mappedRiskType,
          event_depth: parseFloat(ev.depth),
          eval_depth: evalDepth,
          lead_meters: leadMeters,
          score: parseFloat(score.toFixed(4)),
          level,
          hit,
          nearby_offset_count: nearbyCandidates.length,
          explanation: explanation.substring(0, 140),
        });
      }
    }

    // ── Phase 2: Negative Control Sampling (no event within ±150m) ───────────
    const wellsResult = await db.query('SELECT id, well_name FROM wells ORDER BY well_name');
    const wells = wellsResult.rows;
    const candidateDepths = [600, 1000, 1500, 1900, 2400, 3100];
    const evaluatedEventTypes = Object.keys(confusion);

    for (const w of wells) {
      const wellEvs = allEvents.filter((e) => e.well_id === w.id);
      const neighborEvents = allEvents.filter((e) => e.well_id !== w.id);

      for (const d of candidateDepths) {
        for (const evtType of evaluatedEventTypes) {
          if (riskTypes && !riskTypes.includes(evtType)) continue;
          const mappedRiskType = RISK_TYPE_MAP[evtType] || 'general';

          // Ensure no event of this type occurred within ±150m
          const hasEventNearby = wellEvs.some(
            (e) => (RISK_TYPE_MAP[e.event_type] || e.event_type) === mappedRiskType && Math.abs(parseFloat(e.depth) - d) <= 150
          );
          if (hasEventNearby) continue;

          const nearbyCandidates = neighborEvents
            .filter(
              (ne) =>
                (RISK_TYPE_MAP[ne.event_type] || ne.event_type) === mappedRiskType &&
                Math.abs(parseFloat(ne.depth) - d) <= 400
            )
            .map((ne) => ({
              id: ne.id,
              well_id: ne.well_id,
              well_name: ne.well_name,
              depth: parseFloat(ne.depth),
              formation_id: ne.formation_id,
              event_type: ne.event_type,
              severity: ne.severity,
              metadata: ne.metadata || {},
              distance_km: 12.5,
            }));

          let score = 0;
          try {
            const evalResult = scoreRisk({
              riskType: mappedRiskType,
              depth: d,
              alignedDepth: null,
              formation: null,
              nearbyEvents: nearbyCandidates,
              paramTrends: null,
              physicsAnomaly: { detected: false, score: 0, signals: [] },
              depthRange: 500,
            });
            score = evalResult.score || 0;
          } catch {
            score = 0;
          }

          const falseAlarm = score >= 0.50;
          const c = confusion[evtType];
          if (falseAlarm) {
            c.fp++;
          } else {
            c.tn++;
          }

          results.push({
            sample_type: 'negative_control',
            well_id: w.id,
            well_name: w.well_name,
            event_type: evtType,
            mapped_risk_type: mappedRiskType,
            event_depth: null,
            eval_depth: d,
            lead_meters: 0,
            score: parseFloat(score.toFixed(4)),
            level: score >= 0.50 ? 'high' : 'low',
            hit: !falseAlarm,
            false_alarm: falseAlarm,
            nearby_offset_count: nearbyCandidates.length,
            explanation: falseAlarm
              ? 'False alarm: raised risk on negative control depth without nearby event'
              : 'Correct true negative: correctly remained below alert threshold',
          });
        }
      }
    }

    // ── Phase 3: Per-Risk-Type Summary & Confusion Matrix ────────────────────
    const summary = {};
    for (const [evtType, c] of Object.entries(confusion)) {
      const posTotal = c.tp + c.fn;
      const negTotal = c.fp + c.tn;
      const recall = posTotal > 0 ? c.tp / posTotal : 0;
      const precision = c.tp + c.fp > 0 ? c.tp / (c.tp + c.fp) : 0;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      const accuracy = posTotal + negTotal > 0 ? (c.tp + c.tn) / (posTotal + negTotal) : 0;
      const medianScore = median(c.scores);
      const medianLead = c.lead_depths.length > 0 ? median(c.lead_depths) : null;

      summary[evtType] = {
        total_evaluations: posTotal + negTotal,
        positive_evaluations: posTotal,
        negative_evaluations: negTotal,
        tp: c.tp,
        fp: c.fp,
        fn: c.fn,
        tn: c.tn,
        hits: c.tp,
        misses: c.fn,
        recall: parseFloat(recall.toFixed(3)),
        precision: parseFloat(precision.toFixed(3)),
        f1: parseFloat(f1.toFixed(3)),
        accuracy: parseFloat(accuracy.toFixed(3)),
        median_score: parseFloat(medianScore.toFixed(3)),
        median_lead_meters: medianLead,
      };
    }

    const allTp = Object.values(confusion).reduce((s, c) => s + c.tp, 0);
    const allFn = Object.values(confusion).reduce((s, c) => s + c.fn, 0);
    const allFp = Object.values(confusion).reduce((s, c) => s + c.fp, 0);
    const allTn = Object.values(confusion).reduce((s, c) => s + c.tn, 0);
    const allPos = allTp + allFn;
    const allNeg = allFp + allTn;
    const overallRecall = allPos > 0 ? allTp / allPos : 0;
    const overallPrecision = allTp + allFp > 0 ? allTp / (allTp + allFp) : 0;
    const overallF1 = overallPrecision + overallRecall > 0 ? (2 * overallPrecision * overallRecall) / (overallPrecision + overallRecall) : 0;
    const overallAccuracy = allPos + allNeg > 0 ? (allTp + allTn) / (allPos + allNeg) : 0;

    return {
      label: 'Prototype validation on synthetic and demo data — not a clinical study',
      methodology: 'Leave-one-well-out: for each event in well W, remove W from offset pool, score at 50/100/200m before event depth. Negative depths sampled where no same-type event within ±150m.',
      lead_depths_m: leadDepths,
      threshold: 0.50,
      overall: {
        total_evaluations: results.length,
        total_events: allEvents.length,
        evaluated_pairs: allPos,
        hits: allTp,
        misses: allFn,
        false_positives: allFp,
        true_negatives: allTn,
        recall: parseFloat(overallRecall.toFixed(3)),
        precision: parseFloat(overallPrecision.toFixed(3)),
        f1: parseFloat(overallF1.toFixed(3)),
        accuracy: parseFloat(overallAccuracy.toFixed(3)),
      },
      confusion_table: {
        tp: allTp,
        fp: allFp,
        fn: allFn,
        tn: allTn,
        precision: parseFloat(overallPrecision.toFixed(3)),
        recall: parseFloat(overallRecall.toFixed(3)),
        f1: parseFloat(overallF1.toFixed(3)),
        accuracy: parseFloat(overallAccuracy.toFixed(3)),
      },
      by_risk_type: summary,
      detail: results,
    };
  },
};

function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

module.exports = backtestService;
