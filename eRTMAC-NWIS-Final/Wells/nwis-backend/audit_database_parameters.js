require('dotenv').config();
const { Client } = require('pg');

async function inspectNulls() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const tables = [
    'wells', 'formations', 'well_formations', 'drilling_events',
    'drilling_parameters', 'mitigations', 'documents', 'document_chunks',
    'extracted_entities', 'well_trajectories', 'risk_predictions', 'alerts'
  ];

  console.log('=== 1. ROW COUNTS & POPULATION AUDIT ===');
  for (const t of tables) {
    const res = await client.query('SELECT count(*) FROM ' + t);
    console.log(t.padEnd(20) + ': ' + res.rows[0].count + ' rows');
  }

  console.log('\n=== 2. COLUMN POPULATION AUDIT ===');
  // Check wells
  const wellsNulls = await client.query(`
    SELECT 
      count(*) as total,
      count(spud_date) as has_spud_date,
      count(total_depth) as has_total_depth,
      count(current_depth) as has_current_depth,
      count(current_formation_id) as has_current_formation_id,
      count(location) as has_location,
      count(metadata) as has_metadata
    FROM wells;
  `);
  console.log('Wells columns:', wellsNulls.rows[0]);

  // Check drilling_parameters
  const paramNulls = await client.query(`
    SELECT 
      count(*) as total,
      count(depth) as has_depth,
      count(wob) as has_wob,
      count(rpm) as has_rpm,
      count(torque) as has_torque,
      count(rop) as has_rop,
      count(mud_weight) as has_mud_weight,
      count(mud_flow_rate) as has_mud_flow,
      count(standpipe_pressure) as has_spp,
      count(annular_pressure) as has_annular,
      count(hook_load) as has_hook_load
    FROM drilling_parameters;
  `);
  console.log('Parameters columns:', paramNulls.rows[0]);

  // Check document_chunks embeddings
  const chunkNulls = await client.query(`
    SELECT 
      count(*) as total,
      count(embedding) as has_embedding
    FROM document_chunks;
  `);
  console.log('Document chunks embeddings:', chunkNulls.rows[0]);

  // Check well_trajectories count per well
  const trajPerWell = await client.query(`
    SELECT well_id, count(*) as count 
    FROM well_trajectories 
    GROUP BY well_id;
  `);
  console.log('Wells with trajectories:', trajPerWell.rows.length, 'wells');

  // Check formations
  const formRes = await client.query(`SELECT id, name, description, geological_attributes FROM formations`);
  console.log('\n=== 3. FORMATIONS IN DATABASE ===');
  console.log(formRes.rows);

  // Check drilling_parameters wells coverage
  const paramWells = await client.query(`
    SELECT w.well_name, count(dp.id) as param_count 
    FROM wells w 
    LEFT JOIN drilling_parameters dp ON w.id = dp.well_id 
    GROUP BY w.well_name 
    HAVING count(dp.id) > 0;
  `);
  console.log('\n=== 4. WELLS WITH DRILLING PARAMETERS ===');
  console.log(paramWells.rows);

  await client.end();
}

inspectNulls().catch(console.error);
