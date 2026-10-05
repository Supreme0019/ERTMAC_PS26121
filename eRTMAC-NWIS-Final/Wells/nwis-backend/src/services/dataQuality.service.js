// =============================================================================
// NWIS Backend — Telemetry Data Quality Gate
// =============================================================================
// Real-time quality verification for telemetry streams & WITSML log records:
// 1. Physical range checks
// 2. Spike detection
// 3. Sensor flatline detection
// 4. Depth-regression rejection
// 5. Timestamp monotonicity
// =============================================================================

const RANGE_LIMITS = {
  depth: { min: 0, max: 10000, name: 'Depth (m)' },
  wob: { min: 0, max: 500, name: 'WOB (kN)' },
  rpm: { min: 0, max: 350, name: 'RPM' },
  torque: { min: 0, max: 80, name: 'Torque (kN·m)' },
  rop: { min: 0, max: 150, name: 'ROP (m/hr)' },
  mud_weight: { min: 0.8, max: 2.5, name: 'Mud Weight (sg)' },
  mud_flow_rate: { min: 0, max: 5000, name: 'Flow Rate (L/min)' },
  standpipe_pressure: { min: 0, max: 500, name: 'SPP (bar)' },
  annular_pressure: { min: 0, max: 300, name: 'Annular Pressure (bar)' },
  hook_load: { min: 0, max: 3500, name: 'Hook Load (kN)' },
};

// In-memory well stream tracking
const wellStreamState = new Map(); // wellId -> { lastDepth, lastTimestamp, rolling: Map<channel, number[]>, flatlines: Map<channel, { value, count }> }

function getWellState(wellId) {
  if (!wellStreamState.has(wellId)) {
    wellStreamState.set(wellId, {
      lastDepth: null,
      lastTimestamp: null,
      rolling: new Map(),
      flatlines: new Map(),
    });
  }
  return wellStreamState.get(wellId);
}

const dataQualityService = {
  /**
   * Validate a single telemetry record through the quality gate.
   *
   * @param {string} wellId
   * @param {object} record
   * @returns {{ valid: boolean, rejected: boolean, rejectionReason: string|null, flags: string[], channelQuality: object, sanitizedData: object }}
   */
  validateRecord(wellId, record) {
    const state = getWellState(wellId);
    const flags = [];
    const channelQuality = {};
    let rejected = false;
    let rejectionReason = null;

    const depth = parseFloat(record.depth);
    const timestampStr = record.timestamp || new Date().toISOString();
    const timestamp = new Date(timestampStr).getTime();

    // ── 1. Depth-regression rejection ──────────────────────────────────────
    if (!isNaN(depth)) {
      if (state.lastDepth !== null && depth < state.lastDepth - 0.05) {
        flags.push(`DEPTH_REGRESSION: ${depth}m < ${state.lastDepth}m`);
        rejected = true;
        rejectionReason = `Depth regression detected: received ${depth}m after ${state.lastDepth}m`;
        channelQuality.depth = 'bad';
      } else {
        channelQuality.depth = 'good';
        state.lastDepth = depth;
      }
    }

    // ── 2. Timestamp monotonicity check ───────────────────────────────────
    if (!isNaN(timestamp)) {
      if (state.lastTimestamp !== null && timestamp < state.lastTimestamp) {
        flags.push(`TIMESTAMP_NON_MONOTONIC: received older timestamp ${timestampStr}`);
        channelQuality.timestamp = 'suspect';
      } else {
        channelQuality.timestamp = 'good';
        state.lastTimestamp = timestamp;
      }
    }

    const sanitizedData = { ...record };

    // ── 3. Physical range checks & Spike/Flatline checks per channel ───────
    for (const [channel, limits] of Object.entries(RANGE_LIMITS)) {
      if (record[channel] === undefined || record[channel] === null) continue;
      const val = parseFloat(record[channel]);
      if (isNaN(val)) continue;

      let quality = 'good';

      // Range check
      if (val < limits.min || val > limits.max) {
        flags.push(`${channel.toUpperCase()}_OUT_OF_RANGE: ${val} outside [${limits.min}, ${limits.max}]`);
        quality = 'bad';
        // If critical parameter is severely out of range (e.g. negative WOB / massive spike), reject row
        if (channel === 'wob' && val < 0) {
          rejected = true;
          rejectionReason = `Negative ${limits.name} value: ${val}`;
        }
      }

      // Flatline check
      if (!state.flatlines.has(channel)) {
        state.flatlines.set(channel, { value: val, count: 1 });
      } else {
        const flat = state.flatlines.get(channel);
        if (Math.abs(flat.value - val) < 0.0001 && val !== 0) {
          flat.count += 1;
          if (flat.count >= 15) {
            flags.push(`${channel.toUpperCase()}_FLATLINE: ${val} frozen for ${flat.count} consecutive samples`);
            quality = 'suspect';
          }
        } else {
          state.flatlines.set(channel, { value: val, count: 1 });
        }
      }

      // Spike detection (rolling baseline comparison)
      if (!state.rolling.has(channel)) {
        state.rolling.set(channel, []);
      }
      const rolling = state.rolling.get(channel);
      if (rolling.length >= 5) {
        const mean = rolling.reduce((s, v) => s + v, 0) / rolling.length;
        const diffs = rolling.slice(1).map((v, i) => Math.abs(v - rolling[i]));
        const avgDiff = Math.max(diffs.reduce((s, v) => s + v, 0) / diffs.length, 0.1);

        if (Math.abs(val - mean) > 3.5 * avgDiff && Math.abs(val - mean) > 5) {
          flags.push(`${channel.toUpperCase()}_SPIKE: ${val} spikes from baseline ${mean.toFixed(1)}`);
          if (quality === 'good') quality = 'suspect';
        }
      }
      rolling.push(val);
      if (rolling.length > 20) rolling.shift();

      channelQuality[channel] = quality;
    }

    return {
      valid: !rejected,
      rejected,
      rejectionReason,
      flags,
      channelQuality,
      sanitizedData,
    };
  },

  /**
   * Reset tracking state for a well (e.g. on new replay start).
   */
  resetWellState(wellId) {
    wellStreamState.delete(wellId);
  },
};

module.exports = dataQualityService;
