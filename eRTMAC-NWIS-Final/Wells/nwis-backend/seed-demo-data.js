// =============================================================================
// NWIS Backend — Deterministic Demo Data Seeder
// =============================================================================
// Seeds realistic, correlated, deterministic drilling telemetry, real document
// texts, and consistent formation horizons for Upper Assam Basin wells.
// =============================================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}

/**
 * Deterministic correlated drilling parameters generator.
 * Produces realistic telemetry where Torque, ROP, and SPP are physically coupled.
 */
function generateDeterministicParams(index, baseDepth, isDeep = true) {
  const depth = +(baseDepth + index * 0.5).toFixed(1);
  const cycle = Math.sin(index * 0.18);
  const trend = index / 100;

  if (isDeep) {
    // Deep drilling (2800m+ in Kopili Formation):
    // WOB roughly 50–200 kN (target ~95-155 kN)
    const wob = +(105 + 35 * cycle + 15 * trend).toFixed(1);

    // Hook Load roughly 800–1500 kN (target ~1150-1280 kN)
    // Hook load decreases as WOB increases due to string weight transfer to bit
    const hook = +(1220 - 35 * cycle + 25 * trend).toFixed(1);

    // Correlated: Torque, ROP, Standpipe Pressure move together
    const loadFactor = (cycle + 1) / 2;
    const torque = +(20 + 10 * loadFactor + 4 * trend).toFixed(1); // 20 to 34 kN·m
    const rop = +(7.5 + 3.5 * loadFactor - 1.5 * trend).toFixed(1); // 6.0 to 11.0 m/hr
    const spp = +(215 + 30 * loadFactor + 8 * trend).toFixed(1); // 215 to 253 bar

    const rpm = +(110 - 15 * loadFactor).toFixed(0);
    const mudWeight = +(1.20 + 0.03 * trend).toFixed(2); // 1.20 to 1.23 sg
    const flowRate = +(2150 + 70 * cycle).toFixed(0);
    const ann = +(24 + 4 * cycle).toFixed(1);

    return { depth, wob, rpm, torque, rop, mudWeight, flowRate, spp, ann, hook };
  } else {
    // Shallow drilling (Digboi 1750m in Tipam):
    const wob = +(80 + 20 * cycle).toFixed(1);
    const hook = +(980 - 20 * cycle).toFixed(1);
    const torque = +(16 + 4 * cycle).toFixed(1);
    const rop = +(9.0 + 2.0 * cycle).toFixed(1);
    const spp = +(195 + 15 * cycle).toFixed(1);
    const rpm = 115;
    const mudWeight = 1.15;
    const flowRate = 2050;
    const ann = 20.0;

    return { depth, wob, rpm, torque, rop, mudWeight, flowRate, spp, ann, hook };
  }
}

