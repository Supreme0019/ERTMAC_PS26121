// =============================================================================
// Unit Tests: Drilling Unit Conversion Utilities (node --test)
// =============================================================================

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  convert,
  klbfToKn,
  knToKlbf,
  ppgToSg,
  sgToPpg,
  psiToBar,
  barToPsi,
  gpmToLmin,
  lminToGpm,
  ftToM,
  mToFt,
} = require('../src/utils/units');

describe('Drilling Unit Conversion Functions', () => {
  test('Force conversions (klbf <-> kN)', () => {
    // 1 klbf = 4.44822 kN
    assert.ok(Math.abs(klbfToKn(1) - 4.44822) < 1e-4);
    assert.ok(Math.abs(knToKlbf(4.44822) - 1.0) < 1e-4);
    // Round-trip
    const original = 25.5;
    assert.ok(Math.abs(knToKlbf(klbfToKn(original)) - original) < 1e-4);
  });

  test('Density conversions (ppg <-> sg / g/cm3)', () => {
    // 10 ppg = ~1.19826 sg
    assert.ok(Math.abs(ppgToSg(10) - 1.19826) < 1e-4);
    assert.ok(Math.abs(sgToPpg(1.19826) - 10.0) < 1e-4);
    // Water ~8.34 ppg = 1.0 sg
    assert.ok(Math.abs(ppgToSg(8.3454) - 1.0) < 1e-3);
  });

  test('Pressure conversions (psi <-> bar)', () => {
    // 1000 psi = 68.9476 bar
    assert.ok(Math.abs(psiToBar(1000) - 68.9476) < 1e-3);
    assert.ok(Math.abs(barToPsi(68.9476) - 1000) < 1e-3);
    // Atmospheric / low pressure
    assert.ok(Math.abs(psiToBar(14.5038) - 1.0) < 1e-3);
  });

  test('Flow rate conversions (gpm <-> L/min)', () => {
    // 100 gpm = 378.541 L/min
    assert.ok(Math.abs(gpmToLmin(100) - 378.541) < 1e-3);
    assert.ok(Math.abs(lminToGpm(378.541) - 100) < 1e-3);
  });

  test('Depth and length conversions (ft <-> m)', () => {
    // 1000 ft = 304.8 m
    assert.ok(Math.abs(ftToM(1000) - 304.8) < 1e-4);
    assert.ok(Math.abs(mToFt(304.8) - 1000) < 1e-4);
  });

  test('convert() general dispatcher', () => {
    // Case insensitivity
    assert.ok(Math.abs(convert(100, 'FT', 'M') - 30.48) < 1e-3);
    assert.ok(Math.abs(convert(100, 'gpm', 'l/min') - 378.541) < 1e-3);
    assert.ok(Math.abs(convert(378.541, 'l/min', 'gpm') - 100) < 1e-3);
    assert.ok(Math.abs(convert(10, 'PPG', 'SG') - 1.19826) < 1e-3);
    assert.ok(Math.abs(convert(1.19826, 'g/cm3', 'ppg') - 10) < 1e-3);
    assert.ok(Math.abs(convert(3000, 'PSI', 'BAR') - 206.8428) < 1e-2);

    // Speed: ft/hr to m/hr
    assert.ok(Math.abs(convert(100, 'ft/hr', 'm/hr') - 30.48) < 1e-3);
    assert.ok(Math.abs(convert(30.48, 'm/hr', 'ft/hr') - 100) < 1e-3);

    // Identical units return same value
    assert.strictEqual(convert(42, 'm', 'm'), 42);
    assert.strictEqual(convert(42, 'kN', 'kN'), 42);

    // Missing or invalid inputs
    assert.strictEqual(convert('invalid', 'm', 'ft'), null);
    assert.strictEqual(convert(NaN, 'm', 'ft'), null);
    assert.strictEqual(convert(42, null, 'm'), 42);
    assert.strictEqual(convert(42, 'unknown', 'unknown'), 42);
  });
});
