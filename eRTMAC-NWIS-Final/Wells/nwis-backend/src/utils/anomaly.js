// =============================================================================
// NWIS Backend — Physics-Based Anomaly Detection Layer
// =============================================================================

/**
 * Mechanical Specific Energy (Teale, 1965) in MPa.
 * MSE = (WOB / Ab) + (120 * pi * RPM * Torque) / (Ab * ROP)
 */
function calculateMSE({ wob_kN, torque_kNm, rop_m_hr, rpm, bit_diameter_in = 8.5 }) {
  const wob = Math.max(0, parseFloat(wob_kN) || 0) * 1000; // N
  const torque = Math.max(0, parseFloat(torque_kNm) || 0) * 1000; // N*m
  const rop = Math.max(0.1, parseFloat(rop_m_hr) || 0.1); // m/hr
  const rpmVal = Math.max(1, parseFloat(rpm) || 1); // rpm
  const bitDiamM = (parseFloat(bit_diameter_in) || 8.5) * 0.0254; // m
  const area = (Math.PI * Math.pow(bitDiamM, 2)) / 4; // m^2

  // Axial component (Pa): WOB / Area
  const axialComponent = wob / area;

  // Rotary component (Pa): (2 * pi * (RPM/60) * Torque) / (Area * (ROP/3600))
  // = (120 * pi * RPM * Torque) / (Area * ROP)
  const rotaryComponent = (120 * Math.PI * rpmVal * torque) / (area * rop);

  const msePa = axialComponent + rotaryComponent;
  return Math.round((msePa / 1e6) * 10) / 10; // Convert to MPa
}

/**
 * Torque baseline deviation using rolling mean and z-score.
 */
