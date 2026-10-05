// =============================================================================
// Unit Tests: WITSML 1.4 Parser & Data Quality Gate
// =============================================================================

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const witsmlService = require('../src/services/witsml.service');
const dataQualityService = require('../src/services/dataQuality.service');
const { convert, klbfToKn, psiToBar, ppgToSg } = require('../src/utils/units');
const db = require('../src/config/database');

after(async () => {
  try {
    await db.close();
  } catch {
    // ignore
  }
});

test('Unit conversions work accurately', () => {
  // 10 klbf ~ 44.48 kN
  assert.ok(Math.abs(klbfToKn(10) - 44.4822) < 0.01);
  // 3000 psi ~ 206.84 bar
  assert.ok(Math.abs(psiToBar(3000) - 206.84) < 0.1);
  // 10 ppg ~ 1.198 sg
  assert.ok(Math.abs(ppgToSg(10) - 1.198) < 0.01);
  // Generic convert
  assert.ok(Math.abs(convert(100, 'ft', 'm') - 30.48) < 0.01);
});

test('DataQualityService flags depth regression and negative WOB', () => {
  const testWellId = 'test-well-dq-01';
  dataQualityService.resetWellState(testWellId);

  // Normal row
  const r1 = dataQualityService.validateRecord(testWellId, {
    depth: 2840,
    wob: 120,
    rpm: 100,
  });
  assert.equal(r1.valid, true);

  // Regressive depth + negative WOB
  const r2 = dataQualityService.validateRecord(testWellId, {
    depth: 2810, // regression!
    wob: -25,   // negative!
    rpm: 100,
  });
  assert.equal(r2.valid, false);
  assert.equal(r2.rejected, true);
  assert.ok(r2.flags.some((f) => f.includes('DEPTH_REGRESSION')));
  assert.ok(r2.flags.some((f) => f.includes('WOB_OUT_OF_RANGE')));
});

test('WITSML parser extracts curves and correctly parses sample-witsml-log.xml', () => {
  const xmlPath = path.join(__dirname, '..', 'sample-witsml-log.xml');
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');

  const { curves, dataLines } = witsmlService.parseXml(xmlContent);

  assert.ok(curves.length >= 8, `Expected at least 8 curves, found ${curves.length}`);
  assert.equal(dataLines.length, 12, `Expected 12 data rows, found ${dataLines.length}`);

  const mdCurve = curves.find((c) => c.mnemonic === 'MD');
  assert.ok(mdCurve, 'MD curve must be present');
  assert.equal(mdCurve.field, 'depth');

  const wobCurve = curves.find((c) => c.mnemonic === 'SWOB');
  assert.ok(wobCurve, 'SWOB curve must be present');
  assert.equal(wobCurve.targetUnit, 'kN');
});
