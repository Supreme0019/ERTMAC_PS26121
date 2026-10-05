// =============================================================================
// NWIS Backend — WITSML 1.4 Ingestion Adapter
// =============================================================================
// File-based ingestion adapter for WITSML 1.4 log documents.
// NOTE: This is a file-based demonstration adapter, NOT a live eRTMAC link.
// =============================================================================

const { convert } = require('../utils/units');
const dataQualityService = require('./dataQuality.service');
const realtimeService = require('./realtime.service');
const logger = require('../utils/logger');

// Mnemonic Mapping Table (WITSML standard mnemonics -> NWIS canonical channels)
const MNEMONIC_MAP = {
  // Depth
  DMEA: { field: 'depth', targetUnit: 'm' },
  MD: { field: 'depth', targetUnit: 'm' },
  DEPTH: { field: 'depth', targetUnit: 'm' },
  DEPT: { field: 'depth', targetUnit: 'm' },

  // Weight on Bit
  WOB: { field: 'wob', targetUnit: 'kN' },
  SWOB: { field: 'wob', targetUnit: 'kN' },
  WOBA: { field: 'wob', targetUnit: 'kN' },

  // Rotary Speed
  RPM: { field: 'rpm', targetUnit: 'rpm' },
  SRPM: { field: 'rpm', targetUnit: 'rpm' },
  RPM_SURF: { field: 'rpm', targetUnit: 'rpm' },

  // Torque
  TORQ: { field: 'torque', targetUnit: 'kN*m' },
  STOR: { field: 'torque', targetUnit: 'kN*m' },
  TORQUE: { field: 'torque', targetUnit: 'kN*m' },

  // Rate of Penetration
  ROP: { field: 'rop', targetUnit: 'm/hr' },
  ROPA: { field: 'rop', targetUnit: 'm/hr' },
  ROP5: { field: 'rop', targetUnit: 'm/hr' },

  // Standpipe Pressure
  SPP: { field: 'standpipe_pressure', targetUnit: 'bar' },
  SPPA: { field: 'standpipe_pressure', targetUnit: 'bar' },
  PUMP: { field: 'standpipe_pressure', targetUnit: 'bar' },

  // Mud Weight
  MWIN: { field: 'mud_weight', targetUnit: 'sg' },
  MWO: { field: 'mud_weight', targetUnit: 'sg' },
  MUDWT: { field: 'mud_weight', targetUnit: 'sg' },

  // Flow Rate
  FLOW: { field: 'mud_flow_rate', targetUnit: 'L/min' },
  TFLO: { field: 'mud_flow_rate', targetUnit: 'L/min' },
  FLOWIN: { field: 'mud_flow_rate', targetUnit: 'L/min' },

  // Hook Load
  HKLD: { field: 'hook_load', targetUnit: 'kN' },
  HOOKLOAD: { field: 'hook_load', targetUnit: 'kN' },

  // Annular Pressure
  ANNP: { field: 'annular_pressure', targetUnit: 'bar' },
  APR: { field: 'annular_pressure', targetUnit: 'bar' },
  ECD: { field: 'annular_pressure', targetUnit: 'bar' },

  // Additional Gas & Pit Channels
  PVOL: { field: 'pit_volume', targetUnit: 'm3' },
  TGAS: { field: 'total_gas', targetUnit: '%' },
};

