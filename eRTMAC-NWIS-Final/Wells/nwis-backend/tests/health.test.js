// =============================================================================
// Integration Tests: Health Endpoint Reporting (node --test)
// =============================================================================

const { describe, test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const db = require('../src/config/database');

describe('Health Endpoint (/api/health)', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      await db.close();
    } catch {
      // ignore
    }
  });

  test('GET /api/health reports DB, PostGIS, AI service, and replay state', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.ok(['healthy', 'degraded'].includes(body.status), `Status should be healthy or degraded, got: ${body.status}`);
    assert.strictEqual(body.system, 'eRTMAC-NWIS Backend');
    assert.strictEqual(body.version, '1.0.0');
    assert.ok(body.timestamp);

    // Verify all 4 required subsystems are reported
    const { checks } = body;
    assert.ok(checks, 'checks object must be present');

    // 1. DB check
    assert.ok(checks.db, 'db check must be present');
    assert.strictEqual(checks.db.status, 'ok');
    assert.ok(typeof checks.db.latency_ms === 'number');

    // 2. PostGIS check
    assert.ok(checks.postgis, 'postgis check must be present');
    assert.ok(['ok', 'unavailable'].includes(checks.postgis.status));

    // 3. AI service check
    assert.ok(checks.ai_service, 'ai_service check must be present');
    assert.ok(['ok', 'degraded', 'unreachable', 'timeout'].includes(checks.ai_service.status));

    // 4. Replay state
    assert.ok(checks.replay, 'replay check must be present');
    assert.strictEqual(checks.replay.status, 'ok');
    assert.ok(typeof checks.replay.is_replaying === 'boolean');
    assert.ok(checks.replay.well_id);
  });

  test('GET /api/health fails with 503 when the database is down', async () => {
    // Mock db.query to simulate database connection loss
    mock.method(db, 'query', async () => {
      throw new Error('Connection refused: PostgreSQL down');
    });

    try {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 503, 'Should return HTTP 503 when database is down');

      const body = await res.json();
      assert.strictEqual(body.status, 'unhealthy');
      assert.strictEqual(body.checks.db.status, 'down');
      assert.ok(body.checks.db.error.includes('Connection refused'));
    } finally {
      mock.reset();
    }
  });
});
