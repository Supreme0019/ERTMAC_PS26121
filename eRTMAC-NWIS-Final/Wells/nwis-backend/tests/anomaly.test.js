// =============================================================================
// Unit Tests: Physics-based Anomaly Layer (node --test)
// =============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateMSE,
  calculateTorqueDeviation,
  calculateCUSUM,
  calculateDExponent,
  calculateECD,
  detectPhysicsAnomalies,
} = require('../src/utils/anomaly');

test('calculateMSE computes realistic mechanical specific energy', () => {
  const mse = calculateMSE({
    wob_kN: 120,
    torque_kNm: 18,
    rop_m_hr: 12,
    rpm: 110,
    bit_diameter_in: 8.5,
  });

  assert.ok(typeof mse === 'number', 'MSE must be a number');
  assert.ok(mse > 50 && mse < 2500, `Expected realistic MSE between 50 and 2500 MPa, got ${mse}`);
});

test('calculateTorqueDeviation flags sudden torque spike', () => {
  const normalSeries = [18.2, 18.5, 18.1, 18.4, 18.3, 18.6, 18.2];
  const baselineResult = calculateTorqueDeviation(normalSeries);
  assert.equal(baselineResult.isAnomaly, false, 'Baseline series should not be an anomaly');

  const spikeSeries = [...normalSeries, 28.5]; // Sudden +10 kNm spike
  const spikeResult = calculateTorqueDeviation(spikeSeries);
  assert.equal(spikeResult.isAnomaly, true, 'Spike series must be flagged as anomaly');
  assert.ok(spikeResult.zScore > 2.0, `zScore must be > 2.0, got ${spikeResult.zScore}`);
});

test('calculateCUSUM detects shift in ROP trend', () => {
  // Baseline ROP ~10 m/hr, then sudden drop to 2 m/hr
  const ropSeries = [10.1, 10.2, 9.9, 10.0, 10.3, 2.5, 2.1, 1.8, 1.9];
  const cusum = calculateCUSUM(ropSeries, { k: 0.5, h: 3.0 });

  assert.equal(cusum.changeDetected, true, 'CUSUM must detect sustained drop');
  assert.equal(cusum.direction, 'downward', 'Direction must be downward');
});

test('calculateDExponent computes valid d and dcs', () => {
  const res = calculateDExponent({
    rop_m_hr: 15,
    rpm: 100,
    wob_kN: 130,
    bit_diameter_in: 8.5,
    mud_weight_sg: 1.20,
    normal_mw_sg: 1.07,
  });

  assert.ok(res.d > 0.5 && res.d < 2.5, `d-exponent should be in physical range, got ${res.d}`);
  assert.ok(res.d_cs > 0, `d_cs must be positive, got ${res.d_cs}`);
});

test('calculateECD derives circulating density accurately', () => {
  // 350 bar annular pressure at 3000 m TVD
  const ecd = calculateECD({
    mud_weight_sg: 1.15,
    annular_pressure_bar: 350,
    tvd_m: 3000,
  });

  assert.ok(ecd > 1.0 && ecd < 1.4, `ECD should be physically realistic ~1.19, got ${ecd}`);
});

test('detectPhysicsAnomalies flags kick signature (flow-out up + pit gain + gas)', () => {
  const telemetry = {
    wob: 110,
    torque: 18,
    rop: 15,
    rpm: 100,
    standpipe_pressure: 210,
    mud_weight: 1.15,
    additional_parameters: {
      flow_out_pct: 130,
      pit_volume_delta: 2.5,
      total_gas_pct: 3.2,
    },
  };

  const anomalies = detectPhysicsAnomalies(telemetry);
  assert.equal(anomalies.kick.detected, true, 'Kick signature must be detected');
  assert.ok(anomalies.kick.score >= 0.7, `Kick score must be high, got ${anomalies.kick.score}`);
  assert.ok(anomalies.kick.signals.length >= 2, 'Must cite contributing signals');
});

test('detectPhysicsAnomalies flags stuck pipe signature (torque spike + ROP drop)', () => {
  const telemetry = {
    wob: 140,
    torque: 32, // high torque
    rop: 1.5,   // very low ROP
    rpm: 80,
    standpipe_pressure: 260,
    mud_weight: 1.20,
    additional_parameters: {
      flow_out_pct: 100,
      pit_volume_delta: 0,
      total_gas_pct: 0.3,
    },
  };

  const historicalSeries = {
    torque: [17, 18, 17.5, 18.2, 17.8, 32], // sharp spike
    rop: [12, 11, 12.5, 10, 8, 1.5],        // sharp drop
  };

  const anomalies = detectPhysicsAnomalies(telemetry, historicalSeries);
  assert.equal(anomalies.stuck_pipe.detected, true, 'Stuck pipe signature must be detected');
  assert.ok(anomalies.stuck_pipe.score >= 0.6, `Stuck pipe score must be high, got ${anomalies.stuck_pipe.score}`);
});

test('detectPhysicsAnomalies flags mud loss signature (flow-out down + pit loss)', () => {
  const telemetry = {
    wob: 110,
    torque: 18,
    rop: 12,
    rpm: 100,
    standpipe_pressure: 190,
    mud_weight: 1.15,
    additional_parameters: {
      flow_out_pct: 65,         // flow out down
      pit_volume_delta: -3.5,   // pit volume loss
    },
  };

  const anomalies = detectPhysicsAnomalies(telemetry);
  assert.equal(anomalies.mud_loss.detected, true, 'Mud loss signature must be detected');
  assert.ok(anomalies.mud_loss.score >= 0.7, `Mud loss score must be >= 0.7, got ${anomalies.mud_loss.score}`);
  assert.ok(anomalies.mud_loss.signals.some((s) => s.includes('Flow-out dropped')), 'Signals must report flow-out drop');
  assert.ok(anomalies.mud_loss.signals.some((s) => s.includes('Pit loss')), 'Signals must report pit loss');
});

test('detectPhysicsAnomalies returns zero/nominal when drilling normally', () => {
  const telemetry = {
    wob: 60,
    torque: 4,
    rop: 25,
    rpm: 80,
    standpipe_pressure: 180,
    mud_weight: 1.15,
    additional_parameters: {
      flow_out_pct: 100,
      pit_volume_delta: 0,
      total_gas_pct: 0.2,
    },
  };

  const anomalies = detectPhysicsAnomalies(telemetry);
  assert.equal(anomalies.kick.detected, false);
  assert.equal(anomalies.mud_loss.detected, false);
  assert.equal(anomalies.stuck_pipe.detected, false);
  assert.strictEqual(anomalies.kick.score, 0);
  assert.strictEqual(anomalies.mud_loss.score, 0);
  assert.strictEqual(anomalies.stuck_pipe.score, 0);
});