async function seed() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Fetch wells
    const wellRes = await client.query(
      `SELECT id, well_name FROM wells WHERE well_name IN ('NWIS-DEMO-01', 'DGB-A-201', 'LKW-A-102', 'LKW-B-201')`
    );
    const wells = {};
    wellRes.rows.forEach((r) => (wells[r.well_name] = r.id));
    const nwisWellId = wells['NWIS-DEMO-01'];
    const dgbWellId = wells['DGB-A-201'];
    const lkwAId = wells['LKW-A-102'];
    const lkwBId = wells['LKW-B-201'];

    if (!nwisWellId) {
      console.warn('NWIS-DEMO-01 not found. Schema must be initialized first.');
      return;
    }

    // 1. Official Field Documents with Distinct Real Text
    const documents = [
      {
        id: 'd1000000-0000-0000-0000-000000000001',
        well_id: nwisWellId,
        type: 'daily_report',
        name: 'Daily Drilling Report - NWIS-DEMO-01 - 2026-08-15.pdf',
        date: '2026-08-15',
        pages: 6,
        text_length: 14200,
        text: 'DAILY DRILLING REPORT (24 HR OPS): Drilled 8-1/2" hole from 2,800 m to 2,850 m MD penetrating Kopili Formation splintery carbonaceous shale. Fluid properties maintained at 1.22 sg mud weight, 52 sec/qt funnel viscosity. Average penetration rate recorded at 7.2 m/hr with 115 kN WOB and 105 RPM. Standpipe pressure steady at 235 bar with background gas levels at 1.8% to 2.4%. Zero fluid losses observed during connections.',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000002',
        well_id: lkwAId || nwisWellId,
        type: 'mud_log',
        name: 'Mud Log Report - LKW-A-102.pdf',
        date: '2024-05-15',
        pages: 14,
        text_length: 28500,
        text: 'MUD LOGGING INTERVAL 2,750 m – 2,900 m: Lithological transition from Barail coal measures into dark grey fissile Kopili shales with thin calcareous siltstone stringers. Observed partial mud losses of 45 bbl/hr at 2,810 m MD. Gas chromatography detected peak total gas of 8.2% C1 with traces of C2-C3.',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000003',
        well_id: lkwBId || nwisWellId,
        type: 'completion_report',
        name: 'Well Completion Report - LKW-B-201.pdf',
        date: '2023-11-20',
        pages: 22,
        text_length: 42100,
        text: 'WELL COMPLETION AND TESTING RECORD: Total depth reached at 3,050 m in Sylhet Limestone. 7" production liner landed at 3,045 m and cemented with Class G cement. Perforated interval 2,840 m – 2,865 m across transition reservoir sand. Stabilized flow test recorded 380 BOPD on 16/64" choke with 85 psi FTP.',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000004',
        well_id: nwisWellId,
        type: 'geological_survey',
        name: 'Geological Survey - Lakwa Field 2025.pdf',
        date: '2025-06-10',
        pages: 35,
        text_length: 68400,
        text: 'UPPER ASSAM BASIN STRATIGRAPHIC EVALUATION: The Lakwa Field structure is a gently dipping anticline. Conformable stratigraphy progresses downwards from Girujan Clay regional cap rock (0–750m) through Tipam Sandstone reservoir (750–1400m), Barail Group coal measures (1400–2200m), into marine Kopili Formation shales (2200–2950m) and basement Sylhet Limestone (>2950m).',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000005',
        well_id: nwisWellId,
        type: 'formation_evaluation',
        name: 'Formation Evaluation Report - Barail Series.pdf',
        date: '2025-09-18',
        pages: 18,
        text_length: 33800,
        text: 'PETROPHYSICAL FORMATION EVALUATION: Wireline log analysis across the Barail Group interval (1400–2200m MD) yields average effective porosity of 18.5%, water saturation of 32%, and net-to-gross ratio of 0.65. Permeability ranges between 80 to 220 mD in main channel sands.',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000006',
        well_id: nwisWellId,
        type: 'incident_report',
        name: 'Stuck Pipe Incident Report - NWIS-DEMO-01.pdf',
        date: '2026-08-10',
        pages: 8,
        text_length: 16200,
        text: 'OFFICIAL INCIDENT REPORT: At 2835m depth in the Kopili Formation, the drill string experienced differential sticking while penetrating a reactive claystone interval. Jarring operations initiated with 65,000 lbs upward impact. String freed after 45 minutes of continuous jarring and spotting lubricity pill. Mud weight adjusted from 1.18 to 1.22 sg to stabilize borehole.',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000007',
        well_id: nwisWellId,
        type: 'analysis_report',
        name: 'Lost Circulation Analysis - Lakwa Field.pdf',
        date: '2025-11-04',
        pages: 12,
        text_length: 22900,
        text: 'LOST CIRCULATION RISK ASSESSMENT: Analysis of historical offset data indicates high vulnerability to fluid losses in the Kopili Formation between 2,810 m and 2,870 m MD. Recommended engineering mitigation requires pre-mixing 150 bbl of coarse calcium carbonate and walnut shell LCM pills prior to entering the 2,800 m horizon.',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000008',
        well_id: nwisWellId,
        type: 'bha_report',
        name: 'BHA Configuration Report - NWIS-DEMO-01.pdf',
        date: '2026-08-01',
        pages: 5,
        text_length: 9800,
        text: 'BOTTOM HOLE ASSEMBLY RECORD (8-1/2" HOLE): 8-1/2" PDC Bit (5-blade 16mm cutters), 6-3/4" 7/8 lobe 5.0 stage mud motor (1.5 deg bend), Float sub, 6-3/4" PWD/MWD collar, Hydraulic drilling jar placed at 120m above bit, 6x 6-1/2" drill collars, 15 stands 5" HWDP.',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000009',
        well_id: nwisWellId,
        type: 'procedure_manual',
        name: 'Kick Detection Procedure Manual.pdf',
        date: '2025-01-15',
        pages: 28,
        text_length: 51200,
        text: 'WELL CONTROL OPERATIONAL PROCEDURES: In event of pit volume gain ≥ 5 bbl or flow check positive on pump shutdown, immediately space out tool joint above rotary table, shut in annular preventer, and open choke line to remote manifold. Record initial shut-in drillpipe pressure (SIDPP) and shut-in casing pressure (SICP).',
      },
      {
        id: 'd1000000-0000-0000-0000-000000000010',
        well_id: dgbWellId || nwisWellId,
        type: 'casing_report',
        name: 'Casing Design Report - DGB-A-201.pdf',
        date: '2026-07-05',
        pages: 10,
        text_length: 19400,
        text: 'CASING & SHOE INTEGRITY REPORT: 13-3/8" surface casing set at 450 m in Girujan Clay; 9-5/8" intermediate string set at 1,800 m in Tipam Sandstone reservoir. Pressure leak-off test (LOT) confirmed shoe integrity to 1.65 sg EMW equivalent.',
      },
    ];

    let docCount = 0;
    for (const doc of documents) {
      const res = await client.query(
        `INSERT INTO documents (id, well_id, document_type, original_filename, file_uri, document_date, version, ocr_status, processing_status, checksum, uploaded_by, page_count, text_length, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         ON CONFLICT (id) DO UPDATE SET
           original_filename = EXCLUDED.original_filename,
           document_date = EXCLUDED.document_date,
           ocr_status = EXCLUDED.ocr_status,
           processing_status = EXCLUDED.processing_status,
           page_count = EXCLUDED.page_count,
           text_length = EXCLUDED.text_length`,
        [
          doc.id,
          doc.well_id,
          doc.type,
          doc.name,
          `s3://nwis-documents/${doc.name.replace(/ /g, '_')}`,
          doc.date,
          1,
          'completed',
          'completed',
          'abcd1234efgh5678',
          'a1000000-0000-0000-0000-000000000001',
          doc.pages,
          doc.text_length,
        ]
      );
      docCount += res.rowCount;
    }
    console.log(`Seeded ${docCount} official documents with real text.`);

    // 2. Deterministic Document Chunks
    let chunkCount = 0;
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const chunkId = `dc100000-0000-0000-0000-${i.toString().padStart(12, '0')}`;
      const res = await client.query(
        `INSERT INTO document_chunks (id, document_id, page, section, chunk_index, text, confidence, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (id) DO UPDATE SET
           text = EXCLUDED.text,
           confidence = EXCLUDED.confidence`,
        [
          chunkId,
          doc.id,
          1,
          'Executive Summary',
          0,
          doc.text,
          0.98, // Deterministic fixed confidence
          JSON.stringify({ extracted_via: 'ocr_verified', field: 'Lakwa' }),
        ]
      );
      chunkCount += res.rowCount;
    }
    console.log(`Seeded ${chunkCount} verified document chunks.`);

    // 3. Extracted Entities (Consistent with Kopili Formation at 2835m)
    const entities = [
      ['DEPTH', '2835m', '2835'],
      ['FORMATION', 'Kopili Formation', 'kopili'], // Consistent with well_formations & events
      ['MUD_WEIGHT', '1.22 sg', '1.22'],
      ['EVENT_TYPE', 'stuck pipe', 'stuck_pipe'],
      ['WELL_NAME', 'NWIS-DEMO-01', 'nwis-demo-01'],
      ['EQUIPMENT', 'PDC Bit 8.5 inch', 'pdc_bit_8.5'],
      ['PRESSURE', '235 bar', '235'],
      ['TEMPERATURE', '88 C', '88'],
      ['FIELD', 'Lakwa Field', 'lakwa'],
    ];

    let entCount = 0;
    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      const entId = `ee100000-0000-0000-0000-${i.toString().padStart(12, '0')}`;
      const res = await client.query(
        `INSERT INTO extracted_entities (id, document_id, entity_type, value, normalized_value, confidence, page, source_location, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           value = EXCLUDED.value,
           normalized_value = EXCLUDED.normalized_value,
           confidence = EXCLUDED.confidence`,
        [
          entId,
          'd1000000-0000-0000-0000-000000000006',
          ent[0],
          ent[1],
          ent[2],
          0.97, // Deterministic confidence
          1,
          'body_paragraph',
          JSON.stringify({ algo: 'ner_v2' }),
        ]
      );
      entCount += res.rowCount;
    }
    console.log(`Seeded ${entCount} verified extracted entities.`);

    // 4. Deterministic Drilling Parameters (Correlated: WOB 50–200 kN, Hook 800–1500 kN, Torque/ROP/SPP correlated)
    let dpCount = 0;
    if (nwisWellId) {
      // Clear previous seed parameters for this time window so seed is idempotent and replaces old unrealistic numbers
      await client.query(
        `DELETE FROM drilling_parameters 
         WHERE well_id = $1 AND (additional_parameters->>'source' = 'telemetry_seed' OR (timestamp >= '2026-08-10T10:00:00Z' AND timestamp <= '2026-08-10T19:00:00Z'))`,
        [nwisWellId]
      );

      let timestamp = new Date('2026-08-10T10:00:00Z');
      for (let i = 0; i <= 100; i++) {
        const p = generateDeterministicParams(i, 2800, true);
        timestamp = new Date(timestamp.getTime() + 5 * 60000);

        const res = await client.query(
          `INSERT INTO drilling_parameters (well_id, timestamp, depth, wob, rpm, torque, rop, mud_weight, mud_flow_rate, standpipe_pressure, annular_pressure, hook_load, additional_parameters)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            nwisWellId,
            timestamp,
            p.depth,
            p.wob,
            p.rpm,
            p.torque,
            p.rop,
            p.mudWeight,
            p.flowRate,
            p.spp,
            p.ann,
            p.hook,
            JSON.stringify({ source: 'telemetry_seed' }),
          ]
        );
        dpCount += res.rowCount;
      }
    }

    if (dgbWellId) {
      await client.query(
        `DELETE FROM drilling_parameters 
         WHERE well_id = $1 AND (additional_parameters->>'source' = 'telemetry_seed' OR (timestamp >= '2026-08-12T08:00:00Z' AND timestamp <= '2026-08-12T17:00:00Z'))`,
        [dgbWellId]
      );

      let timestamp = new Date('2026-08-12T08:00:00Z');
      for (let i = 0; i <= 50; i++) {
        const p = generateDeterministicParams(i, 1750, false);
        timestamp = new Date(timestamp.getTime() + 10 * 60000);

        const res = await client.query(
          `INSERT INTO drilling_parameters (well_id, timestamp, depth, wob, rpm, torque, rop, mud_weight, mud_flow_rate, standpipe_pressure, annular_pressure, hook_load, additional_parameters)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            dgbWellId,
            timestamp,
            p.depth,
            p.wob,
            p.rpm,
            p.torque,
            p.rop,
            p.mudWeight,
            p.flowRate,
            p.spp,
            p.ann,
            p.hook,
            JSON.stringify({ source: 'telemetry_seed' }),
          ]
        );
        dpCount += res.rowCount;
      }
    }
    console.log(`Seeded ${dpCount} deterministic drilling parameters.`);

    console.log('✅ Deterministic seed completed successfully.');
  } catch (err) {
    console.error('Fatal error during seed:', err);
  } finally {
    await client.end();
  }
}

seed();
