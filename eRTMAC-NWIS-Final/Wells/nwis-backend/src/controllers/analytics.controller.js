// =============================================================================
// NWIS Backend — Analytics Controller
// =============================================================================
// Exposes analytics on events, formations, risks, alerts, NPT, and drilling
// performance.
// =============================================================================

const analyticsService = require('../services/analytics.service');
const { success } = require('../utils/response');

const analyticsController = {
  /**
   * Get event analytics (per type, severity, formation).
   */
  async getEvents(req, res, next) {
    try {
      const data = await analyticsService.getEventAnalytics({
        wellId: req.query.well_id,
        fromDate: req.query.from_date,
        toDate: req.query.to_date,
      });
      return success(res, data);
    } catch (err) { next(err); }
  },

  /**
   * Get formation-specific analytics.
   */
  async getFormations(req, res, next) {
    try {
      const data = await analyticsService.getFormationAnalytics({
        wellId: req.query.well_id,
      });
      return success(res, data);
    } catch (err) { next(err); }
  },

  /**
   * Get risk distribution analytics.
   */
  async getRisks(req, res, next) {
    try {
      const data = await analyticsService.getRiskAnalytics({
        wellId: req.query.well_id,
        fromDate: req.query.from_date,
        toDate: req.query.to_date,
      });
      return success(res, data);
    } catch (err) { next(err); }
  },

  /**
   * Get alert statistics (status, severity breakdown, avg ack time).
   */
  async getAlerts(req, res, next) {
    try {
      const data = await analyticsService.getAlertAnalytics({
        wellId: req.query.well_id,
        fromDate: req.query.from_date,
        toDate: req.query.to_date,
      });
      return success(res, data);
    } catch (err) { next(err); }
  },

  /**
   * Get NPT (Non-Productive Time) metrics by event type and well.
   */
  async getNPT(req, res, next) {
    try {
      const data = await analyticsService.getNPTAnalytics({
        wellId: req.query.well_id,
        fromDate: req.query.from_date,
        toDate: req.query.to_date,
      });
      return success(res, data);
    } catch (err) { next(err); }
  },

  /**
   * Get drilling performance analytics (ROP trends, depth progression).
   */
  async getDrillingPerformance(req, res, next) {
    try {
      const data = await analyticsService.getDrillingPerformanceAnalytics({
        wellId: req.query.well_id,
      });
      return success(res, data);
    } catch (err) { next(err); }
  },

  /**
   * Run leave-one-well-out backtest.
   */
  async runBacktest(req, res, next) {
    try {
      const backtestService = require('../services/backtest.service');
      const { risk_types, lead_depths } = req.query;
      const opts = {};
      if (risk_types) opts.riskTypes = risk_types.split(',').map((s) => s.trim());
      if (lead_depths) opts.leadDepths = lead_depths.split(',').map(Number);
      const data = await backtestService.run(opts);
      return success(res, data);
    } catch (err) { next(err); }
  },

  /**
   * Get feedback precision breakdown by risk type.
   */
  async getFeedbackPrecision(req, res, next) {
    try {
      const data = await analyticsService.getFeedbackPrecision();
      return success(res, data);
    } catch (err) { next(err); }
  },
};

module.exports = analyticsController;
