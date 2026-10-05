// =============================================================================
// NWIS Backend — Risk Scoring Logic Tests
// =============================================================================
// Tests the pure scoreRisk() function — no I/O required.
// =============================================================================

const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const { scoreRisk } = require('../src/services/risk.service');
const db = require('../src/config/database');

after(async () => {
  try {
    await db.close();
  } catch {
    // ignore
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeEvent = (overrides = {}) => ({
  id: 'e-test',
  well_id: 'w-test',
  well_name: 'TEST-WELL-01',
  formation_id: 'f-test-01',
  depth: 2500,
  severity: 'high',
  event_type: 'kick',
  distance_km: 10,
  metadata: {},
  ...overrides,
});

// ── Score clamping ────────────────────────────────────────────────────────────
describe('scoreRisk — score bounds', () => {
  test('score is always in [0, 1]', () => {
    // Maximum possible inputs
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2850,
      nearbyEvents: [
        makeEvent({ severity: 'critical' }),
        makeEvent({ severity: 'critical', depth: 2800 }),
        makeEvent({ severity: 'critical', depth: 2900 }),
      ],
      physicsAnomaly: { detected: true, score: 0.99, signals: ['s1', 's2'] },
    });
    assert.ok(result.score >= 0 && result.score <= 1.0, `Score ${result.score} out of [0,1]`);
  });

  test('score is 0 with no events and no anomaly', () => {
    const result = scoreRisk({ riskType: 'kick', depth: 2000 });
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.level, 'low');
  });
});

// ── Event frequency tiers ─────────────────────────────────────────────────────
describe('scoreRisk — event frequency factor', () => {
  test('0 nearby events contributes 0 to frequency score', () => {
    const r0 = scoreRisk({ riskType: 'kick', depth: 2000, nearbyEvents: [] });
    const r1 = scoreRisk({ riskType: 'kick', depth: 2000, nearbyEvents: [makeEvent()] });
    assert.ok(r1.score > r0.score, 'One event must raise score above zero-event baseline');
  });

  test('1 event adds 0.15 base (frequency)', () => {
    // With one medium event (no formation match, no physics), score = 0.15 freq only
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2000,
      nearbyEvents: [makeEvent({ severity: 'medium' })],
    });
    // At least the frequency contribution (0.15) should be present
    assert.ok(result.score >= 0.15, `Expected >= 0.15, got ${result.score}`);
  });

  test('2 events add 0.25 base (frequency)', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2000,
      nearbyEvents: [makeEvent({ severity: 'medium' }), makeEvent({ severity: 'medium', depth: 2600 })],
    });
    assert.ok(result.score >= 0.25, `Expected >= 0.25 for 2 events, got ${result.score}`);
  });

  test('3+ events add 0.30 base (frequency)', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2000,
      nearbyEvents: [
        makeEvent({ severity: 'medium' }),
        makeEvent({ severity: 'medium', depth: 2600 }),
        makeEvent({ severity: 'medium', depth: 2700 }),
      ],
    });
    assert.ok(result.score >= 0.30, `Expected >= 0.30 for 3+ events, got ${result.score}`);
  });
});

// ── Severity factor ───────────────────────────────────────────────────────────
describe('scoreRisk — severity factor', () => {
  test('critical event adds more than high event', () => {
    const rCritical = scoreRisk({
      riskType: 'kick',
      depth: 2000,
      nearbyEvents: [makeEvent({ severity: 'critical' })],
    });
    const rHigh = scoreRisk({
      riskType: 'kick',
      depth: 2000,
      nearbyEvents: [makeEvent({ severity: 'high' })],
    });
    assert.ok(rCritical.score > rHigh.score, 'Critical severity must score higher than high');
  });

  test('risk level is "critical" when score >= 0.7', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2850,
      nearbyEvents: [makeEvent({ severity: 'critical' }), makeEvent({ severity: 'critical', depth: 2800 })],
      physicsAnomaly: { detected: true, score: 0.75, signals: ['Flow-out up'] },
    });
    assert.strictEqual(result.level, 'critical');
  });

  test('risk level is "high" when score >= 0.5', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2000,
      nearbyEvents: [makeEvent({ severity: 'high' }), makeEvent({ severity: 'high', depth: 2100 })],
    });
    assert.ok(['high', 'critical'].includes(result.level), `Expected high or critical, got ${result.level}`);
  });
});

