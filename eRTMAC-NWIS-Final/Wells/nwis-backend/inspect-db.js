const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}

async function inspect() {
  const c = new Client({ connectionString });
  await c.connect();

  // List tables
  const tables = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  console.log('=== TABLES ===');
  tables.rows.forEach(r => console.log(r.table_name));

  // Count rows in each table
  console.log('\n=== ROW COUNTS ===');
  for (const r of tables.rows) {
    try {
      const count = await c.query(`SELECT COUNT(*) as cnt FROM "${r.table_name}"`);
      console.log(`${r.table_name}: ${count.rows[0].cnt}`);
    } catch(e) { console.log(`${r.table_name}: ERROR - ${e.message}`); }
  }

  // Check columns of key tables
  for (const tbl of ['formations', 'events', 'documents', 'parameters', 'trajectories', 'wells', 'alerts', 'risks', 'audit_logs']) {
    try {
      const cols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [tbl]);
      console.log(`\n=== ${tbl.toUpperCase()} COLUMNS ===`);
      cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    } catch(e) { console.log(`\n=== ${tbl} ERROR: ${e.message}`); }
  }

  // Check wells
  const wells = await c.query('SELECT id, well_name, field, status, current_depth FROM wells ORDER BY well_name');
  console.log('\n=== WELLS ===');
  wells.rows.forEach(r => console.log(`${r.id} | ${r.well_name} | ${r.field} | ${r.status} | depth:${r.current_depth}`));

  await c.end();
}

inspect().catch(console.error);
