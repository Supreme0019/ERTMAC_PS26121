const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}

async function f() {
  const c = new Client({ connectionString });
  await c.connect();
  for (const t of ['drilling_events', 'drilling_parameters', 'well_trajectories', 'well_formations', 'risk_predictions', 'document_chunks', 'extracted_entities', 'mitigations']) {
    const r = await c.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', [t]);
    console.log('\n=== ' + t + ' ===');
    r.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));
  }
  await c.end();
}
f();
