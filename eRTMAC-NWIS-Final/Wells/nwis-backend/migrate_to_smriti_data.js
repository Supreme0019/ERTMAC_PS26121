require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATA_DIR = path.resolve(__dirname, '../../../final ai/data/synthetic');
const REPORTS_DIR = path.resolve(__dirname, '../../../final ai/data/reports');

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const row = [];
    let inQuotes = false;
    let cur = '';

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    row.push(cur.trim());
    
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] || '';
    });
    rows.push(obj);
  }
  return rows;
}

// Generate deterministic UUID for SYN-xxx
function getSynWellUUID(index) {
  const hex = index.toString(16).padStart(4, '0');
  return `c0000000-0000-0000-0000-00000000${hex}`;
}

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to Neon PostgreSQL database.');

  try {
    await client.query('BEGIN');

    // ──────────────────────────────────────────────────────────────────────────
    // Step 1: Clean out the old dataset
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 1: Deleting previous wells data ---');
    await client.query('DELETE FROM alerts');
    await client.query('DELETE FROM risk_predictions');
    await client.query('DELETE FROM mitigations');
    await client.query('DELETE FROM drilling_events');
    await client.query('DELETE FROM drilling_parameters');
    await client.query('DELETE FROM well_trajectories');
    await client.query('DELETE FROM document_chunks');
    await client.query('DELETE FROM extracted_entities');
    await client.query('DELETE FROM documents');
    await client.query('DELETE FROM well_formations');
    await client.query('DELETE FROM wells');
    await client.query('DELETE FROM formations');
    console.log('Successfully cleared all previous wells, formations, events, and parameters.');

    // ──────────────────────────────────────────────────────────────────────────
    // Step 2: Insert Formations from formations.csv
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 2: Inserting Formations ---');
    const formationsData = parseCSV(path.join(DATA_DIR, 'formations.csv'));
    const formationMap = new Map(); // name -> UUID

    const formationUUIDs = {
      'Formation A': 'f1000000-0000-0000-0000-000000000001',
      'Formation B': 'f1000000-0000-0000-0000-000000000002',
      'Formation C': 'f1000000-0000-0000-0000-000000000003',
      'Formation X': 'f1000000-0000-0000-0000-000000000004',
      'Formation Y': 'f1000000-0000-0000-0000-000000000005',
    };

    for (const f of formationsData) {
      const id = formationUUIDs[f.formation] || `f1000000-0000-0000-0000-${Math.random().toString(16).slice(2, 14)}`;
      formationMap.set(f.formation, id);

      const attrs = {
        lithology: f.lithology || '',
        risk_factors: f.risk_factors || '',
        top_depth: parseFloat(f.top_depth) || 0,
        bottom_depth: parseFloat(f.bottom_depth) || 0
      };

      await client.query(`
        INSERT INTO formations (id, name, description, geological_attributes, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [id, f.formation, `${f.formation} (${f.lithology || 'mixed'})`, JSON.stringify(attrs)]);
      console.log(`Inserted formation: ${f.formation} -> ${id}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 3: Insert Wells from wells.csv
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 3: Inserting Wells ---');
    const wellsData = parseCSV(path.join(DATA_DIR, 'wells.csv'));
    const wellMap = new Map(); // well_name / well_id -> UUID

    // The primary active demo well in the frontend defaults to b1000000-0000-0000-0000-000000000001
    const DEMO_WELL_ID = 'b1000000-0000-0000-0000-000000000001';

    let synIndex = 0;
    for (const w of wellsData) {
      let wellId;
      let status = w.status === 'drilling' ? 'active' : (w.status || 'completed');
      let currentDepth = parseFloat(w.total_depth) || 3000;
      let currentFormationId = formationMap.get('Formation Y');

      if (w.well_name === 'WELL-A-102') {
        wellId = DEMO_WELL_ID;
        status = 'active';
        currentDepth = 2740; // Active depth in Formation X (matching active_replay.csv)
        currentFormationId = formationMap.get('Formation X');
      } else {
        wellId = getSynWellUUID(synIndex++);
      }

      wellMap.set(w.id, wellId);
      wellMap.set(w.well_name, wellId);

      const lat = parseFloat(w.latitude);
      const lng = parseFloat(w.longitude);
      const totalDepth = parseFloat(w.total_depth);

      const metadata = {
        original_id: w.id,
        well_type: w.well_type || 'directional',
        avg_inclination: parseFloat(w.avg_inclination) || 0,
        is_synthetic: true
      };

      await client.query(`
        INSERT INTO wells (
          id, well_name, field, status, latitude, longitude, location,
          spud_date, total_depth, current_depth, current_formation_id, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography,
          $7, $8, $9, $10, $11, NOW(), NOW()
        )
      `, [
        wellId,
        w.well_name,
        w.field || 'SYNTH-FIELD',
        status,
        lat,
        lng,
        '2025-06-01',
        totalDepth,
        currentDepth,
        currentFormationId,
        JSON.stringify(metadata)
      ]);
    }
    console.log(`Inserted ${wellsData.length} wells successfully (Active Demo: WELL-A-102 -> ${DEMO_WELL_ID}).`);

    // ──────────────────────────────────────────────────────────────────────────
    // Step 4: Insert Well Formations from well_formations.csv
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 4: Inserting Well Formations ---');
    const wfData = parseCSV(path.join(DATA_DIR, 'well_formations.csv'));
    let wfCount = 0;

    for (const wf of wfData) {
      const wellId = wellMap.get(wf.well_id);
      const formationId = formationMap.get(wf.formation);

      if (wellId && formationId) {
        await client.query(`
          INSERT INTO well_formations (well_id, formation_id, top_depth, bottom_depth)
          VALUES ($1, $2, $3, $4)
        `, [wellId, formationId, parseFloat(wf.top_depth), parseFloat(wf.bottom_depth)]);
        wfCount++;
      }
    }

    // Add well_formations for WELL-A-102 if missing
    if (!wfData.some(d => d.well_id === 'WELL-A-102')) {
      const wellAId = wellMap.get('WELL-A-102');
      const defaultIntervals = [
        { f: 'Formation A', top: 0, btm: 820 },
        { f: 'Formation B', top: 820, btm: 1820 },
        { f: 'Formation C', top: 1820, btm: 2520 },
        { f: 'Formation X', top: 2520, btm: 3120 },
        { f: 'Formation Y', top: 3120, btm: 3500 },
      ];
      for (const inv of defaultIntervals) {
        const fid = formationMap.get(inv.f);
        if (fid) {
          await client.query(`
            INSERT INTO well_formations (well_id, formation_id, top_depth, bottom_depth)
            VALUES ($1, $2, $3, $4)
          `, [wellAId, fid, inv.top, inv.btm]);
          wfCount++;
        }
      }
    }
    console.log(`Inserted ${wfCount} well formation intervals.`);

    // ──────────────────────────────────────────────────────────────────────────
    // Step 5: Insert Events & Mitigations from events_truth.csv
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 5: Inserting Drilling Events & Mitigations ---');
    const eventsData = parseCSV(path.join(DATA_DIR, 'events_truth.csv'));
    let eventCount = 0;
    let mitigationCount = 0;

    for (const ev of eventsData) {
      const wellId = wellMap.get(ev.well_id);
      const formationId = formationMap.get(ev.formation);
      const depth = parseFloat(ev.depth) || 0;

      if (!wellId) continue;

      const desc = `${ev.event_type.replace(/_/g, ' ')} of severity ${ev.severity} encountered at ${depth}m in ${ev.formation}.`;
      const metadata = {
        synthetic_event_id: ev.event_id,
        outcome: ev.outcome || 'drilling resumed'
      };

      const evRes = await client.query(`
        INSERT INTO drilling_events (
          well_id, formation_id, depth, event_type, severity, description,
          start_time, end_time, confidence, metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          NOW() - INTERVAL '30 days', NOW() - INTERVAL '29 days', 0.95, $7, NOW()
        ) RETURNING id
      `, [wellId, formationId, depth, ev.event_type, ev.severity, desc, JSON.stringify(metadata)]);

      eventCount++;
      const eventUUID = evRes.rows[0].id;

      if (ev.mitigation) {
        await client.query(`
          INSERT INTO mitigations (event_id, action, outcome, notes, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [
          eventUUID,
          ev.mitigation,
          ev.outcome || 'drilling resumed',
          `Historical mitigation logged for ${ev.well_id} in ${ev.formation}`
        ]);
        mitigationCount++;
      }
    }
    console.log(`Inserted ${eventCount} drilling events and ${mitigationCount} mitigations.`);

    // ──────────────────────────────────────────────────────────────────────────
    // Step 6: Insert Active Replay & Telemetry Parameters
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 6: Inserting Telemetry & Replay Parameters ---');
    const replayData = parseCSV(path.join(DATA_DIR, 'active_replay.csv'));
    const wellAId = wellMap.get('WELL-A-102');

    let paramCount = 0;
    for (const r of replayData) {
      const depth = parseFloat(r.depth);
      const wob = parseFloat(r.wob);
      const rpm = parseFloat(r.rpm);
      const torque = parseFloat(r.torque);
      const rop = parseFloat(r.rop);
      const pressure = parseFloat(r.pressure);
      const mudFlow = parseFloat(r.mud_flow);
      const mudLoss = parseFloat(r.mud_loss) || 0;
      const mudWeight = 1.15 + (mudLoss * 0.1);

      await client.query(`
        INSERT INTO drilling_parameters (
          well_id, timestamp, depth, wob, rpm, torque, rop,
          mud_weight, mud_flow_rate, standpipe_pressure, hook_load
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
      `, [
        wellAId,
        r.ts || new Date().toISOString(),
        depth,
        wob,
        rpm,
        torque,
        rop,
        mudWeight,
        mudFlow,
        pressure,
        185.0
      ]);
      paramCount++;
    }
    console.log(`Inserted ${paramCount} replay telemetry frames for WELL-A-102.`);

    // ──────────────────────────────────────────────────────────────────────────
    // Step 7: Insert DDR Documents
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 7: Registering DDR Documents & Chunks ---');
    const reportsTruth = parseCSV(path.join(DATA_DIR, 'reports_truth.csv'));
    const adminUser = await client.query("SELECT id FROM users WHERE role = 'SYSTEM_ADMIN' OR email LIKE '%oilindia%' LIMIT 1");
    const uploaderId = adminUser.rows[0]?.id || null;

    let docCount = 0;
    let chunkCount = 0;

    // Wells that have scanned DDRs (_ddr_scan.pdf instead of _ddr.pdf)
    const SCAN_WELLS = new Set(['SYN-001', 'SYN-003', 'SYN-005', 'SYN-011', 'SYN-019', 'SYN-022', 'SYN-035', 'SYN-037']);

    // Collect all SYN-xxx well names that we inserted
    const synWellNames = wellsData
      .map(w => w.well_name)
      .filter(n => /^SYN-\d{3}$/.test(n));

    for (const synName of synWellNames) {
      const targetWellId = wellMap.get(synName);
      if (!targetWellId) continue;

      const pdfName = SCAN_WELLS.has(synName) ? `${synName}_ddr_scan.pdf` : `${synName}_ddr.pdf`;
      const docRes = await client.query(`
        INSERT INTO documents (
          well_id, document_type, original_filename, file_uri, document_date,
          ocr_status, processing_status, uploaded_by, page_count, created_at
        ) VALUES (
          $1, 'daily_drilling_report', $2, $3, '2026-08-15',
          'completed', 'completed', $4, 5, NOW()
        ) RETURNING id
      `, [targetWellId, pdfName, `data/reports/${pdfName}`, uploaderId]);

      docCount++;
      const docId = docRes.rows[0].id;

      // Add corresponding chunk
      const relatedReports = reportsTruth.filter(rt => rt.well_id === synName);
      let chunkText = `Daily Drilling Report for ${synName}. Drilled through Formation X (fractured sandstone) and Formation Y.`;
      if (relatedReports.length > 0) {
        chunkText += ` Significant incidents recorded: ${relatedReports.map(r => `${r.event_type} at ${r.depth}m in ${r.section}`).join(', ')}.`;
      } else {
        chunkText += ` Routine drilling operations completed with stable mud weight and circulation parameters.`;
      }

      await client.query(`
        INSERT INTO document_chunks (
          document_id, well_id, page, section, chunk_index, text, confidence, created_at
        ) VALUES (
          $1, $2, 1, 'Daily Operations', 0, $3, 0.96, NOW()
        )
      `, [docId, targetWellId, chunkText]);
      chunkCount++;
    }
    console.log(`Inserted ${docCount} documents and ${chunkCount} document chunks.`);

    // ──────────────────────────────────────────────────────────────────────────
    // Step 8: Trajectories
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 8: Inserting Trajectories ---');
    let trajCount = 0;
    const depths = [0, 500, 1000, 1500, 2000, 2500, 2740, 3000, 3500];
    for (const d of depths) {
      const inc = (d / 3500) * 32.0;
      await client.query(`
        INSERT INTO well_trajectories (
          well_id, measured_depth, tvd, latitude, longitude, inclination, azimuth, trajectory_point, created_at
        ) VALUES (
          $1, $2, $3, 27.35, 95.3, $4, 135.0, ST_SetSRID(ST_MakePoint(95.3, 27.35), 4326)::geography, NOW()
        )
      `, [wellAId, d, d * 0.96, inc]);
      trajCount++;
    }
    console.log(`Inserted ${trajCount} trajectory points for WELL-A-102.`);

    await client.query('COMMIT');
    console.log('\n============================================================');
    console.log('✅ COMPLETE OPTION A MIGRATION SUCCESSFUL!');
    console.log(`- Wells: ${wellsData.length} (Active: WELL-A-102)`);
    console.log(`- Formations: ${formationsData.length}`);
    console.log(`- Formation Intervals: ${wfCount}`);
    console.log(`- Drilling Events: ${eventCount}`);
    console.log(`- Mitigations: ${mitigationCount}`);
    console.log(`- Telemetry Frames: ${paramCount}`);
    console.log(`- Documents & Chunks: ${docCount} / ${chunkCount}`);
    console.log('============================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back changes:', err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