// ── Formation-relative matching ───────────────────────────────────────────────
describe('scoreRisk — formation-relative depth alignment', () => {
  const FORMATION_ID = 'f1000000-0000-0000-0000-000000000005';
  const FORMATION_NAME = 'Kopili Formation';

  test('formation match in same formation adds to score', () => {
    const rWithMatch = scoreRisk({
      riskType: 'stuck_pipe',
      depth: 2850,
      alignedDepth: {
        formation_id: FORMATION_ID,
        formation_name: FORMATION_NAME,
        depth_below_top: 50,
        tvd: 2845,
      },
      nearbyEvents: [
        makeEvent({
          formation_id: FORMATION_ID,
          event_type: 'stuck_pipe',
          metadata: { depth_below_top: 45 },
        }),
      ],
    });
    const rWithoutMatch = scoreRisk({
      riskType: 'stuck_pipe',
      depth: 2850,
      nearbyEvents: [makeEvent({ formation_id: 'other-formation', event_type: 'stuck_pipe' })],
    });
    assert.ok(rWithMatch.score > rWithoutMatch.score,
      `Formation-matched score (${rWithMatch.score}) must exceed non-matched (${rWithoutMatch.score})`);
  });

  test('explanation cites formation-relative depth when matched', () => {
    const result = scoreRisk({
      riskType: 'stuck_pipe',
      depth: 2850,
      alignedDepth: {
        formation_id: FORMATION_ID,
        formation_name: FORMATION_NAME,
        depth_below_top: 50,
        tvd: 2845,
      },
      nearbyEvents: [
        makeEvent({
          well_name: 'LKW-A-102',
          formation_id: FORMATION_ID,
          event_type: 'stuck_pipe',
          metadata: { depth_below_top: 45 },
        }),
      ],
    });
    assert.ok(
      result.explanation.includes('Kopili Formation') || result.explanation.includes('45') || result.explanation.includes('50'),
      `Expected formation-relative info in explanation: "${result.explanation}"`
    );
  });

  test('falls back to absolute MD when formation tops are missing', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2850,
      alignedDepth: null, // no formation tops
      nearbyEvents: [makeEvent({ depth: 2860, formation_id: null })],
    });
    assert.ok(result.score >= 0, 'Score must be a valid number with absolute fallback');
    // Should still produce some contribution from event frequency
    assert.ok(result.score >= 0.15, `Expected score >= 0.15 from event frequency fallback, got ${result.score}`);
  });
});

// ── Telemetry-only path (zero offset events) ──────────────────────────────────
describe('scoreRisk — telemetry-only scoring (zero offset events)', () => {
  test('nonzero score from physics anomaly with zero offset events', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2850,
      nearbyEvents: [],
      physicsAnomaly: {
        detected: true,
        score: 0.75,
        signals: ['Flow-out increased to 135%', 'Pit gain of +3.0 m³'],
      },
    });
    assert.ok(result.score > 0, `Expected nonzero score from telemetry alone, got ${result.score}`);
    assert.strictEqual(result.level, 'critical');
  });

  test('explanation mentions telemetry when zero offset events', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2850,
      nearbyEvents: [],
      physicsAnomaly: {
        detected: true,
        score: 0.6,
        signals: ['Flow-out spike'],
      },
    });
    const lower = result.explanation.toLowerCase();
    assert.ok(
      lower.includes('telemetry') || lower.includes('anomaly') || lower.includes('physics'),
      `Expected telemetry mention in explanation: "${result.explanation}"`
    );
  });

  test('signals array is populated from physics anomaly', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2850,
      nearbyEvents: [],
      physicsAnomaly: { detected: true, score: 0.6, signals: ['Pit gain', 'Gas spike'] },
    });
    assert.ok(result.signals.length >= 2, 'Signals must be propagated into result');
  });
});

// ── Evidence refs ─────────────────────────────────────────────────────────────
describe('scoreRisk — evidence refs structure', () => {
  test('evidence_refs capped at 5 items', () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      makeEvent({ id: `e${i}`, depth: 2000 + i * 100 }));
    const result = scoreRisk({ riskType: 'kick', depth: 2000, nearbyEvents: events });
    assert.ok(result.evidence_refs.length <= 5, 'evidence_refs must be capped at 5');
    assert.ok(result.evidence.length <= 5, 'evidence array must also be capped at 5');
  });

  test('evidence_refs have required shape fields', () => {
    const result = scoreRisk({
      riskType: 'kick',
      depth: 2000,
      nearbyEvents: [makeEvent({ id: 'e-shape', well_id: 'w-x', event_type: 'kick', depth: 2000 })],
    });
    const ref = result.evidence_refs[0];
    assert.ok('well_id' in ref, 'evidence_refs must have well_id');
    assert.ok('event_id' in ref, 'evidence_refs must have event_id');
    assert.ok('provenance' in ref, 'evidence_refs must have provenance tag');
    assert.ok('snippet' in ref, 'evidence_refs must have snippet');
  });
});
