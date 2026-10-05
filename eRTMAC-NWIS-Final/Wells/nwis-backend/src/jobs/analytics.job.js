// =============================================================================
// NWIS Backend — Analytics Aggregation Job
// =============================================================================
// Background task for periodic analytics pre-computation and audit cleanup.
// =============================================================================

const analyticsService = require('../services/analytics.service');
const logger = require('../utils/logger');

let intervalId = null;

const analyticsJob = {
  /**
   * Run analytics refresh.
   */
  async runAggregation() {
    logger.debug('Running background analytics aggregation');
    try {
      // Pre-fetch metrics to verify database integrity & warm cache
      await Promise.all([
        analyticsService.getEventAnalytics(),
        analyticsService.getRiskAnalytics(),
        analyticsService.getAlertAnalytics(),
        analyticsService.getNPTAnalytics(),
      ]);
      logger.debug('Analytics aggregation completed successfully');
    } catch (err) {
      logger.warn({ err: err.message }, 'Analytics aggregation job encountered error');
    }
  },

  /**
   * Start recurring job.
   * @param {number} [intervalMs=300000] Default: every 5 minutes
   */
  start(intervalMs = 300000) {
    if (intervalId) return;
    logger.info({ intervalMs }, 'Starting background analytics aggregation job');
    intervalId = setInterval(() => this.runAggregation(), intervalMs);
  },

  /**
   * Stop recurring job.
   */
  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      logger.info('Stopped background analytics aggregation job');
    }
  },
};

module.exports = analyticsJob;
