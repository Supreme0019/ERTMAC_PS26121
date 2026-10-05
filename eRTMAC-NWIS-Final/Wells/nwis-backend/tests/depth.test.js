// =============================================================================
// Unit Tests: Depth Alignment & Stratigraphic Interpolation (node --test)
// =============================================================================

const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const { alignDepth } = require('../src/utils/depth');
const db = require('../src/config/database');

const DEMO_WELL_ID = 'b1000000-0000-0000-0000-000000000001';

after(async () => {
  try {
    await db.close();
  } catch {
    // ignore
  }
});

describe('alignDepth Stratigraphic Alignment & TVD Calculation', () => {
  test('alignDepth returns Kopili Formation and valid TVD for DEMO-01 at 2850m', async () => {
    const result = await alignDepth(DEMO_WELL_ID, 2850);

    assert.ok(result, 'Result should exist');
    assert.equal(result.formation_name, 'Kopili Formation');
    assert.ok(result.formation_id, 'Formation ID must be present');
    assert.ok(typeof result.top_depth === 'number', 'top_depth must be a number');
    assert.ok(typeof result.depth_below_top === 'number', 'depth_below_top must be a number');
    assert.ok(result.depth_below_top >= 0, 'depth_below_top must be >= 0');
    assert.ok(typeof result.tvd === 'number', 'tvd must be a number');
    assert.ok(result.tvd <= 2850, 'TVD should be <= MD in a deviated well');
  });

  test('alignDepth calculates correct depth_below_top', async () => {
    const depth = 2860;
    const result = await alignDepth(DEMO_WELL_ID, depth);

    assert.ok(result.top_depth != null);
    const expectedDelta = Math.round((depth - result.top_depth) * 10) / 10;
    assert.equal(result.depth_below_top, expectedDelta, 'depth_below_top must equal depth - top_depth');
  });

  test('alignDepth identifies shallow formations correctly (e.g. 500m)', async () => {
    const result = await alignDepth(DEMO_WELL_ID, 500);

    assert.ok(result);
    assert.ok(result.formation_name, 'Must identify formation at shallow depth');
    assert.ok(result.top_depth <= 500, 'Top depth must be <= 500');
    assert.ok(result.depth_below_top >= 0);
  });

  test('alignDepth falls back gracefully for unknown well UUID', async () => {
    const dummyWellId = '00000000-0000-0000-0000-000000000000';
    const result = await alignDepth(dummyWellId, 2500);

    assert.ok(result, 'Must return result even if well has no formations');
    assert.strictEqual(result.formation_id, null, 'formation_id should be null');
    assert.strictEqual(result.formation_name, null, 'formation_name should be null');
    assert.strictEqual(result.depth_below_top, null, 'depth_below_top should be null');
    // With no trajectory stations, TVD falls back to measured depth
    assert.strictEqual(result.tvd, 2500, 'tvd should fall back to MD when no trajectory stations exist');
  });

  test('alignDepth handles well object input instead of UUID string', async () => {
    const wellObj = { id: DEMO_WELL_ID, name: 'NWIS-DEMO-01' };
    const result = await alignDepth(wellObj, 2850);

    assert.ok(result);
    assert.equal(result.formation_name, 'Kopili Formation');
  });
});
