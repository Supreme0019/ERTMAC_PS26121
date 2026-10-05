// =============================================================================
// NWIS Backend — Analytics Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { analyticsQuerySchema } = require('../validators/analytics.validator');

router.get('/events', optionalAuth, validate({ query: analyticsQuerySchema }), analyticsController.getEvents);
router.get('/formations', optionalAuth, validate({ query: analyticsQuerySchema }), analyticsController.getFormations);
router.get('/risks', optionalAuth, validate({ query: analyticsQuerySchema }), analyticsController.getRisks);
router.get('/alerts', optionalAuth, validate({ query: analyticsQuerySchema }), analyticsController.getAlerts);
router.get('/npt', optionalAuth, validate({ query: analyticsQuerySchema }), analyticsController.getNPT);
router.get('/drilling-performance', optionalAuth, validate({ query: analyticsQuerySchema }), analyticsController.getDrillingPerformance);
router.get('/backtest', optionalAuth, analyticsController.runBacktest);
router.get('/feedback-precision', optionalAuth, analyticsController.getFeedbackPrecision);

module.exports = router;
