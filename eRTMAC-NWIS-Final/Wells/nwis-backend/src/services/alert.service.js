// =============================================================================
// NWIS Backend — Alert Service (v2 with Hysteresis & Deduplication)
// =============================================================================
// Creates, delivers, and manages alerts based on risk predictions.
// Alerts follow lifecycle: GENERATED → DELIVERED → VIEWED → ACKNOWLEDGED → RESOLVED
// =============================================================================

const alertRepository = require('../repositories/alert.repository');
const riskRepository = require('../repositories/risk.repository');
const wellRepository = require('../repositories/well.repository');
const auditService = require('./audit.service');
const logger = require('../utils/logger');

// In-memory SSE clients (for realtime broadcast)
const sseClients = new Map(); // wellId → Set<Response>

const alertService = {
  /**
   * Upsert alert from risk prediction with hysteresis and deduplication:
   * - Dedupe key: well_id:risk_type:floor(depth/25)
   * - Raise at score >= 0.5
   * - Clear (auto-resolve) below 0.4
   * - Escalate severity only when score rises >= 0.15
   */
  async upsertFromRisk(riskPrediction, parameterSnapshot = null) {
    const wellId = riskPrediction.well_id;
    const riskType = riskPrediction.risk_type;
    const depth = parseFloat(riskPrediction.depth || 0);
    const score = parseFloat(riskPrediction.score || 0);
    const depthBucket = Math.floor(depth / 25);
    const dedupeKey = `${wellId}:${riskType}:${depthBucket}`;

    // Look for existing open alert for this well/risk_type/depth_bucket
    const existing = await alertRepository.findOpenByDedupeKey(dedupeKey);

    const thresholds = {
      raise_threshold: 0.5,
      clear_threshold: 0.4,
      escalation_delta: 0.15,
    };

    if (!existing) {
      // Cooldown / hysteresis: only raise alert if score >= 0.5
      if (score < 0.5) {
        return null;
      }

      // Fetch snapshot if not supplied
      let snapshot = parameterSnapshot;
      if (!snapshot) {
        try {
          const latestParam = await wellRepository.getLatestParameters(wellId);
          if (latestParam) {
            snapshot = {
              depth: parseFloat(latestParam.depth),
              wob: parseFloat(latestParam.wob),
              rpm: parseFloat(latestParam.rpm),
              torque: parseFloat(latestParam.torque),
              rop: parseFloat(latestParam.rop),
              mud_weight: parseFloat(latestParam.mud_weight),
              standpipe_pressure: parseFloat(latestParam.standpipe_pressure),
              annular_pressure: parseFloat(latestParam.annular_pressure),
              hook_load: parseFloat(latestParam.hook_load),
              timestamp: latestParam.timestamp,
              additional_parameters: latestParam.additional_parameters,
            };
          }
        } catch (e) {
          logger.warn({ err: e.message }, 'Failed to fetch snapshot for alert');
        }
      }

      // Determine initial severity based on score
      const severity = score >= 0.7 ? 'critical' : (riskPrediction.risk_level || (score >= 0.5 ? 'high' : 'medium'));

      const alert = await alertRepository.create({
        well_id: wellId,
        risk_prediction_id: riskPrediction.id || null,
        risk_type: riskType,
        severity,
        message: riskPrediction.explanation || riskPrediction.message || `${riskType} detected at ${depth}m`,
        evidence_refs: riskPrediction.evidence_refs || [],
        dedupe_key: dedupeKey,
        score,
        occurrence_count: 1,
        first_seen_depth: depth,
        last_seen_depth: depth,
        parameter_snapshot: snapshot || {},
        thresholds,
      });

      logger.info({ alertId: alert.id, wellId, dedupeKey, score, severity }, 'Alert created via upsertFromRisk');
      this.broadcast(wellId, 'alert', alert);
      return alert;
    }

    // Existing alert is open!
    // Hysteresis rule: clear below 0.4
    if (score < 0.4) {
      const resolved = await alertRepository.autoResolveAlert(existing.id, {
        last_seen_depth: depth,
        score,
        reason: 'Auto-cleared: risk score dropped below 0.4 hysteresis threshold',
      });
      logger.info({ alertId: existing.id, score }, 'Alert auto-cleared below hysteresis threshold');
      this.broadcast(wellId, 'alert-resolved', { id: existing.id, reason: 'auto_cleared' });
      return resolved;
    }

    // Check escalation: escalate severity only when score rises >= 0.15
    const existingScore = parseFloat(existing.score || 0.5);
    let newSeverity = existing.severity;
    if (score >= existingScore + 0.15) {
      if (existing.severity === 'medium') newSeverity = 'high';
      else if (existing.severity === 'high') newSeverity = 'critical';
    }

    const updated = await alertRepository.updateExistingAlert(existing.id, {
      occurrence_count: (parseInt(existing.occurrence_count, 10) || 1) + 1,
      last_seen_depth: depth,
      score: Math.max(existingScore, score),
      severity: newSeverity,
      risk_prediction_id: riskPrediction.id || existing.risk_prediction_id,
      evidence_refs: (riskPrediction.evidence_refs && riskPrediction.evidence_refs.length > 0) ? riskPrediction.evidence_refs : existing.evidence_refs,
      parameter_snapshot: parameterSnapshot || existing.parameter_snapshot,
      message: riskPrediction.explanation || existing.message,
    });

    logger.debug({ alertId: existing.id, dedupeKey, score, occurrence_count: updated.occurrence_count }, 'Alert updated via dedupe');
    this.broadcast(wellId, 'alert-updated', updated);
    return updated;
  },

  /**
   * Create an alert from a risk prediction (legacy compatibility).
   */
  async createFromRisk(riskPrediction) {
    return this.upsertFromRisk(riskPrediction);
  },

  /**
   * Create an alert directly.
   */
  async create(alertData) {
    const alert = await alertRepository.create(alertData);
    logger.info({ alertId: alert.id }, 'Alert created directly');
    this.broadcast(alertData.well_id, 'alert', alert);
    return alert;
  },

  /**
   * Get alerts for a well.
   */
  async getAlerts(wellId, filters) {
    return await alertRepository.findByWell(wellId, filters);
  },

  /**
   * Get a single alert.
   */
  async getAlert(id) {
    const alert = await alertRepository.findById(id);
    if (!alert) {
      throw Object.assign(new Error('Alert not found'), { code: 'ALERT_NOT_FOUND', status: 404 });
    }

    // Mark as viewed if currently delivered
    if (alert.status === 'delivered') {
      await alertRepository.updateStatus(id, 'viewed');
    }

    return alert;
  },

  /**
   * Acknowledge an alert with audit logging.
   */
  async acknowledge(id, userId, req = null) {
    const oldAlert = await alertRepository.findById(id);
    if (!oldAlert) {
      throw Object.assign(new Error('Alert not found'), { code: 'ALERT_NOT_FOUND', status: 404 });
    }
    const alert = await alertRepository.acknowledge(id, userId);
    if (alert) {
      await auditService.log({
        userId,
        action: 'ALERT_ACKNOWLEDGE',
        resourceType: 'alert',
        resourceId: id,
        oldData: { status: oldAlert.status, acknowledged_by: oldAlert.acknowledged_by },
        newData: { status: 'acknowledged', acknowledged_by: userId },
        req,
      });
      logger.info({ alertId: id, userId }, 'Alert acknowledged');
      this.broadcast(alert.well_id, 'alert-acknowledged', { id, acknowledged_by: userId });
    }
    return alert;
  },

  /**
   * Resolve an alert with audit logging.
   */
  async resolve(id, userId = null, req = null) {
    const oldAlert = await alertRepository.findById(id);
    if (!oldAlert) {
      throw Object.assign(new Error('Alert not found'), { code: 'ALERT_NOT_FOUND', status: 404 });
    }
    const alert = await alertRepository.resolve(id);
    if (alert) {
      await auditService.log({
        userId: userId || req?.user?.id,
        action: 'ALERT_RESOLVE',
        resourceType: 'alert',
        resourceId: id,
        oldData: { status: oldAlert.status, resolved_at: oldAlert.resolved_at },
        newData: { status: 'resolved', resolved_at: alert.resolved_at },
        req,
      });
      logger.info({ alertId: id }, 'Alert resolved');
      this.broadcast(alert.well_id, 'alert-resolved', { id });
    }
    return alert;
  },

  /**
   * Record feedback (true_positive / false_positive) with audit logging.
   */
  async recordFeedback(id, feedback, userId, req = null) {
    const oldAlert = await alertRepository.findById(id);
    if (!oldAlert) {
      throw Object.assign(new Error('Alert not found'), { code: 'ALERT_NOT_FOUND', status: 404 });
    }
    const alert = await alertRepository.updateFeedback(id, feedback, userId);
    await auditService.log({
      userId,
      action: 'ALERT_FEEDBACK',
      resourceType: 'alert',
      resourceId: id,
      oldData: { feedback: oldAlert.feedback, feedback_by: oldAlert.feedback_by },
      newData: { feedback, feedback_by: userId },
      req,
    });
    logger.info({ alertId: id, feedback, userId }, 'Alert feedback recorded');
    this.broadcast(alert.well_id, 'alert-updated', alert);
    return alert;
  },

  /**
   * Get unresolved alert count.
   */
  async getUnresolvedCount(wellId) {
    return await alertRepository.getUnresolvedCount(wellId);
  },

  // ── SSE Client Management ──────────────────────────────────────────────

  /**
   * Register an SSE client for a well.
   */
  addClient(wellId, res) {
    if (!sseClients.has(wellId)) {
      sseClients.set(wellId, new Set());
    }
    sseClients.get(wellId).add(res);

    res.on('close', () => {
      sseClients.get(wellId)?.delete(res);
      if (sseClients.get(wellId)?.size === 0) {
        sseClients.delete(wellId);
      }
    });
  },

  /**
   * Broadcast an event to all SSE clients watching a well.
   */
  broadcast(wellId, event, data) {
    const clients = sseClients.get(wellId);
    if (!clients || clients.size === 0) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of clients) {
      try {
        client.write(message);
      } catch (err) {
        logger.warn({ err: err.message }, 'SSE write failed, removing client');
        clients.delete(client);
      }
    }
  },

  /**
   * Get count of connected SSE clients for a well.
   */
  getClientCount(wellId) {
    return sseClients.get(wellId)?.size || 0;
  },
};

module.exports = alertService;
