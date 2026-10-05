// =============================================================================
// NWIS Backend — Realtime Service
// =============================================================================
// Manages realtime well state and the SSE event stream.
// Integrates with the replay adapter for demo scenarios.
// =============================================================================

const wellRepository = require('../repositories/well.repository');
const riskService = require('./risk.service');
const alertService = require('./alert.service');
const logger = require('../utils/logger');

// In-memory well state for realtime updates
const wellState = new Map();

const realtimeService = {
  /**
   * Get current realtime state for a well.
   */
  getState(wellId) {
    return wellState.get(wellId) || null;
  },

  /**
   * Update well state from a realtime data point.
   * This is called by the replay adapter or eRTMAC connector.
   */
  async updateState(wellId, data) {
    const isReplay = Boolean(data.isReplay || data.additional_parameters?.replay === 'true');
    const additionalParams = {
      ...(data.additional_parameters || {}),
      ...(isReplay ? { replay: 'true' } : {}),
    };

    const state = {
      wellId,
      timestamp: data.timestamp || new Date().toISOString(),
      depth: data.depth,
      formation: data.formation,
      phase: data.phase,
      phase_label: data.phase_label,
      wob: data.wob,
      rpm: data.rpm,
      torque: data.torque,
      rop: data.rop,
      mud_weight: data.mud_weight || data.mudWeight,
      mud_flow_rate: data.mud_flow_rate || data.mudFlowRate,
      standpipe_pressure: data.standpipe_pressure || data.standpipePressure || data.mudPressure,
      annular_pressure: data.annular_pressure || data.annularPressure,
      hook_load: data.hook_load || data.hookLoad,
      additional_parameters: additionalParams,
    };

    wellState.set(wellId, state);

    // Persist to drilling_parameters with replay tagging
    try {
      await wellRepository.addParameter({
        well_id: wellId,
        timestamp: state.timestamp,
        depth: state.depth,
        wob: state.wob,
        rpm: state.rpm,
        torque: state.torque,
        rop: state.rop,
        mud_weight: state.mud_weight,
        mud_flow_rate: state.mud_flow_rate,
        standpipe_pressure: state.standpipe_pressure,
        annular_pressure: state.annular_pressure,
        hook_load: state.hook_load,
        additional_parameters: additionalParams,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to persist parameter');
    }

    // Update well current depth (ensure depth only advances forward, never backwards)
    try {
      const well = await wellRepository.findById(wellId);
      const currentDbDepth = parseFloat(well?.current_depth);
      const newDepth = parseFloat(state.depth);
      if (isNaN(currentDbDepth) || newDepth >= currentDbDepth) {
        await wellRepository.update(wellId, { current_depth: newDepth });
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to update well depth');
    }

    // Broadcast state update via SSE
    alertService.broadcast(wellId, 'well-update', state);

    return state;
  },

  /**
   * Check if risk evaluation is needed based on depth change.
   */
  async checkRiskTriggers(wellId, currentDepth) {
    // Guard 1: depth delta
    const lastEvalDepth = this._lastEvalDepth.get(wellId) || 0;
    if (Math.abs(currentDepth - lastEvalDepth) < 10) return null;

    // Guard 2: time-based debounce
    const now = Date.now();
    const lastEvalTime = this._lastRiskEvalTime.get(wellId) || 0;
    if (now - lastEvalTime < 5000) return null; // max once per 5s

    // Guard 3: concurrency lock
    if (this._riskEvalInProgress.get(wellId)) {
      logger.debug({ wellId }, 'Risk evaluation already in progress, skipping');
      return null;
    }

    // Commit the evaluation
    this._lastEvalDepth.set(wellId, currentDepth);
    this._lastRiskEvalTime.set(wellId, now);
    this._riskEvalInProgress.set(wellId, true);

    try {
      const riskResult = await riskService.evaluate(wellId, currentDepth);

      // Route through alertService.upsertFromRisk (applies hysteresis, cooldown & dedupe)
      for (const risk of riskResult.risks) {
        if (risk.level === 'high' || risk.level === 'critical' || risk.score >= 0.4) {
          const evidenceRefs =
            risk.evidence_refs && risk.evidence_refs.length > 0 && typeof risk.evidence_refs[0] === 'object'
              ? risk.evidence_refs
              : (risk.evidence?.map((e) => ({
                  well_id: e.well_id || wellId,
                  event_id: e.event_id || e.id || null,
                  document_id: e.document_id || e.source_document_id || null,
                  page: e.page || 1,
                })) || []);

          await alertService.upsertFromRisk({
            id: risk.id,
            well_id: wellId,
            risk_type: risk.risk_type,
            risk_level: risk.level,
            score: risk.score,
            explanation: risk.explanation,
            evidence_refs: evidenceRefs,
            depth: currentDepth,
          });
        }
      }

      // Broadcast risk update (strip internal _skipAlert flag before sending)
      alertService.broadcast(wellId, 'risk-update', {
        depth: currentDepth,
        risks: riskResult.risks.slice(0, 5).map(({ _skipAlert, ...r }) => r),
      });

      return riskResult;
    } catch (err) {
      logger.error({ err, wellId }, 'Risk evaluation failed during realtime update');
    } finally {
      this._riskEvalInProgress.set(wellId, false);
    }

    return null;
  },

  _lastEvalDepth: new Map(),
  _lastRiskEvalTime: new Map(),
  _riskEvalInProgress: new Map(),
};

module.exports = realtimeService;
