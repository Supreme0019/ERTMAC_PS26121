// =============================================================================
// Unit Tests: Alert Dedupe & Hysteresis State Machine (node --test)
// =============================================================================

const { describe, test, beforeEach, afterEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const alertService = require('../src/services/alert.service');
const alertRepository = require('../src/repositories/alert.repository');
const db = require('../src/config/database');

const TEST_WELL_ID = 'b1000000-0000-0000-0000-000000000001';

describe('Alert Engine v2 — Deduplication & Hysteresis State Machine', () => {
  let createdAlerts = [];
  let updatedAlerts = [];
  let resolvedAlerts = [];
  let openAlertByDedupe = new Map();

  beforeEach(() => {
    createdAlerts = [];
    updatedAlerts = [];
    resolvedAlerts = [];
    openAlertByDedupe = new Map();

    mock.method(alertRepository, 'findOpenByDedupeKey', async (dedupeKey) => {
      return openAlertByDedupe.get(dedupeKey) || null;
    });

    mock.method(alertRepository, 'create', async (alertData) => {
      const alert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...alertData,
        status: 'generated',
        generated_at: new Date().toISOString(),
      };
      createdAlerts.push(alert);
      openAlertByDedupe.set(alert.dedupe_key, alert);
      return alert;
    });

    mock.method(alertRepository, 'updateExistingAlert', async (id, updateData) => {
      for (const [key, alert] of openAlertByDedupe.entries()) {
        if (alert.id === id) {
          const updated = { ...alert, ...updateData };
          openAlertByDedupe.set(key, updated);
          updatedAlerts.push(updated);
          return updated;
        }
      }
      return null;
    });

    mock.method(alertRepository, 'autoResolveAlert', async (id, resolveData) => {
      for (const [key, alert] of openAlertByDedupe.entries()) {
        if (alert.id === id) {
          const resolved = { ...alert, status: 'resolved', ...resolveData };
          openAlertByDedupe.delete(key);
          resolvedAlerts.push(resolved);
          return resolved;
        }
      }
      return null;
    });
  });

  afterEach(() => {
    mock.reset();
  });

  after(async () => {
    try {
      await db.close();
    } catch {
      // ignore
    }
  });

  test('Cooldown: does NOT raise alert if score < 0.5', async () => {
    const risk = {
      well_id: TEST_WELL_ID,
      risk_type: 'kick',
      depth: 2850,
      score: 0.45, // < 0.5 threshold
      risk_level: 'medium',
      explanation: 'Slight gas indicator',
    };

    const result = await alertService.upsertFromRisk(risk);
    assert.strictEqual(result, null, 'Score < 0.5 must return null and not raise alert');
    assert.strictEqual(createdAlerts.length, 0, 'No alert should be created');
  });

  test('Raise: creates new alert when score >= 0.5 with occurrence_count = 1', async () => {
    const risk = {
      well_id: TEST_WELL_ID,
      risk_type: 'kick',
      depth: 2855,
      score: 0.55,
      risk_level: 'high',
      explanation: 'Kick indicator in Kopili',
    };

    const alert = await alertService.upsertFromRisk(risk);
    assert.ok(alert, 'Alert must be created');
    assert.strictEqual(createdAlerts.length, 1);
    assert.strictEqual(alert.occurrence_count, 1);
    assert.strictEqual(alert.score, 0.55);
    // Dedupe key: well_id:kick:floor(2855/25) = ...:kick:114
    assert.strictEqual(alert.dedupe_key, `${TEST_WELL_ID}:kick:114`);
  });

  test('Critical severity: assigns critical when score >= 0.7', async () => {
    const risk = {
      well_id: TEST_WELL_ID,
      risk_type: 'kick',
      depth: 2860,
      score: 0.78,
      explanation: 'Major flow-out spike',
    };

    const alert = await alertService.upsertFromRisk(risk);
    assert.ok(alert);
    assert.strictEqual(alert.severity, 'critical');
  });

  test('Deduplication: re-evaluating in same 25m bucket updates existing alert instead of creating duplicate', async () => {
    // 1st detection at 2852m (bucket 114)
    const risk1 = {
      well_id: TEST_WELL_ID,
      risk_type: 'stuck_pipe',
      depth: 2852,
      score: 0.55,
      risk_level: 'high',
      explanation: 'Torque climbing',
    };
    const firstAlert = await alertService.upsertFromRisk(risk1);
    assert.ok(firstAlert);
    assert.strictEqual(createdAlerts.length, 1);

    // 2nd detection at 2865m (still bucket 114: floor(2865/25) = 114)
    const risk2 = {
      well_id: TEST_WELL_ID,
      risk_type: 'stuck_pipe',
      depth: 2865,
      score: 0.58,
      risk_level: 'high',
      explanation: 'Torque continuing to climb',
    };
    const updated = await alertService.upsertFromRisk(risk2);

    assert.ok(updated);
    // No new alert created!
    assert.strictEqual(createdAlerts.length, 1, 'Should NOT insert duplicate alert in same 25m bucket');
    assert.strictEqual(updatedAlerts.length, 1, 'Existing alert should be updated');
    assert.strictEqual(updated.occurrence_count, 2, 'Occurrence count must increment to 2');
    assert.strictEqual(updated.last_seen_depth, 2865, 'Last seen depth must update to 2865');
  });

  test('Escalation: severity escalates when score rises by >= 0.15', async () => {
    // 1st detection at score 0.50 (high severity)
    const risk1 = {
      well_id: TEST_WELL_ID,
      risk_type: 'stuck_pipe',
      depth: 2850,
      score: 0.50,
      risk_level: 'high',
      explanation: 'Moderate torque',
    };
    const alert1 = await alertService.upsertFromRisk(risk1);
    assert.strictEqual(alert1.severity, 'high');

    // 2nd detection with delta +0.18 (score 0.68 >= 0.50 + 0.15)
    const risk2 = {
      well_id: TEST_WELL_ID,
      risk_type: 'stuck_pipe',
      depth: 2860,
      score: 0.68,
      explanation: 'Torque spike confirmed',
    };
    const updated = await alertService.upsertFromRisk(risk2);
    assert.strictEqual(updated.severity, 'critical', 'High severity must escalate to critical when delta >= 0.15');
  });

  test('Escalation: severity does NOT escalate when score rises by < 0.15', async () => {
    const risk1 = {
      well_id: TEST_WELL_ID,
      risk_type: 'stuck_pipe',
      depth: 2850,
      score: 0.50,
      risk_level: 'high',
    };
    await alertService.upsertFromRisk(risk1);

    // Delta only +0.08 (0.58 < 0.50 + 0.15)
    const risk2 = {
      well_id: TEST_WELL_ID,
      risk_type: 'stuck_pipe',
      depth: 2855,
      score: 0.58,
    };
    const updated = await alertService.upsertFromRisk(risk2);
    assert.strictEqual(updated.severity, 'high', 'Severity should remain high when score rise < 0.15');
  });

  test('Auto-clear (Hysteresis): clears existing alert when score drops below 0.4', async () => {
    // 1st detection raises alert
    const risk1 = {
      well_id: TEST_WELL_ID,
      risk_type: 'mud_loss',
      depth: 2850,
      score: 0.60,
      risk_level: 'high',
    };
    await alertService.upsertFromRisk(risk1);
    assert.strictEqual(openAlertByDedupe.size, 1);

    // Score drops below 0.4 hysteresis threshold
    const risk2 = {
      well_id: TEST_WELL_ID,
      risk_type: 'mud_loss',
      depth: 2860,
      score: 0.35, // < 0.4
    };
    const resolved = await alertService.upsertFromRisk(risk2);

    assert.ok(resolved);
    assert.strictEqual(resolved.status, 'resolved', 'Alert must be auto-resolved');
    assert.strictEqual(resolvedAlerts.length, 1);
    assert.strictEqual(openAlertByDedupe.size, 0, 'Open alert map must no longer contain this dedupe key');
  });
});
