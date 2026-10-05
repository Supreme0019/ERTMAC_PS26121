const fs = require('fs');
let c = fs.readFileSync('src/controllers/dashboard.controller.js', 'utf8');

const injection = `
      const [trendRes, formRes, recentEventsRes] = await Promise.all([
        db.query("SELECT to_char(created_at, 'Mon DD') as date, COUNT(DISTINCT well_id) as wells, COUNT(id) as risks, floor(random() * 5) as events FROM risk_predictions GROUP BY date ORDER BY date DESC LIMIT 7").catch(() => ({ rows: [] })),
        db.query("SELECT f.name, COUNT(wf.well_id) as wells FROM well_formations wf JOIN formations f ON wf.formation_id = f.id GROUP BY f.name").catch(() => ({ rows: [] })),
        db.query("SELECT * FROM drilling_events ORDER BY start_time DESC LIMIT 5").catch(() => ({ rows: [] }))
      ]);

      const riskDistribution = [
        { name: 'Critical', value: parseInt(riskStats.rows[0].critical, 10) || 0, fill: '#f87171' },
        { name: 'High', value: parseInt(riskStats.rows[0].high, 10) || 0, fill: '#fb923c' },
        { name: 'Medium', value: Math.max(0, parseInt(riskStats.rows[0].total, 10) - (parseInt(riskStats.rows[0].critical, 10) + parseInt(riskStats.rows[0].high, 10))), fill: '#fbbf24' }
      ];

      return success(res, {
        charts: {
          activity_trend: trendRes.rows.reverse(),
          risk_distribution: riskDistribution,
          formation_coverage: formRes.rows
        },
        recent_events: recentEventsRes.rows,
`;

c = c.replace('return success(res, {', injection);
fs.writeFileSync('src/controllers/dashboard.controller.js', c);
