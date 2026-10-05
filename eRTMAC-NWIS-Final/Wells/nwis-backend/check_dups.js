const db = require('./src/config/database');
(async () => {
  const dups = await db.query(`
    SELECT a.id as a_id, b.id as b_id, a.well_id, a.risk_type, a.depth,
      EXISTS(SELECT 1 FROM alerts WHERE risk_prediction_id = a.id) as a_in_alerts,
      EXISTS(SELECT 1 FROM alerts WHERE risk_prediction_id = b.id) as b_in_alerts
    FROM risk_predictions a
    JOIN risk_predictions b ON a.ctid < b.ctid AND a.well_id = b.well_id AND a.risk_type = b.risk_type AND floor(a.depth / 25) = floor(b.depth / 25)
  `);
  console.log('Duplicates count:', dups.rows.length);
  console.log(JSON.stringify(dups.rows, null, 2));
  process.exit(0);
})();
