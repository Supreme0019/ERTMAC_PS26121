// =============================================================================
// NWIS Backend — Audit Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

// Audit trail queries (restricted to DATA_ADMIN / SYSTEM_ADMIN)
router.get('/', authenticate, requireAdmin, auditController.getLogs);

module.exports = router;
