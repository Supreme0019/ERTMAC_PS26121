// =============================================================================
// NWIS Backend — Realtime & Alert Validator Tests
// =============================================================================

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { pushDataSchema, replayStartSchema, wellIdParamSchema } = require('../src/validators/realtime.validator');

describe('Realtime Validators', () => {
  test('pushDataSchema validates a minimal data point', () => {
    const result = pushDataSchema.safeParse({ depth: 2850 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.depth, 2850);
  });

  test('pushDataSchema validates a full drilling data point', () => {
    const result = pushDataSchema.safeParse({
      depth: 2850,
      wob: 18.5,
      rpm: 105,
      torque: 28.0,
      rop: 7.5,
      mud_weight: 1.21,
      mud_flow_rate: 880,
      standpipe_pressure: 4100,
      annular_pressure: 210,
      hook_load: 160,
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.depth, 2850);
    assert.strictEqual(result.data.wob, 18.5);
    assert.strictEqual(result.data.torque, 28.0);
    assert.strictEqual(result.data.mud_weight, 1.21);
  });

  test('pushDataSchema also accepts camelCase variants', () => {
    const result = pushDataSchema.safeParse({
      depth: 2800,
      mudWeight: 1.20,
      mudFlowRate: 850,
      standpipePressure: 3800,
      annularPressure: 180,
      hookLoad: 145,
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.mudWeight, 1.20);
    assert.strictEqual(result.data.hookLoad, 145);
  });

  test('pushDataSchema rejects negative depth', () => {
    const result = pushDataSchema.safeParse({ depth: -100 });
    assert.strictEqual(result.success, false);
  });

  test('pushDataSchema rejects missing depth', () => {
    const result = pushDataSchema.safeParse({ wob: 15 });
    assert.strictEqual(result.success, false);
  });

  test('replayStartSchema applies defaults', () => {
    const result = replayStartSchema.safeParse({});
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.speedMs, 3000);
  });

  test('replayStartSchema validates custom speed', () => {
    const result = replayStartSchema.safeParse({
      wellId: '123e4567-e89b-12d3-a456-426614174000',
      speedMs: 1000,
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.speedMs, 1000);
  });

  test('replayStartSchema rejects speed < 500ms', () => {
    const result = replayStartSchema.safeParse({ speedMs: 100 });
    assert.strictEqual(result.success, false);
  });

  test('replayStartSchema rejects speed > 30000ms', () => {
    const result = replayStartSchema.safeParse({ speedMs: 60000 });
    assert.strictEqual(result.success, false);
  });

  test('wellIdParamSchema validates UUID', () => {
    const result = wellIdParamSchema.safeParse({
      wellId: '123e4567-e89b-12d3-a456-426614174000',
    });
    assert.strictEqual(result.success, true);
  });

  test('wellIdParamSchema rejects non-UUID', () => {
    const result = wellIdParamSchema.safeParse({ wellId: 'my-well' });
    assert.strictEqual(result.success, false);
  });
});

describe('Alert Lifecycle Validators (via Risk Validators)', () => {
  const { riskEvaluateSchema, riskQuerySchema } = require('../src/validators/risk.validator');

  test('Risk evaluation schema validates well UUID', () => {
    const result = riskEvaluateSchema.safeParse({
      well_id: '123e4567-e89b-12d3-a456-426614174000',
      depth: 2850,
    });
    assert.strictEqual(result.success, true);
  });

  test('Risk query schema enforces valid risk levels', () => {
    const result = riskQuerySchema.safeParse({
      risk_level: 'high',
      from_depth: '2500',
      to_depth: '3000',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.risk_level, 'high');
    assert.strictEqual(result.data.from_depth, 2500);
  });
});
