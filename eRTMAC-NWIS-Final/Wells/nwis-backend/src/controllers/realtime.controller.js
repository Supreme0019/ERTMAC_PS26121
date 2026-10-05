// =============================================================================
// NWIS Backend — Realtime Controller (SSE & WITSML Adapter)
// =============================================================================

const realtimeService = require('../services/realtime.service');
const alertService = require('../services/alert.service');
const wellRepository = require('../repositories/well.repository');
const dataQualityService = require('../services/dataQuality.service');
const witsmlService = require('../services/witsml.service');
const { success } = require('../utils/response');

const realtimeController = {
  /**
   * SSE endpoint for realtime well updates.
   */
  async stream(req, res) {
    const wellId = req.params.wellId;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial state (from memory or database)
    let state = realtimeService.getState(wellId);
    if (!state) {
      try {
        const latest = await wellRepository.getLatestParameters(wellId);
        const well = await wellRepository.findById(wellId);
        if (latest || well) {
          state = {
            wellId,
            timestamp: latest?.timestamp || new Date().toISOString(),
            depth: parseFloat(latest?.depth) || parseFloat(well?.current_depth) || 0,
            formation: well?.current_formation_name || 'Barail Group',
            wob: parseFloat(latest?.wob) || 16.5,
            rpm: parseFloat(latest?.rpm) || 115,
            torque: parseFloat(latest?.torque) || 21.0,
            rop: parseFloat(latest?.rop) || 10.2,
            mud_weight: parseFloat(latest?.mud_weight) || 1.18,
            mud_flow_rate: parseFloat(latest?.mud_flow_rate) || 2100,
            standpipe_pressure: parseFloat(latest?.standpipe_pressure) || 230,
            annular_pressure: parseFloat(latest?.annular_pressure) || 24,
            hook_load: parseFloat(latest?.hook_load) || 185,
          };
        }
      } catch (err) {
        // fallback ignored
      }
    }

    if (state) {
      res.write(`event: well-update\ndata: ${JSON.stringify(state)}\n\n`);
    }

    // Register client
    alertService.addClient(wellId, res);

    // Keep alive
    const keepAlive = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  },

  /**
   * Get current state (non-SSE).
   */
  async getState(req, res, next) {
    try {
      const wellId = req.params.wellId;
      let state = realtimeService.getState(wellId);
      if (!state) {
        const latest = await wellRepository.getLatestParameters(wellId);
        const well = await wellRepository.findById(wellId);
        if (latest || well) {
          state = {
            wellId,
            timestamp: latest?.timestamp || new Date().toISOString(),
            depth: parseFloat(latest?.depth) || parseFloat(well?.current_depth) || 0,
            formation: well?.current_formation_name || 'Barail Group',
            wob: parseFloat(latest?.wob) || 16.5,
            rpm: parseFloat(latest?.rpm) || 115,
            torque: parseFloat(latest?.torque) || 21.0,
            rop: parseFloat(latest?.rop) || 10.2,
            mud_weight: parseFloat(latest?.mud_weight) || 1.18,
            mud_flow_rate: parseFloat(latest?.mud_flow_rate) || 2100,
            standpipe_pressure: parseFloat(latest?.standpipe_pressure) || 230,
            annular_pressure: parseFloat(latest?.annular_pressure) || 24,
            hook_load: parseFloat(latest?.hook_load) || 185,
          };
        }
      }
      return success(res, { state });
    } catch (err) { next(err); }
  },

  /**
   * Push a data point through the Data Quality Gate.
   */
  async pushData(req, res, next) {
    try {
      const wellId = req.params.wellId;

      // Quality gate validation
      const qCheck = dataQualityService.validateRecord(wellId, req.body);
      if (qCheck.rejected) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'DATA_QUALITY_REJECTION',
            message: qCheck.rejectionReason,
            flags: qCheck.flags,
            channelQuality: qCheck.channelQuality,
          },
        });
      }

      const state = await realtimeService.updateState(wellId, qCheck.sanitizedData);
      await realtimeService.checkRiskTriggers(wellId, state.depth);
      return success(res, { state, qualityFlags: qCheck.flags, channelQuality: qCheck.channelQuality });
    } catch (err) { next(err); }
  },

  /**
   * Ingest WITSML 1.4 XML log document through the Data Quality Gate.
   */
  async uploadWitsml(req, res, next) {
    try {
      const wellId = req.params.wellId;
      let xmlContent = '';

      if (typeof req.body === 'string' && req.body.trim().startsWith('<')) {
        xmlContent = req.body;
      } else if (req.body?.xml) {
        xmlContent = req.body.xml;
      } else if (req.file?.buffer) {
        xmlContent = req.file.buffer.toString('utf8');
      } else if (req.body?.content) {
        xmlContent = req.body.content;
      }

      // Default demo fallback: read bundled sample-witsml-log.xml if empty
      if (!xmlContent || xmlContent.trim().length === 0) {
        const fs = require('fs');
        const path = require('path');
        xmlContent = fs.readFileSync(path.join(__dirname, '../../sample-witsml-log.xml'), 'utf8');
      }

      const result = await witsmlService.processWitsmlLog(wellId, xmlContent);
      return success(res, result, 'WITSML 1.4 log processed through Data Quality Gate');
    } catch (err) { next(err); }
  },
};

module.exports = realtimeController;
