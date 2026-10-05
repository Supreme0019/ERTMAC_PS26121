// =============================================================================
// NWIS Backend — Assistant / RAG Validator & Session Tests
// =============================================================================

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { askSchema, sessionQuerySchema } = require('../src/validators/assistant.validator');

describe('Assistant (RAG) Validators', () => {
  test('askSchema validates a minimal question', () => {
    const result = askSchema.safeParse({ question: 'What risks are at 2850m?' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.question, 'What risks are at 2850m?');
  });

  test('askSchema validates full query with session and context', () => {
    const result = askSchema.safeParse({
      question: 'Compare mud loss events across nearby wells',
      well_id: '123e4567-e89b-12d3-a456-426614174000',
      well_name: 'NWIS-DEMO-01',
      session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      context: {
        depth: 2850,
        formation: 'Kopili Formation',
        include_nearby: true,
        include_parameters: false,
      },
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.context.depth, 2850);
    assert.strictEqual(result.data.context.include_nearby, true);
    assert.strictEqual(result.data.context.include_parameters, false);
  });

  test('askSchema rejects empty question', () => {
    const result = askSchema.safeParse({ question: '' });
    assert.strictEqual(result.success, false);
  });

  test('askSchema rejects question exceeding max length', () => {
    const result = askSchema.safeParse({ question: 'x'.repeat(2001) });
    assert.strictEqual(result.success, false);
  });

  test('askSchema rejects invalid well_id UUID', () => {
    const result = askSchema.safeParse({
      question: 'Test',
      well_id: 'not-a-uuid',
    });
    assert.strictEqual(result.success, false);
  });

  test('askSchema rejects invalid session_id UUID', () => {
    const result = askSchema.safeParse({
      question: 'Test',
      session_id: 'bad-uuid',
    });
    assert.strictEqual(result.success, false);
  });

  test('askSchema applies defaults for context booleans', () => {
    const result = askSchema.safeParse({
      question: 'Test',
      context: { depth: 1000 },
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.context.include_nearby, true);
    assert.strictEqual(result.data.context.include_parameters, true);
  });

  test('sessionQuerySchema validates a session UUID', () => {
    const result = sessionQuerySchema.safeParse({
      session_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    assert.strictEqual(result.success, true);
  });

  test('sessionQuerySchema rejects missing session_id', () => {
    const result = sessionQuerySchema.safeParse({});
    assert.strictEqual(result.success, false);
  });

  test('sessionQuerySchema rejects invalid UUID format', () => {
    const result = sessionQuerySchema.safeParse({ session_id: 'abc-123' });
    assert.strictEqual(result.success, false);
  });

  test('askSchema accepts well_name without well_id', () => {
    const result = askSchema.safeParse({
      question: 'What are the risks?',
      well_name: 'NWIS-DEMO-01',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.well_name, 'NWIS-DEMO-01');
    assert.strictEqual(result.data.well_id, undefined);
  });

  test('askSchema context is optional', () => {
    const result = askSchema.safeParse({ question: 'General question?' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.context, undefined);
  });
});
