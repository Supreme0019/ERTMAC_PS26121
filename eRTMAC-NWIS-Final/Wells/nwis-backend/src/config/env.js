// =============================================================================
// NWIS Backend — Environment Configuration
// =============================================================================
// Centralizes all environment variable access with defaults and validation.
// SECURITY: Required secrets must be set via environment variables in production.
// =============================================================================

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retrieve an environment variable. In production, throws if the value is
 * missing and no safe fallback exists. In development, uses the supplied
 * devDefault and emits a warning.
 */
function requireSecret(key, devDefault) {
  const val = process.env[key];
  if (val) return val;
  if (isProd) {
    throw new Error(
      `[NWIS] FATAL: Required secret "${key}" is not set. ` +
      'Set it as an environment variable before starting in production.'
    );
  }
  // Development-only fallback — never use in production
  console.warn(
    `[NWIS] WARNING: "${key}" not set, using insecure dev default. ` +
    'DO NOT deploy with this configuration.'
  );
  return devDefault;
}

/**
 * Retrieve a required environment variable that is NOT a secret (no default).
 * Always throws if missing, in any NODE_ENV.
 */
function requireEnv(key) {
  const val = process.env[key];
  if (val) return val;
  throw new Error(
    `[NWIS] FATAL: Required environment variable "${key}" is not set. ` +
    'Check your .env file (see .env.example for the full template).'
  );
}

const env = {
  // ── App ──
  NODE_ENV,
  PORT: parseInt(process.env.PORT, 10) || 4000,
  isDev: NODE_ENV === 'development',
  isProd,

  // ── Database — no in-code fallback; must always be explicitly set ──────
  // Reason: a missing DATABASE_URL that silently falls back to a localhost
  // placeholder allows the server to start but every request fails with an
  // opaque connection error rather than a clear startup message.
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // ── JWT — REQUIRED in production; dev-default is deliberately ugly ─────
  JWT_SECRET: requireSecret('JWT_SECRET', '__UNSAFE_DEV_ONLY__jwt__set_in_env__'),
  JWT_REFRESH_SECRET: requireSecret('JWT_REFRESH_SECRET', '__UNSAFE_DEV_ONLY__refresh__set_in_env__'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // ── CORS ──
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // ── AI Service ──
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',

  // ── Object Storage (S3/MinIO) — no in-code credential fallback ─────────
  // Reason: 'minioadmin'/'minioadmin' is the publicly known MinIO default.
  // Falling back silently in code means the app appears to work while
  // actually using unauthenticated/public storage.
  S3_ENDPOINT:    process.env.S3_ENDPOINT  || 'http://localhost:9000',
  S3_BUCKET:      process.env.S3_BUCKET    || 'nwis-documents',
  S3_ACCESS_KEY:  requireSecret('S3_ACCESS_KEY', '__UNSAFE_DEV_ONLY__s3_access__'),
  S3_SECRET_KEY:  requireSecret('S3_SECRET_KEY', '__UNSAFE_DEV_ONLY__s3_secret__'),

  // ── Embedding ──
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',

  // ── LLM ──
  LLM_API_KEY: process.env.LLM_API_KEY || '',

  // ── Logging ──
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // ── Rate Limiting ──
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
};

// ── Runtime Validation ───────────────────────────────────────────────────────
function validate() {
  const errors = [];
  const warnings = [];

  // ── Universal checks (all environments) ─────────────────────────────────
  // Catch unfilled .env.example placeholder values copied as-is.
  const PLACEHOLDER_RE = /^REPLACE_WITH_/;
  const secretKeys = { JWT_SECRET: env.JWT_SECRET, JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET, S3_ACCESS_KEY: env.S3_ACCESS_KEY, S3_SECRET_KEY: env.S3_SECRET_KEY };
  for (const [key, val] of Object.entries(secretKeys)) {
    if (PLACEHOLDER_RE.test(val)) {
      errors.push(`"${key}" still contains an unfilled placeholder value from .env.example.`);
    }
  }

  // JWT secrets must be at least 32 bytes (64 hex chars) in all envs.
  if (env.JWT_SECRET.length < 32) errors.push('JWT_SECRET must be at least 32 characters.');
  if (env.JWT_REFRESH_SECRET.length < 32) errors.push('JWT_REFRESH_SECRET must be at least 32 characters.');
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values.');

  // ── Production-only checks ───────────────────────────────────────────────
  if (isProd) {
    if (env.DATABASE_URL.includes('localhost')) {
      errors.push('DATABASE_URL points to localhost in production. Set a real database URL.');
    }
    if (env.DATABASE_URL.includes('<USER>') || env.DATABASE_URL.includes('<PASSWORD>')) {
      errors.push('DATABASE_URL still contains template placeholders — fill in real values.');
    }
    if (env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace') {
      warnings.push(`LOG_LEVEL is "${env.LOG_LEVEL}" in production — this may expose sensitive data in logs.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      '[NWIS] FATAL: Server cannot start due to insecure configuration:\n' +
      errors.map((e) => `  • ${e}`).join('\n') + '\n' +
      'Fix your .env file (see .env.example for the full template).'
    );
  }
  for (const w of warnings) console.warn(`[NWIS] WARNING: ${w}`);
}

validate();

module.exports = env;