function calculateTorqueDeviation(series = []) {
  if (!Array.isArray(series) || series.length < 2) {
    return { mean: 0, std: 0.1, zScore: 0, isAnomaly: false };
  }

  const values = series.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
  if (values.length < 2) {
    return { mean: values[0] || 0, std: 0.1, zScore: 0, isAnomaly: false };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const std = Math.max(Math.sqrt(variance), 0.1);

  const latest = values[values.length - 1];
  const zScore = Math.round(((latest - mean) / std) * 100) / 100;

  return {
    mean: Math.round(mean * 100) / 100,
    std: Math.round(std * 100) / 100,
    zScore,
    isAnomaly: zScore > 2.0,
  };
}

/**
 * Cumulative Sum (CUSUM) on a parameter series for early shift detection.
 * Detects small sustained shifts in ROP or SPP.
 */
function calculateCUSUM(series = [], { k = 0.5, h = 4.0 } = {}) {
  if (!Array.isArray(series) || series.length < 4) {
    return { sPos: 0, sNeg: 0, changeDetected: false };
  }

  const values = series.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
  // Use first half as baseline
  const baselineCount = Math.max(2, Math.floor(values.length / 2));
  const baseline = values.slice(0, baselineCount);
  const mean = baseline.reduce((s, v) => s + v, 0) / baseline.length;
  const variance = baseline.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (baseline.length - 1);
  const std = Math.max(Math.sqrt(variance), 0.05);

  let sPos = 0;
  let sNeg = 0;

  for (let i = baselineCount; i < values.length; i++) {
    const standardized = (values[i] - mean) / std;
    sPos = Math.max(0, sPos + standardized - k);
    sNeg = Math.max(0, sNeg - standardized - k);
  }

  return {
    sPos: Math.round(sPos * 100) / 100,
    sNeg: Math.round(sNeg * 100) / 100,
    changeDetected: sPos > h || sNeg > h,
    direction: sPos > h ? 'upward' : sNeg > h ? 'downward' : 'none',
  };
}

/**
 * d-exponent and corrected d-exponent (dcs) trend.
 */
function calculateDExponent({
  rop_m_hr,
  rpm,
  wob_kN,
  bit_diameter_in = 8.5,
  mud_weight_sg = 1.15,
  normal_mw_sg = 1.07,
}) {
  const rop = Math.max(0.1, parseFloat(rop_m_hr) || 1.0);
  const rpmVal = Math.max(1, parseFloat(rpm) || 60);
  const wob = Math.max(0.5, parseFloat(wob_kN) || 10.0);
  const bitDiam = parseFloat(bit_diameter_in) || 8.5;
  const mw = Math.max(0.8, parseFloat(mud_weight_sg) || 1.15);
  const normMw = parseFloat(normal_mw_sg) || 1.07;

  // Convert to field units (ROP in ft/hr, WOB in klbf)
  const ropFph = rop * 3.28084;
  const wobKlbf = wob * 0.224809;

  const numerator = Math.log10(ropFph / (60 * rpmVal));
  const denominator = Math.log10((12 * wobKlbf) / (1000 * bitDiam));

  let d = 1.0;
  if (denominator !== 0 && !isNaN(numerator) && !isNaN(denominator)) {
    d = numerator / denominator;
  }

  const d_cs = d * (normMw / mw);

  return {
    d: Math.round(d * 1000) / 1000,
    d_cs: Math.round(d_cs * 1000) / 1000,
  };
}

/**
 * Equivalent Circulating Density (ECD) from annular pressure or mud weight.
 */
function calculateECD({ mud_weight_sg, annular_pressure_bar, tvd_m }) {
  const mw = parseFloat(mud_weight_sg) || 1.15;
  const ap = parseFloat(annular_pressure_bar);
  const tvd = parseFloat(tvd_m);

  if (!isNaN(ap) && ap > 0 && !isNaN(tvd) && tvd > 50) {
    // Hydrostatic + friction: ECD = (P_annular_bar * 10.197) / TVD_m
    const ecd = (ap * 10.197) / tvd;
    return Math.round(ecd * 1000) / 1000;
  }

  // Fallback: estimate ECD from mud weight + 0.04 sg typical annular friction
  return Math.round((mw + 0.04) * 1000) / 1000;
}

/**
 * Detect drilling anomalies using risk-specific signatures:
 * - kick: flow-out up + pit gain + total gas
 * - mud_loss: flow-out down + pit loss
 * - stuck_pipe: torque/MSE up + ROP down
 */
function detectPhysicsAnomalies(telemetry = {}, historicalSeries = {}) {
  const results = {
    kick: { detected: false, score: 0, signals: [] },
    mud_loss: { detected: false, score: 0, signals: [] },
    stuck_pipe: { detected: false, score: 0, signals: [] },
    indicators: {},
  };

  const wob = parseFloat(telemetry.wob) || 0;
  const torque = parseFloat(telemetry.torque) || 0;
  const rop = parseFloat(telemetry.rop) || 0;
  const rpm = parseFloat(telemetry.rpm) || 0;
  const spp = parseFloat(telemetry.standpipe_pressure || telemetry.spp) || 0;
  const mw = parseFloat(telemetry.mud_weight) || 1.18;
  const ap = parseFloat(telemetry.annular_pressure);
  const depth = parseFloat(telemetry.depth) || 0;

  const additional = telemetry.additional_parameters || {};
  const flowOutPct = parseFloat(additional.flow_out_pct !== undefined ? additional.flow_out_pct : 100);
  const pitVolumeDelta = parseFloat(additional.pit_volume_delta || 0); // delta in m3/bbl
  const totalGasPct = parseFloat(additional.total_gas_pct || 0);

  // Compute indicators
  const mse = calculateMSE({ wob_kN: wob, torque_kNm: torque, rop_m_hr: rop, rpm });
  const torqueDev = calculateTorqueDeviation(historicalSeries.torque || [torque]);
  const ropCusum = calculateCUSUM(historicalSeries.rop || [rop]);
  const sppCusum = calculateCUSUM(historicalSeries.spp || [spp]);
  const dExp = calculateDExponent({ rop_m_hr: rop, rpm, wob_kN: wob, mud_weight_sg: mw });
  const ecd = calculateECD({ mud_weight_sg: mw, annular_pressure_bar: ap, tvd_m: depth });

  results.indicators = {
    mse,
    torqueZScore: torqueDev.zScore,
    ropCusumTrend: ropCusum.direction,
    sppCusumTrend: sppCusum.direction,
    d_cs: dExp.d_cs,
    ecd,
  };

  // 1. Kick Signature: flow-out up + pit gain + total gas
  const kickSignals = [];
  if (flowOutPct > 115) kickSignals.push(`Flow-out increased to ${flowOutPct}%`);
  if (pitVolumeDelta > 1.0) kickSignals.push(`Pit gain of +${pitVolumeDelta} m³`);
  if (totalGasPct > 1.5) kickSignals.push(`Gas peak at ${totalGasPct}%`);
  if (ropCusum.direction === 'upward') kickSignals.push('Drilling break (sudden ROP increase)');

  if (kickSignals.length >= 2) {
    const score = Math.min(0.95, 0.45 + kickSignals.length * 0.15);
    results.kick = { detected: true, score: Math.round(score * 100) / 100, signals: kickSignals };
  } else if (kickSignals.length === 1) {
    results.kick = { detected: false, score: 0.35, signals: kickSignals };
  }

  // 2. Mud Loss Signature: flow-out down + pit loss
  const lossSignals = [];
  if (flowOutPct < 85) lossSignals.push(`Flow-out dropped to ${flowOutPct}%`);
  if (pitVolumeDelta < -1.0) lossSignals.push(`Pit loss of ${pitVolumeDelta} m³`);
  if (sppCusum.direction === 'downward') lossSignals.push('Standpipe pressure drop (loss of hydrostatic head)');

  if (lossSignals.length >= 2) {
    const score = Math.min(0.95, 0.50 + lossSignals.length * 0.15);
    results.mud_loss = { detected: true, score: Math.round(score * 100) / 100, signals: lossSignals };
  } else if (lossSignals.length === 1) {
    results.mud_loss = { detected: false, score: 0.35, signals: lossSignals };
  }

  // 3. Stuck Pipe Signature: torque/MSE up + ROP down
  const stuckSignals = [];
  if (torqueDev.isAnomaly || torqueDev.zScore > 2.0) stuckSignals.push(`Torque spike (Z=${torqueDev.zScore}σ above baseline)`);
  if (mse > 350) stuckSignals.push(`Mechanical Specific Energy spike (${mse} MPa)`);
  if (ropCusum.direction === 'downward' || rop < 3.0) stuckSignals.push(`ROP decline (${rop} m/hr)`);
  if (sppCusum.direction === 'upward') stuckSignals.push('Standpipe pressure rise (annular restriction)');

  if (stuckSignals.length >= 2) {
    const score = Math.min(0.95, 0.45 + stuckSignals.length * 0.15);
    results.stuck_pipe = { detected: true, score: Math.round(score * 100) / 100, signals: stuckSignals };
  } else if (stuckSignals.length === 1) {
    results.stuck_pipe = { detected: false, score: 0.35, signals: stuckSignals };
  }

  return results;
}

module.exports = {
  calculateMSE,
  calculateTorqueDeviation,
  calculateCUSUM,
  calculateDExponent,
  calculateECD,
  detectPhysicsAnomalies,
};
