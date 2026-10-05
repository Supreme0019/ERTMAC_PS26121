// =============================================================================
// NWIS Backend — Similarity Validator Tests
// =============================================================================

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { similarityParamsSchema, similarityQuerySchema, similarityBodySchema } = require('../src/validators/similarity.validator');

describe('Similarity Validators', () => {
  test('similarityParamsSchema validates a well UUID', () => {
    const result = similarityParamsSchema.safeParse({
      wellId: '123e4567-e89b-12d3-a456-426614174000',
    });
    assert.strictEqual(result.success, true);
  });

  test('similarityParamsSchema rejects non-UUID', () => {
    const result = similarityParamsSchema.safeParse({ wellId: 'not-a-uuid' });
    assert.strictEqual(result.success, false);
  });

  test('similarityQuerySchema applies defaults', () => {
    const result = similarityQuerySchema.safeParse({});
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.radius, 20);
    assert.strictEqual(result.data.limit, 10);
  });

  test('similarityQuerySchema coerces string numbers', () => {
    const result = similarityQuerySchema.safeParse({ radius: '30', limit: '5' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.radius, 30);
    assert.strictEqual(result.data.limit, 5);
  });

  test('similarityQuerySchema rejects radius > 500', () => {
    const result = similarityQuerySchema.safeParse({ radius: '600' });
    assert.strictEqual(result.success, false);
  });

  test('similarityQuerySchema rejects limit > 50', () => {
    const result = similarityQuerySchema.safeParse({ limit: '100' });
    assert.strictEqual(result.success, false);
  });

  test('similarityBodySchema validates full POST body', () => {
    const result = similarityBodySchema.safeParse({
      wellId: '123e4567-e89b-12d3-a456-426614174000',
      radius: 15,
      limit: 8,
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.radius, 15);
    assert.strictEqual(result.data.limit, 8);
  });

  test('similarityBodySchema requires wellId', () => {
    const result = similarityBodySchema.safeParse({ radius: 15 });
    assert.strictEqual(result.success, false);
  });

  test('similarityBodySchema applies defaults for optional fields', () => {
    const result = similarityBodySchema.safeParse({
      wellId: '123e4567-e89b-12d3-a456-426614174000',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.radius, 20);
    assert.strictEqual(result.data.limit, 10);
  });
});
