// =============================================================================
// NWIS Backend — API Integration Tests
// =============================================================================

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');

describe('NWIS Core API Health & Endpoints', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    const db = require('../src/config/database');
    try {
      await db.close();
    } catch {
      // ignore
    }
  });

  test('GET / should return online status and documentation link', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'online');
    assert.strictEqual(body.documentation, '/api/docs');
  });

  test('GET /api/health should return system status healthy', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'healthy');
  });

  test('GET /unknown-route should return 404 NOT_FOUND structure', async () => {
    const res = await fetch(`${baseUrl}/unknown-route`);
    assert.strictEqual(res.status, 404);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error);
    assert.strictEqual(body.error.code, 'ROUTE_GET_/UNKNOWN-ROUTE_NOT_FOUND');
  });
});
