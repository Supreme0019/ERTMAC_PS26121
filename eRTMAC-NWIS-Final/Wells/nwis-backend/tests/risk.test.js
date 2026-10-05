// =============================================================================
// NWIS Backend — Risk & Alert Tests
// =============================================================================

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { riskEvaluateSchema, riskQuerySchema } = require('../src/validators/risk.validator');
const { scoreRisk } = require('../src/services/risk.service');
const db = require('../src/config/database');

after(async () => {
  try {
    await db.close();
  } catch {
    // ignore
  }
});

describe('Risk & Alert Engine Validations', () => {
  test('Risk evaluation schema validates well UUID and depth', () => {
    const valid = riskEvaluateSchema.safeParse({
      well_id: '123e4567-e89b-12d3-a456-426614174000',
      depth: 2850,
    });
    assert.strictEqual(valid.success, true);
  });

  test('Risk query schema enforces positive depth filters', () => {
    const valid = riskQuerySchema.safeParse({
      from_depth: '2500',
      to_depth: '3000',
      risk_level: 'high',
    });
    assert.strictEqual(valid.success, true);
    assert.strictEqual(valid.data.from_depth, 2500);
  });

  test('scoreRisk produces nonzero score from telemetry alone with zero offset events', () => {
    const scored = scoreRisk({
      riskType: 'kick',
      depth: 2850,
      alignedDepth: {
        formation_id: 'f1000000-0000-0000-0000-000000000005',
        formation_name: 'Kopili Formation',
        depth_below_top: 50,
        tvd: 2845,
      },
      nearbyEvents: [], // ZERO offset events
      physicsAnomaly: {
        detected: true,
        score: 0.75,
        signals: ['Flow-out increased to 135%', 'Pit gain of +3.0 m³'],
      },
    });

    assert.ok(scored.score > 0, `Expected nonzero score from telemetry alone, got ${scored.score}`);
    assert.equal(scored.level, 'critical');
    assert.ok(scored.explanation.includes('telemetry'), 'Explanation must mention telemetry');
    assert.ok(scored.signals.length >= 2, 'Signals must be populated');
  });

  test('scoreRisk formats formation-relative depth explanation when offset event matches', () => {
    const scored = scoreRisk({
      riskType: 'stuck_pipe',
      depth: 2850,
      alignedDepth: {
        formation_id: 'f1000000-0000-0000-0000-000000000005',
        formation_name: 'Kopili Formation',
        depth_below_top: 50,
        tvd: 2845,
      },
      nearbyEvents: [
        {
          id: 'e1',
          well_id: 'w2',
          well_name: 'LKW-A-102',
          formation_id: 'f1000000-0000-0000-0000-000000000005',
          depth: 2450,
          severity: 'high',
          event_type: 'stuck_pipe',
          metadata: { depth_below_top: 45 },
        },
      ],
    });

    assert.ok(scored.score >= 0.5, `Score should reflect formation proximity, got ${scored.score}`);
    assert.ok(
      scored.explanation.includes('below Kopili Formation top in LKW-A-102 vs 50 m here'),
      `Explanation must cite formation relative offset, got: ${scored.explanation}`
    );
  });
});
