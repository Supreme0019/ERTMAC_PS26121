// =============================================================================
// NWIS Backend — AI Service (Circuit Breaker) Tests
// =============================================================================

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

describe('AI Service Circuit Breaker', () => {
  let aiClient;

  beforeEach(() => {
    // Re-require to get a fresh module with reset state
    delete require.cache[require.resolve('../src/config/ai')];
    aiClient = require('../src/config/ai');
  });

  test('getCircuitState returns initial CLOSED state', () => {
    const state = aiClient.getCircuitState();
    assert.strictEqual(state.state, 'CLOSED');
    assert.strictEqual(state.failureCount, 0);
    assert.strictEqual(state.failureThreshold, 5);
    assert.strictEqual(state.resetTimeoutMs, 30000);
  });

  test('healthCheck returns an object with available and url properties', async () => {
    const result = await aiClient.healthCheck();
    assert.ok('available' in result, 'healthCheck should return available property');
    assert.ok('url' in result, 'healthCheck should return url property');
    assert.strictEqual(typeof result.available, 'boolean');
    assert.strictEqual(typeof result.url, 'string');
  });

  test('healthCheck returns available: false when AI service is not running', async () => {
    const result = await aiClient.healthCheck();
    // Since we're running unit tests without the FastAPI service,
    // this should return false
    assert.strictEqual(result.available, false);
  });

  test('aiClient exports all required methods', () => {
    assert.strictEqual(typeof aiClient.healthCheck, 'function');
    assert.strictEqual(typeof aiClient.ocr, 'function');
    assert.strictEqual(typeof aiClient.extractEntities, 'function');
    assert.strictEqual(typeof aiClient.generateEmbedding, 'function');
    assert.strictEqual(typeof aiClient.vectorSearch, 'function');
    assert.strictEqual(typeof aiClient.ragQuery, 'function');
    assert.strictEqual(typeof aiClient.computeSimilarity, 'function');
    assert.strictEqual(typeof aiClient.evaluateRisk, 'function');
    assert.strictEqual(typeof aiClient.processDocument, 'function');
    assert.strictEqual(typeof aiClient.getCircuitState, 'function');
  });

  test('vectorSearch returns graceful failure when AI is unavailable', async () => {
    const result = await aiClient.vectorSearch('test query', { limit: 5 });
    assert.strictEqual(result.success, false);
    assert.ok(result.error, 'Should contain error message');
  });

  test('ragQuery returns graceful failure when AI is unavailable', async () => {
    const result = await aiClient.ragQuery('What is happening?', { well: {} });
    assert.strictEqual(result.success, false);
    assert.ok(result.error, 'Should contain error message');
  });

  test('evaluateRisk returns graceful failure when AI is unavailable', async () => {
    const result = await aiClient.evaluateRisk({ depth: 2850 }, []);
    assert.strictEqual(result.success, false);
  });

  test('processDocument returns graceful failure when AI is unavailable', async () => {
    const result = await aiClient.processDocument('doc-123', '/path/to/file.pdf');
    assert.strictEqual(result.success, false);
  });
});