const witsmlService = {
  /**
   * Parse WITSML 1.4 XML content into canonical channel records.
   *
   * @param {string} xmlString
   * @returns {{ curves: Array<{ mnemonic: string, unit: string, field: string }>, dataLines: string[] }}
   */
  parseXml(xmlString) {
    const curves = [];
    const curveInfoRegex = /<logCurveInfo[^>]*>([\s\S]*?)<\/logCurveInfo>/gi;
    let match;

    while ((match = curveInfoRegex.exec(xmlString)) !== null) {
      const block = match[1];
      const mnemonicMatch = /<mnemonic[^>]*>([^<]+)<\/mnemonic>/i.exec(block);
      const unitMatch = /<unit[^>]*>([^<]+)<\/unit>/i.exec(block);
      const descMatch = /<curveDescription[^>]*>([^<]+)<\/curveDescription>/i.exec(block);

      const mnemonic = mnemonicMatch ? mnemonicMatch[1].trim().toUpperCase() : 'UNKNOWN';
      const unit = unitMatch ? unitMatch[1].trim() : '';
      const desc = descMatch ? descMatch[1].trim() : '';

      const mapping = MNEMONIC_MAP[mnemonic] || { field: mnemonic.toLowerCase(), targetUnit: unit };

      curves.push({
        mnemonic,
        sourceUnit: unit,
        field: mapping.field,
        targetUnit: mapping.targetUnit,
        description: desc,
      });
    }

    // Extract data rows
    const dataRegex = /<data[^>]*>([\s\S]*?)<\/data>/gi;
    const dataLines = [];
    while ((match = dataRegex.exec(xmlString)) !== null) {
      const lines = match[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      dataLines.push(...lines);
    }

    return { curves, dataLines };
  },

  /**
   * Process a WITSML 1.4 file through the data quality gate and update realtime state.
   *
   * @param {string} wellId
   * @param {string} xmlContent
   * @returns {Promise<object>}
   */
  async processWitsmlLog(wellId, xmlContent) {
    const { curves, dataLines } = this.parseXml(xmlContent);

    if (curves.length === 0 || dataLines.length === 0) {
      throw Object.assign(new Error('Invalid WITSML 1.4 document: no curves or data lines found'), {
        code: 'WITSML_PARSE_ERROR',
        status: 400,
      });
    }

    const validRecords = [];
    const rejectedRecords = [];
    const channelSummary = {};

    curves.forEach((c) => {
      channelSummary[c.field] = {
        mnemonic: c.mnemonic,
        sourceUnit: c.sourceUnit,
        targetUnit: c.targetUnit,
        status: 'good',
        sampleCount: 0,
      };
    });

    for (let rowIndex = 0; rowIndex < dataLines.length; rowIndex++) {
      const tokens = dataLines[rowIndex].split(',').map((t) => t.trim());
      const rawRecord = {};
      const additional = {};

      curves.forEach((curve, colIdx) => {
        if (colIdx >= tokens.length) return;
        const rawVal = parseFloat(tokens[colIdx]);
        if (!isNaN(rawVal)) {
          const convertedVal = convert(rawVal, curve.sourceUnit, curve.targetUnit);
          if (['pit_volume', 'total_gas'].includes(curve.field)) {
            additional[curve.field] = convertedVal;
          } else {
            rawRecord[curve.field] = convertedVal;
          }
        }
      });

      rawRecord.additional_parameters = additional;
      rawRecord.timestamp = new Date(Date.now() + rowIndex * 1000).toISOString();

      // Pass through Data Quality Gate
      const qResult = dataQualityService.validateRecord(wellId, rawRecord);

      // Track channel quality
      for (const [ch, q] of Object.entries(qResult.channelQuality)) {
        if (channelSummary[ch]) {
          if (q === 'bad') channelSummary[ch].status = 'bad';
          else if (q === 'suspect' && channelSummary[ch].status === 'good') channelSummary[ch].status = 'suspect';
          channelSummary[ch].sampleCount += 1;
        }
      }

      if (qResult.valid) {
        validRecords.push(rawRecord);
        // Push valid record to live view & database
        await realtimeService.updateState(wellId, rawRecord);
      } else {
        rejectedRecords.push({
          row: rowIndex + 1,
          rawLine: dataLines[rowIndex],
          rejectionReason: qResult.rejectionReason,
          flags: qResult.flags,
        });
      }
    }

    // Trigger risk evaluation at the final depth of the valid stream
    let latestState = null;
    if (validRecords.length > 0) {
      const finalDepth = validRecords[validRecords.length - 1].depth;
      await realtimeService.checkRiskTriggers(wellId, finalDepth);
      latestState = realtimeService.getState(wellId);
    }

    logger.info(
      { wellId, total: dataLines.length, valid: validRecords.length, rejected: rejectedRecords.length },
      'WITSML log ingested through data quality gate'
    );

    return {
      adapter: 'File-based WITSML 1.4 Adapter (Demonstration Mode — not a live eRTMAC link)',
      totalRows: dataLines.length,
      validCount: validRecords.length,
      rejectedCount: rejectedRecords.length,
      rejectedRecords,
      channels: Object.values(channelSummary),
      latestState,
    };
  },
};

module.exports = witsmlService;
