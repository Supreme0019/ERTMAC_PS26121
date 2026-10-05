// =============================================================================
// NWIS Backend — Risk Evaluation Job
// =============================================================================
// Background task that periodically evaluates risk for active wells,
// checks formation horizons, and generates alerts when risk thresholds are crossed.
// =============================================================================

const wellRepository = require('../repositories/well.repository');
const riskService = require('../services/risk.service');
const alertService = require('../services/alert.service');
const logger = require('../utils/logger');

let intervalId = null;

const riskEvaluationJob = {
  /**
   * Run risk evaluation across all active drilling wells.
   */
  async runEvaluation() {
    logger.debug('Running scheduled risk evaluation for active wells');

    try {
      const { wells } = await wellRepository.findAll({ status: 'active', limit: 50 });

      for (const well of wells) {
        const currentDepth = parseFloat(well.current_depth) || 0;
        if (currentDepth <= 0) continue;

        try {
          const evalResult = await riskService.evaluate(well.id, currentDepth);

          // Route all evaluated risks through alertService.upsertFromRisk (applies hysteresis & dedupe)
          for (const r of evalResult.risks || []) {
            if (r.level === 'high' || r.level === 'critical' || r.score >= 0.4) {
              const evidenceRefs =
                r.evidence_refs && r.evidence_refs.length > 0 && typeof r.evidence_refs[0] === 'object'
                  ? r.evidence_refs
                  : (r.evidence?.map((e) => ({
                      well_id: e.well_id || well.id,
                      event_id: e.event_id || e.id || null,
                      document_id: e.document_id || e.source_document_id || null,
                      page: e.page || 1,
                    })) || []);

              await alertService.upsertFromRisk({
                id: r.id,
                well_id: well.id,
                risk_type: r.risk_type,
                risk_level: r.level,
                score: r.score,
                explanation: r.explanation,
                evidence_refs: evidenceRefs,
                depth: currentDepth,
              });
            }
          }
        } catch (err) {
          logger.warn({ err: err.message, wellId: well.id }, 'Risk evaluation failed for well');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error querying active wells for risk evaluation');
    }
  },

  /**
   * Start the recurring evaluation job.
   * @param {number} [intervalMs=60000] Default: every 60s
   */
  start(intervalMs = 60000) {
    if (intervalId) return;
    logger.info({ intervalMs }, 'Starting background risk evaluation job');
    intervalId = setInterval(() => this.runEvaluation(), intervalMs);
  },

  /**
   * Stop the recurring evaluation job.
   */
  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      logger.info('Stopped background risk evaluation job');
    }
  },
};

module.exports = riskEvaluationJob;
