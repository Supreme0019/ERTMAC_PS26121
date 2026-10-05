// =============================================================================
// NWIS Backend — Authentication & RBAC Security & Privilege Escalation Tests
// =============================================================================

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const db = require('../src/config/database');
const app = require('../src/app');
const authService = require('../src/services/auth.service');
const userRepository = require('../src/repositories/user.repository');
const { ROLES, requireRole, requireAdmin } = require('../src/middleware/rbac');
const { registerSchema, loginSchema, refreshSchema } = require('../src/validators/auth.validator');

describe('Auth & RBAC Security Suite', () => {
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
    await db.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Validator & Schema Hardening
  // ───────────────────────────────────────────────────────────────────────────
  describe('Public Registration Schema Role Hardening', () => {
    test('Registering with role: SYSTEM_ADMIN is neutralized to DRILLING_ENGINEER', () => {
      const result = registerSchema.safeParse({
        name: 'Attacker Admin',
        email: 'attacker-sysadmin@demo.com',
        password: 'Password123!',
        role: 'SYSTEM_ADMIN',
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.role, ROLES.DRILLING_ENGINEER, 'Role MUST be forced to DRILLING_ENGINEER');
    });

    test('Registering with role: DATA_ADMIN is neutralized to DRILLING_ENGINEER', () => {
      const result = registerSchema.safeParse({
        name: 'Attacker Data Admin',
        email: 'attacker-dataadmin@demo.com',
        password: 'Password123!',
        role: 'DATA_ADMIN',
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.role, ROLES.DRILLING_ENGINEER, 'Role MUST be forced to DRILLING_ENGINEER');
    });

    test('Registering with role: AI_ADMIN is neutralized to DRILLING_ENGINEER', () => {
      const result = registerSchema.safeParse({
        name: 'Attacker AI Admin',
        email: 'attacker-aiadmin@demo.com',
        password: 'Password123!',
        role: 'AI_ADMIN',
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.role, ROLES.DRILLING_ENGINEER, 'Role MUST be forced to DRILLING_ENGINEER');
    });

    test('Registering with role: SUPERVISOR is neutralized to DRILLING_ENGINEER', () => {
      const result = registerSchema.safeParse({
        name: 'Attacker Supervisor',
        email: 'attacker-sup@demo.com',
        password: 'Password123!',
        role: 'SUPERVISOR',
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.role, ROLES.DRILLING_ENGINEER, 'Role MUST be forced to DRILLING_ENGINEER');
    });

    test('Registering without role defaults to DRILLING_ENGINEER', () => {
      const result = registerSchema.safeParse({
        name: 'Standard User',
        email: 'standard@demo.com',
        password: 'Password123!',
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.role, ROLES.DRILLING_ENGINEER);
    });

    test('Registration schema rejects invalid email or weak password', () => {
      const invalidEmail = {
        name: 'Test',
        email: 'not-an-email',
        password: 'short',
      };
      const result = registerSchema.safeParse(invalidEmail);
      assert.strictEqual(result.success, false);
    });

    test('Login schema validation requires valid email and password', () => {
      const result = loginSchema.safeParse({ email: 'test@demo.com', password: 'password123' });
      assert.strictEqual(result.success, true);

      const empty = loginSchema.safeParse({});
      assert.strictEqual(empty.success, false);
    });

    test('Refresh schema requires non-empty refreshToken', () => {
      assert.strictEqual(refreshSchema.safeParse({ refreshToken: 'some-token' }).success, true);
      assert.strictEqual(refreshSchema.safeParse({ refreshToken: '' }).success, false);
      assert.strictEqual(refreshSchema.safeParse({}).success, false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Auth Service Layer Role Hardening
  // ───────────────────────────────────────────────────────────────────────────
  describe('Auth Service Role Neutralization', () => {
    test('authService.register ignores client-supplied elevated role', async () => {
      // Spy on userRepository.create
      const originalCreate = userRepository.create;
      const originalFindByEmail = userRepository.findByEmail;

      let capturedPayload = null;
      userRepository.findByEmail = async () => null;
      userRepository.create = async (data) => {
        capturedPayload = data;
        return {
          id: 'test-user-id',
          name: data.name,
          email: data.email,
          role: data.role,
          status: 'active',
          created_at: new Date().toISOString(),
        };
      };

      try {
        const user = await authService.register({
          name: 'Hacker',
          email: 'hacker@evil.org',
          password: 'Password123!',
          role: 'SYSTEM_ADMIN', // Attempted escalation
        });

        assert.ok(capturedPayload, 'Repository create was called');
        assert.strictEqual(capturedPayload.role, ROLES.DRILLING_ENGINEER, 'Service must pass DRILLING_ENGINEER to repository');
        assert.strictEqual(user.role, ROLES.DRILLING_ENGINEER, 'Returned user must have DRILLING_ENGINEER');
      } finally {
        userRepository.create = originalCreate;
        userRepository.findByEmail = originalFindByEmail;
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Token Signing, Expiry & Authorization Middleware
  // ───────────────────────────────────────────────────────────────────────────
  describe('JWT Verification & RBAC Middleware', () => {
    test('Valid JWT token generation and verification', () => {
      const payload = { id: 'u123', email: 'test@ongc.demo', role: ROLES.DRILLING_ENGINEER };
      const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });

      assert.ok(token);
      const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
      assert.strictEqual(decoded.id, 'u123');
      assert.strictEqual(decoded.role, ROLES.DRILLING_ENGINEER);
    });

    test('Expired JWT is rejected', () => {
      const payload = { id: 'u123', email: 'test@ongc.demo', role: ROLES.DRILLING_ENGINEER };
      const expiredToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '-1s', algorithm: 'HS256' });

      assert.throws(() => {
        jwt.verify(expiredToken, env.JWT_SECRET, { algorithms: ['HS256'] });
      }, /jwt expired/);
    });

    test('Token signed with wrong secret is rejected', () => {
      const payload = { id: 'u123', email: 'test@ongc.demo', role: ROLES.DRILLING_ENGINEER };
      const badToken = jwt.sign(payload, 'wrong-secret-key-12345', { expiresIn: '1h', algorithm: 'HS256' });

      assert.throws(() => {
        jwt.verify(badToken, env.JWT_SECRET, { algorithms: ['HS256'] });
      }, /invalid signature/);
    });

    test('requireRole blocks unauthorized role and allows authorized role', () => {
      const middleware = requireRole(ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN);

      // Unauthorized engineer
      let forbiddenCalled = false;
      let nextCalled = false;
      const fakeReqEngineer = { user: { id: 'u1', role: ROLES.DRILLING_ENGINEER } };
      const fakeRes = {
        status: (code) => {
          if (code === 403) forbiddenCalled = true;
          return { json: () => {} };
        },
      };

      middleware(fakeReqEngineer, fakeRes, () => { nextCalled = true; });
      assert.strictEqual(forbiddenCalled, true);
      assert.strictEqual(nextCalled, false);

      // Authorized system admin
      forbiddenCalled = false;
      nextCalled = false;
      const fakeReqAdmin = { user: { id: 'u2', role: ROLES.SYSTEM_ADMIN } };
      middleware(fakeReqAdmin, fakeRes, () => { nextCalled = true; });
      assert.strictEqual(forbiddenCalled, false);
      assert.strictEqual(nextCalled, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. End-to-End HTTP API Privilege Escalation Prevention Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('E2E Public Registration & Role Escalation Defense', () => {
    test('POST /api/auth/register with role: SYSTEM_ADMIN results in DRILLING_ENGINEER role', async () => {
      const randomEmail = `hacker_sys_${Date.now()}@sih-defense.test`;
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Privilege Escalation Attempt',
          email: randomEmail,
          password: 'SuperSecretPassword123!',
          role: 'SYSTEM_ADMIN',
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.user);
      assert.strictEqual(
        body.data.user.role,
        ROLES.DRILLING_ENGINEER,
        'CRITICAL: User must NOT receive SYSTEM_ADMIN role on public registration'
      );
    });

    test('POST /api/auth/register with role: DATA_ADMIN results in DRILLING_ENGINEER role', async () => {
      const randomEmail = `hacker_data_${Date.now()}@sih-defense.test`;
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Data Escalation Attempt',
          email: randomEmail,
          password: 'SuperSecretPassword123!',
          role: 'DATA_ADMIN',
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(
        body.data.user.role,
        ROLES.DRILLING_ENGINEER,
        'CRITICAL: User must NOT receive DATA_ADMIN role on public registration'
      );
    });

    test('POST /api/auth/register with role: AI_ADMIN results in DRILLING_ENGINEER role', async () => {
      const randomEmail = `hacker_ai_${Date.now()}@sih-defense.test`;
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'AI Escalation Attempt',
          email: randomEmail,
          password: 'SuperSecretPassword123!',
          role: 'AI_ADMIN',
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(
        body.data.user.role,
        ROLES.DRILLING_ENGINEER,
        'CRITICAL: User must NOT receive AI_ADMIN role on public registration'
      );
    });

    test('User registered attempting SYSTEM_ADMIN escalation cannot access admin-only endpoints', async () => {
      const email = `hacker_probe_${Date.now()}@sih-defense.test`;
      const password = 'SuperSecretPassword123!';

      // 1. Register with attempted SYSTEM_ADMIN role
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Probe Attacker',
          email,
          password,
          role: 'SYSTEM_ADMIN',
        }),
      });

      // 2. Login to get token
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert.strictEqual(loginRes.status, 200);
      const loginBody = await loginRes.json();
      const token = loginBody.data.accessToken;
      assert.strictEqual(loginBody.data.user.role, ROLES.DRILLING_ENGINEER);

      // 3. Attempt to access admin-only endpoint GET /api/users
      const adminRes = await fetch(`${baseUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.strictEqual(adminRes.status, 403, 'Must be denied access to admin users list with 403 Forbidden');
      const adminBody = await adminRes.json();
      assert.strictEqual(adminBody.success, false);
      assert.strictEqual(adminBody.error.code, 'FORBIDDEN');
    });

    test('Non-admin user cannot change their own or others roles via PATCH /api/users/:id', async () => {
      const engineerToken = jwt.sign(
        { id: 'a1000000-0000-0000-0000-000000000001', email: 'engineer@nwis.demo', role: ROLES.DRILLING_ENGINEER, name: 'Drilling Engineer' },
        env.JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      const res = await fetch(`${baseUrl}/api/users/a1000000-0000-0000-0000-000000000001`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${engineerToken}`,
        },
        body: JSON.stringify({ role: 'SYSTEM_ADMIN' }),
      });

      assert.strictEqual(res.status, 403, 'Non-admin role update must be rejected with 403 Forbidden');
    });

    test('Unauthenticated request to PATCH /api/users/:id is rejected with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/users/a1000000-0000-0000-0000-000000000001`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'SYSTEM_ADMIN' }),
      });

      assert.strictEqual(res.status, 401, 'Unauthenticated role update must return 401 Unauthorized');
    });

    test('DATA_ADMIN cannot escalate a user to SYSTEM_ADMIN (only SYSTEM_ADMIN can modify roles)', async () => {
      const dataAdminToken = jwt.sign(
        { id: 'a1000000-0000-0000-0000-000000000003', email: 'dataadmin@nwis.demo', role: ROLES.DATA_ADMIN, name: 'Data Admin' },
        env.JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      const res = await fetch(`${baseUrl}/api/users/a1000000-0000-0000-0000-000000000001`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dataAdminToken}`,
        },
        body: JSON.stringify({ role: 'SYSTEM_ADMIN' }),
      });

      assert.strictEqual(res.status, 403, 'DATA_ADMIN cannot promote user to SYSTEM_ADMIN');
    });

    test('SYSTEM_ADMIN is authorized to manage user roles', async () => {
      const systemAdminToken = jwt.sign(
        { id: 'a1000000-0000-0000-0000-000000000005', email: 'admin@nwis.demo', role: ROLES.SYSTEM_ADMIN, name: 'Admin User' },
        env.JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      // Update user 1 role to SUPERVISOR
      const res = await fetch(`${baseUrl}/api/users/a1000000-0000-0000-0000-000000000001`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${systemAdminToken}`,
        },
        body: JSON.stringify({ role: 'SUPERVISOR' }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.user.role, 'SUPERVISOR');

      // Revert user 1 back to DRILLING_ENGINEER
      await fetch(`${baseUrl}/api/users/a1000000-0000-0000-0000-000000000001`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${systemAdminToken}`,
        },
        body: JSON.stringify({ role: 'DRILLING_ENGINEER' }),
      });
    });

    test('SYSTEM_ADMIN can directly provision new admin users via POST /api/users', async () => {
      const systemAdminToken = jwt.sign(
        { id: 'a1000000-0000-0000-0000-000000000005', email: 'admin@nwis.demo', role: ROLES.SYSTEM_ADMIN, name: 'Admin User' },
        env.JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      const newAdminEmail = `direct_admin_${Date.now()}@sih-defense.test`;
      const res = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${systemAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Directly Created Admin',
          email: newAdminEmail,
          password: 'AdminPassword123!',
          role: 'SYSTEM_ADMIN',
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.data.user.role, 'SYSTEM_ADMIN');
      assert.strictEqual(body.data.user.email, newAdminEmail);
    });

    test('Non-admin or DATA_ADMIN cannot call POST /api/users to provision users', async () => {
      const dataAdminToken = jwt.sign(
        { id: 'a1000000-0000-0000-0000-000000000003', email: 'dataadmin@nwis.demo', role: ROLES.DATA_ADMIN, name: 'Data Admin' },
        env.JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      const res = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dataAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Admin',
          email: `fail_${Date.now()}@sih-defense.test`,
          password: 'Password123!',
          role: 'SYSTEM_ADMIN',
        }),
      });

      assert.strictEqual(res.status, 403, 'DATA_ADMIN cannot provision users via POST /api/users');
    });

    test('Logout clears refresh token and prevents subsequent refresh', async () => {
      const email = `logout_test_${Date.now()}@sih-defense.test`;
      const password = 'Password123!';

      // Register and login
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Logout User', email, password }),
      });

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginBody = await loginRes.json();
      const { accessToken, refreshToken } = loginBody.data;

      // Logout
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      assert.strictEqual(logoutRes.status, 200);

      // Attempt to refresh after logout
      const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      assert.strictEqual(refreshRes.status, 401, 'Refresh token must be invalid after logout');
    });

    test('Refresh token rotation: old refresh token is invalidated upon use', async () => {
      const email = `rotate_test_${Date.now()}@sih-defense.test`;
      const password = 'Password123!';

      // Register and login
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Rotate User', email, password }),
      });

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginBody = await loginRes.json();
      const oldRefreshToken = loginBody.data.refreshToken;

      // First refresh — should succeed and return new tokens
      const refresh1Res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: oldRefreshToken }),
      });
      assert.strictEqual(refresh1Res.status, 200);
      const refresh1Body = await refresh1Res.json();
      const newRefreshToken = refresh1Body.data.refreshToken;
      assert.notStrictEqual(newRefreshToken, oldRefreshToken);

      // Replaying old refresh token must be rejected with 401
      const replayRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: oldRefreshToken }),
      });
      assert.strictEqual(replayRes.status, 401, 'Replaying old rotated refresh token must fail with 401');
    });
  });
});
