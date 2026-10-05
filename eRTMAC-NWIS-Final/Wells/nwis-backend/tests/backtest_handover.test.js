const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const backtestService = require('../src/services/backtest.service');
const handoverService = require('../src/services/handover.service');
const db = require('../src/config/database');

after(async () => {
  try {
    await db.close();
  } catch {
    // ignore
  }
});

test('Leave-One-Well-Out Backtest executes and produces metrics', async () => {
  const result = await backtestService.run({ leadDepths: [50, 100] });
  assert.ok(result);
  assert.ok(result.label.includes('Prototype validation'));
  assert.ok(result.overall.total_events > 0);
  assert.ok(result.overall.recall >= 0.50, `Expected recall >= 0.50, got ${result.overall.recall}`);
  assert.ok(typeof result.by_risk_type === 'object');
  assert.ok(Array.isArray(result.detail));
});

test('Shift Handover Report generates structured data for active well', async () => {
  const report = await handoverService.generateHandoverReport('b1000000-0000-0000-0000-000000000001');
  assert.ok(report);
  assert.equal(report.report_type, 'SHIFT_HANDOVER');
  assert.ok(report.well.well_name === 'WELL-A-102' || report.well.well_name === 'NWIS-DEMO-01');
  assert.ok(Array.isArray(report.open_alerts));
  assert.ok(Array.isArray(report.recent_events));
  assert.ok(Array.isArray(report.active_risks));
  assert.ok(report.disclaimer.includes('eRTMAC-NWIS'));
});
