// =============================================================================
// NWIS Backend — Database Connection (Neon Serverless + Plain PostgreSQL)
// =============================================================================
// Uses @neondatabase/serverless when connecting to Neon (neon.tech).
// Falls back to standard 'pg' with a sql`` tagged-template shim for local/offline
// Docker instances or traditional PostgreSQL servers.
//   - `sql`  → tagged template literal for schema init
//   - `query` / `transaction` → parameterized queries for repositories (pg compat)
// =============================================================================

const env = require('./env');
const logger = require('../utils/logger');

const isNeon = env.DATABASE_URL && env.DATABASE_URL.includes('neon.tech');

let sql;
let pool;

if (isNeon) {
  logger.info('Initializing Neon Serverless database driver');
  const { neon, Pool } = require('@neondatabase/serverless');
  sql = neon(env.DATABASE_URL);
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
} else {
  logger.info('Initializing standard PostgreSQL (pg) driver for local/containerized database');
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Tagged template literal shim to mirror neon() behaviour
  sql = async function (strings, ...values) {
    if (typeof strings === 'string') {
      const res = await pool.query(strings, values[0] || []);
      return res.rows;
    }
    let queryText = strings[0];
    for (let i = 1; i < strings.length; i++) {
      queryText += `$${i}` + strings[i];
    }
    const res = await pool.query(queryText, values);
    return res.rows;
  };
}

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

/**
 * Execute a parameterized query against the pool.
 * @param {string} text - SQL query text with $1, $2, ... placeholders
 * @param {Array}  params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool for transaction support.
 * Caller MUST call client.release() when done.
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = () => pool.connect();

/**
 * Run a function inside a database transaction.
 * Automatically commits on success, rolls back on error.
 * @param {function(import('pg').PoolClient): Promise<*>} fn
 * @returns {Promise<*>}
 */
const transaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Test the database connection and verify PostGIS.
 */
const testConnection = async () => {
  try {
    const res = await sql`SELECT NOW() AS now`;
    logger.info({ time: res[0].now }, 'Database connection verified');

    // Check PostGIS
    try {
      const postgis = await sql`SELECT PostGIS_Version() AS version`;
      logger.info({ postgis: postgis[0].version }, 'PostGIS extension available');
    } catch {
      logger.warn('PostGIS extension not available — spatial queries will fail');
    }

    return true;
  } catch (err) {
    logger.error({ err }, 'Database connection failed');
    return false;
  }
};

/**
 * Gracefully close the pool.
 */
const close = () => pool.end();

module.exports = {
  sql,
  pool,
  query,
  getClient,
  transaction,
  testConnection,
  close,
};
