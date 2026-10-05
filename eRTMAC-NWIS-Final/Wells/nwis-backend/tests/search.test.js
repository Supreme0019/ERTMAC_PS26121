// =============================================================================
// NWIS Backend — Search Service Tests
// =============================================================================

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { searchQuerySchema, autocompleteSchema, vectorSearchSchema } = require('../src/validators/search.validator');

describe('Search Validators', () => {
  test('searchQuerySchema validates a minimal search query', () => {
    const result = searchQuerySchema.safeParse({ q: 'mud loss' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.q, 'mud loss');
    assert.strictEqual(result.data.type, 'all');
    assert.strictEqual(result.data.limit, 20);
  });

  test('searchQuerySchema validates full search query with all filters', () => {
    const result = searchQuerySchema.safeParse({
      q: 'stuck pipe',
      well_id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'events',
      severity: 'high',
      from_depth: '2500',
      to_depth: '3000',
      use_ai: 'true',
      page: '2',
      limit: '50',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.type, 'events');
    assert.strictEqual(result.data.severity, 'high');
    assert.strictEqual(result.data.from_depth, 2500);
    assert.strictEqual(result.data.use_ai, true);
    assert.strictEqual(result.data.page, 2);
  });

  test('searchQuerySchema rejects empty query string', () => {
    const result = searchQuerySchema.safeParse({ q: '' });
    assert.strictEqual(result.success, false);
  });

  test('searchQuerySchema rejects invalid type enum', () => {
    const result = searchQuerySchema.safeParse({ q: 'test', type: 'invalid' });
    assert.strictEqual(result.success, false);
  });

  test('searchQuerySchema rejects invalid severity enum', () => {
    const result = searchQuerySchema.safeParse({ q: 'test', severity: 'extreme' });
    assert.strictEqual(result.success, false);
  });

  test('searchQuerySchema rejects query exceeding max length', () => {
    const result = searchQuerySchema.safeParse({ q: 'x'.repeat(501) });
    assert.strictEqual(result.success, false);
  });

  test('autocompleteSchema validates query and limit', () => {
    const result = autocompleteSchema.safeParse({ q: 'LKW', limit: '5' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.q, 'LKW');
    assert.strictEqual(result.data.limit, 5);
  });

  test('autocompleteSchema applies default limit', () => {
    const result = autocompleteSchema.safeParse({ q: 'mud' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.limit, 8);
  });

  test('autocompleteSchema rejects empty query', () => {
    const result = autocompleteSchema.safeParse({ q: '' });
    assert.strictEqual(result.success, false);
  });

  test('vectorSearchSchema validates query and optional params', () => {
    const result = vectorSearchSchema.safeParse({
      query: 'What caused mud loss at 2850m?',
      well_id: '123e4567-e89b-12d3-a456-426614174000',
      limit: 5,
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.limit, 5);
  });

  test('vectorSearchSchema rejects missing query', () => {
    const result = vectorSearchSchema.safeParse({});
    assert.strictEqual(result.success, false);
  });

  test('vectorSearchSchema rejects query exceeding max length', () => {
    const result = vectorSearchSchema.safeParse({ query: 'x'.repeat(1001) });
    assert.strictEqual(result.success, false);
  });
});
