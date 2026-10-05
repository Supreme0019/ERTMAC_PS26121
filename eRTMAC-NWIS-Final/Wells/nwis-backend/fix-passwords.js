const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}

async function fix() {
  const c = new Client({ connectionString });
  await c.connect();
  const hash = await bcrypt.hash('NwisDemo2026!', 10);
  const res = await c.query("UPDATE users SET password_hash = $1 WHERE email LIKE '%@%'", [hash]);
  console.log('Updated rows:', res.rowCount);
  await c.end();
}

fix().catch(console.error);
