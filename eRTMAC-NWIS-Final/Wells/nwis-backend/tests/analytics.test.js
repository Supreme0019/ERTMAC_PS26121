// =============================================================================
// NWIS Backend — Analytics Validator Tests
// =============================================================================

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { analyticsQuerySchema, dashboardQuerySchema } = require('../src/validators/analytics.validator');

describe('Analytics Validators', () => {
  test('analyticsQuerySchema validates empty query (all defaults)', () => {
    const result = analyticsQuerySchema.safeParse({});
    assert.strictEqual(result.success, true);
  });

  test('analyticsQuerySchema validates well_id filter', () => {
    const result = analyticsQuerySchema.safeParse({
      well_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    assert.strictEqual(result.success, true);
  });

  test('analyticsQuerySchema validates date range filters', () => {
    const result = analyticsQuerySchema.safeParse({
      from_date: '2026-01-01T00:00:00.000Z',
      to_date: '2026-12-31T23:59:59.000Z',
    });
    assert.strictEqual(result.success, true);
  });

  test('analyticsQuerySchema rejects invalid well_id', () => {
    const result = analyticsQuerySchema.safeParse({
      well_id: 'not-a-uuid',
    });
    assert.strictEqual(result.success, false);
  });

  test('dashboardQuerySchema validates field filter', () => {
    const result = dashboardQuerySchema.safeParse({
      field: 'Lakwa Field',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.field, 'Lakwa Field');
  });

  test('dashboardQuerySchema validates status filter', () => {
    const result = dashboardQuerySchema.safeParse({
      status: 'active',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.status, 'active');
  });

  test('dashboardQuerySchema rejects invalid status', () => {
    const result = dashboardQuerySchema.safeParse({
      status: 'invalid_status',
    });
    assert.strictEqual(result.success, false);
  });

  test('dashboardQuerySchema allows empty query', () => {
    const result = dashboardQuerySchema.safeParse({});
    assert.strictEqual(result.success, true);
  });
});
