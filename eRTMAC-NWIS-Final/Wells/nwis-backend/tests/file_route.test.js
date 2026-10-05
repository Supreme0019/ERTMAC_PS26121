// =============================================================================
// Unit & Integration Tests: File Route Security & Path Traversal Prevention
// =============================================================================

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const storage = require('../src/config/storage');
const db = require('../src/config/database');

describe('Document File Route — Security & Traversal Protection', () => {
  let server;
  let baseUrl;
  const testFileName = 'test-security-sample.pdf';
  const testFilePath = path.join(storage.UPLOAD_DIR, testFileName);

  before(async () => {
    // Write a dummy test PDF into storage.UPLOAD_DIR
    fs.writeFileSync(testFilePath, Buffer.from('%PDF-1.4 test document content'));

    // Start server on an ephemeral port
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
    // Clean up dummy test file
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch {
      // ignore
    }

    // Close HTTP server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Close DB pool
    try {
      await db.close();
    } catch {
      // ignore
    }
  });

  test('GET valid stored file returns 200 and application/pdf content type', async () => {
    const res = await fetch(`${baseUrl}/api/documents/file/${testFileName}`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType && contentType.includes('application/pdf'));
    const text = await res.text();
    assert.ok(text.includes('%PDF-1.4 test document content'));
  });

  test('Path traversal: blocks simple directory traversal (../../package.json) with 400', async () => {
    const traversalKey = encodeURIComponent('../../package.json');
    const res = await fetch(`${baseUrl}/api/documents/file/${traversalKey}`);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error, 'Invalid file key');
  });

  test('Path traversal: blocks deeply nested traversal (../../../../etc/passwd) with 400', async () => {
    const traversalKey = encodeURIComponent('../../../../etc/passwd');
    const res = await fetch(`${baseUrl}/api/documents/file/${traversalKey}`);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error, 'Invalid file key');
  });

  test('Path traversal: blocks traversal through sub-path (subfolder/../../secret.txt) with 400', async () => {
    const traversalKey = encodeURIComponent('subfolder/../../secret.txt');
    const res = await fetch(`${baseUrl}/api/documents/file/${traversalKey}`);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error, 'Invalid file key');
  });

  test('Path traversal: blocks Windows backslash traversal (..\\..\\windows\\win.ini) with 400', async () => {
    const traversalKey = encodeURIComponent('..\\..\\windows\\win.ini');
    const res = await fetch(`${baseUrl}/api/documents/file/${traversalKey}`);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error, 'Invalid file key');
  });
});
