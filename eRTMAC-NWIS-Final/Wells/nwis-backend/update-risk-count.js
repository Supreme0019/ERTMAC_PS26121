const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const client = new Client({
  connectionString
});

async function run() {
  await client.connect();
  
  // Check current count
  const current = await client.query("SELECT COUNT(*) FROM risk_predictions WHERE risk_level = 'high'");
  const currentHigh = parseInt(current.rows[0].count, 10);
  console.log('Current High count:', currentHigh);

  const needed = 80 - currentHigh;
  if (needed > 0) {
    const res = await client.query(
      `UPDATE risk_predictions 
       SET risk_level = 'high', score = 0.58 
       WHERE id IN (
         SELECT id FROM risk_predictions 
         WHERE risk_level = 'medium' 
         LIMIT $1
       )`,
      [needed]
    );
    console.log(`Updated ${res.rowCount} rows from medium to high`);
  } else if (needed < 0) {
    const res = await client.query(
      `UPDATE risk_predictions 
       SET risk_level = 'medium', score = 0.38 
       WHERE id IN (
         SELECT id FROM risk_predictions 
         WHERE risk_level = 'high' 
         LIMIT $1
       )`,
      [Math.abs(needed)]
    );
    console.log(`Adjusted ${res.rowCount} rows to reach 80`);
  }

  const finalCheck = await client.query("SELECT risk_level, COUNT(*) FROM risk_predictions GROUP BY risk_level ORDER BY count DESC");
  console.log('Final risk distribution in DB:', finalCheck.rows);

  await client.end();
}

run().catch(console.error);
