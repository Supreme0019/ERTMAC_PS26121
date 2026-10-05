// Seed extracted entities for all documents in eRTMAC-NWIS
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

const docEntities = {
  'd1000000-0000-0000-0000-000000000001': [ // Daily Drilling Report
    { type: 'DEPTH', val: '2,850 m', norm: '2850', page: 1, loc: 'Drilling summary' },
    { type: 'DEPTH', val: '2,842 m', norm: '2842', page: 1, loc: 'Midnight depth' },
    { type: 'FORMATION', val: 'Barail Lower', norm: 'barail_lower', page: 1, loc: 'Lithology log' },
    { type: 'MUD_WEIGHT', val: '1.24 sg', norm: '1.24', page: 1, loc: 'Mud properties' },
    { type: 'ROP', val: '6.4 m/hr', norm: '6.4', page: 1, loc: 'Parameters track' },
    { type: 'WOB', val: '18 kN', norm: '18', page: 1, loc: 'Drill mechanics' },
    { type: 'FLOW_RATE', val: '2,150 L/min', norm: '2150', page: 1, loc: 'Hydraulics' },
    { type: 'WELL_NAME', val: 'NWIS-DEMO-01', norm: 'nwis-demo-01', page: 1, loc: 'Header' },
    { type: 'FIELD', val: 'Lakwa Field', norm: 'lakwa', page: 1, loc: 'Header' },
    { type: 'OPERATIONAL_STATUS', val: 'Drilling Ahead', norm: 'drilling_ahead', page: 1, loc: '24hr Summary' },
  ],
  'd1000000-0000-0000-0000-000000000002': [ // Mud Log Report
    { type: 'DEPTH', val: '2,910 m', norm: '2910', page: 1, loc: 'Depth header' },
    { type: 'DEPTH', val: '2,750 m', norm: '2750', page: 1, loc: 'Formation boundary' },
    { type: 'FORMATION', val: 'Barail Upper', norm: 'barail_upper', page: 1, loc: 'Stratigraphy' },
    { type: 'FORMATION', val: 'Barail Lower', norm: 'barail_lower', page: 2, loc: 'Stratigraphy' },
    { type: 'MUD_WEIGHT', val: '1.21 sg', norm: '1.21', page: 1, loc: 'Rheology table' },
    { type: 'VISCOSITY', val: '54 sec/qt', norm: '54', page: 1, loc: 'Rheology table' },
    { type: 'GAS_SHOW', val: '120 units total gas', norm: '120', page: 2, loc: 'Gas chromatography' },
    { type: 'LITHOLOGY', val: 'Sandstone / Siltstone / Shale', norm: 'sandstone_shale', page: 2, loc: 'Sample description' },
    { type: 'WELL_NAME', val: 'LKW-A-102', norm: 'lkw-a-102', page: 1, loc: 'Header' },
    { type: 'FIELD', val: 'Lakwa Field', norm: 'lakwa', page: 1, loc: 'Header' }
  ],
  'd1000000-0000-0000-0000-000000000003': [ // Well Completion Report
    { type: 'DEPTH', val: '3,120 m', norm: '3120', page: 1, loc: 'Total depth' },
    { type: 'FORMATION', val: 'Tipam Sandstone', norm: 'tipam', page: 1, loc: 'Reservoir section' },
    { type: 'EQUIPMENT', val: '9-5/8 inch Casing', norm: 'casing_9_5_8', page: 1, loc: 'Casing string' },
    { type: 'EQUIPMENT', val: '7 inch Liner', norm: 'liner_7', page: 2, loc: 'Completion string' },
    { type: 'PERFORATION', val: '2,840 m - 2,865 m', norm: '2840-2865', page: 2, loc: 'Perforation interval' },
    { type: 'PRODUCTION_RATE', val: '450 bopd', norm: '450', page: 3, loc: 'Initial flow test' },
    { type: 'WELL_NAME', val: 'LKW-B-201', norm: 'lkw-b-201', page: 1, loc: 'Header' },
    { type: 'OPERATIONAL_STATUS', val: 'Completed & Producing', norm: 'producing', page: 1, loc: 'Status' }
  ],
  'd1000000-0000-0000-0000-000000000004': [ // Geological Survey
    { type: 'FORMATION', val: 'Tipam', norm: 'tipam', page: 1, loc: 'Stratigraphic column' },
    { type: 'FORMATION', val: 'Girujan Clay', norm: 'girujan', page: 1, loc: 'Caprock section' },
    { type: 'FORMATION', val: 'Barail Series', norm: 'barail', page: 2, loc: 'Main pay horizon' },
    { type: 'FORMATION', val: 'Kopili Formation', norm: 'kopili', page: 3, loc: 'Regional seal' },
    { type: 'BASIN', val: 'Assam-Arakan Basin', norm: 'assam_arakan', page: 1, loc: 'Regional setting' },
    { type: 'POROSITY', val: '22 - 28%', norm: '0.22-0.28', page: 2, loc: 'Petrophysics' },
    { type: 'PERMEABILITY', val: '150 - 450 mD', norm: '150-450', page: 2, loc: 'Core analysis' },
    { type: 'FIELD', val: 'Lakwa Field', norm: 'lakwa', page: 1, loc: 'Header' }
  ],
  'd1000000-0000-0000-0000-000000000005': [ // Formation Evaluation
    { type: 'FORMATION', val: 'Barail Series', norm: 'barail', page: 1, loc: 'Zone of interest' },
    { type: 'DEPTH', val: '2,650 m - 3,050 m', norm: '2650-3050', page: 1, loc: 'Depth interval' },
    { type: 'RESISTIVITY', val: '18 - 35 ohm-m', norm: '18-35', page: 2, loc: 'Deep Induction Log' },
    { type: 'GAMMA_RAY', val: '65 - 90 API', norm: '65-90', page: 2, loc: 'Gamma log' },
    { type: 'NET_PAY', val: '28.5 m', norm: '28.5', page: 2, loc: 'Pay summary' },
    { type: 'HYDROCARBON_SATURATION', val: '68%', norm: '0.68', page: 3, loc: 'Saturation calculation' },
    { type: 'WELL_NAME', val: 'NWIS-DEMO-01', norm: 'nwis-demo-01', page: 1, loc: 'Header' }
  ],
  'd1000000-0000-0000-0000-000000000007': [ // Lost Circulation Analysis
    { type: 'EVENT_TYPE', val: 'lost circulation', norm: 'lost_circulation', page: 1, loc: 'Executive summary' },
    { type: 'DEPTH', val: '2,410 m', norm: '2410', page: 1, loc: 'Incident depth' },
    { type: 'FORMATION', val: 'Girujan Clay', norm: 'girujan', page: 1, loc: 'Geological context' },
    { type: 'LOSS_RATE', val: '15 bbl/hr', norm: '15', page: 1, loc: 'Mud loss telemetry' },
    { type: 'MITIGATION', val: 'Pumped 30 bbl Mica LCM Pill', norm: 'lcm_pill_mica', page: 2, loc: 'Corrective action' },
    { type: 'MUD_WEIGHT', val: '1.15 sg', norm: '1.15', page: 2, loc: 'Fluid state' },
    { type: 'FIELD', val: 'Lakwa Field', norm: 'lakwa', page: 1, loc: 'Header' }
  ],
  'd1000000-0000-0000-0000-000000000008': [ // BHA Configuration
    { type: 'EQUIPMENT', val: 'PDC Bit 8.5 inch', norm: 'pdc_bit_8_5', page: 1, loc: 'Bit record' },
    { type: 'EQUIPMENT', val: 'MWD Tool String', norm: 'mwd_tool', page: 1, loc: 'Telemetry sensor' },
    { type: 'EQUIPMENT', val: 'Stabilizer 8-1/4 inch', norm: 'stabilizer_8_25', page: 1, loc: 'BHA assembly' },
    { type: 'DEPTH', val: '2,450 m - 2,850 m', norm: '2450-2850', page: 1, loc: 'Run interval' },
    { type: 'WELL_NAME', val: 'NWIS-DEMO-01', norm: 'nwis-demo-01', page: 1, loc: 'Header' }
  ],
  'd1000000-0000-0000-0000-000000000009': [ // Kick Detection Procedure
    { type: 'EVENT_TYPE', val: 'kick / influx', norm: 'kick', page: 1, loc: 'Incident definition' },
    { type: 'PROCEDURE', val: 'Hard Shut-in Protocol', norm: 'hard_shutin', page: 1, loc: 'Safety directive' },
    { type: 'EQUIPMENT', val: 'Annular BOP (5000 psi)', norm: 'annular_bop_5000', page: 2, loc: 'Well control stack' },
    { type: 'EQUIPMENT', val: 'Pipe Rams (10000 psi)', norm: 'pipe_rams_10000', page: 2, loc: 'Well control stack' },
    { type: 'THRESHOLD', val: '5 bbl Pit Gain', norm: '5_bbl_gain', page: 2, loc: 'Alarm threshold' },
    { type: 'PRESSURE', val: 'SIDPP / SICP Monitoring', norm: 'sidpp_sicp', page: 3, loc: 'Pressure schedule' }
  ],
  'd1000000-0000-0000-0000-000000000010': [ // Casing Design Report
    { type: 'EQUIPMENT', val: '13-3/8 inch Surface Casing', norm: 'casing_13_3_8', page: 1, loc: 'Casing schedule' },
    { type: 'EQUIPMENT', val: '9-5/8 inch Intermediate Casing', norm: 'casing_9_5_8', page: 1, loc: 'Casing schedule' },
    { type: 'DEPTH', val: '1,800 m', norm: '1800', page: 1, loc: 'Casing shoe depth' },
    { type: 'FORMATION', val: 'Tipam Formation', norm: 'tipam', page: 1, loc: 'Shoe horizon' },
    { type: 'PRESSURE', val: '4,850 psi Burst Rating', norm: '4850_burst', page: 2, loc: 'Design limits' },
    { type: 'PRESSURE', val: '3,200 psi Collapse Rating', norm: '3200_collapse', page: 2, loc: 'Design limits' },
    { type: 'WELL_NAME', val: 'DGB-A-201', norm: 'dgb-a-201', page: 1, loc: 'Header' },
    { type: 'FIELD', val: 'Digboi Field', norm: 'digboi', page: 1, loc: 'Header' }
  ]
};

async function main() {
  await client.connect();
  let totalInserted = 0;
  for (const [docId, list] of Object.entries(docEntities)) {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const entityId = require('crypto').randomUUID();
      try {
        const res = await client.query(
          `INSERT INTO extracted_entities (id, document_id, entity_type, value, normalized_value, confidence, page, source_location, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            entityId,
            docId,
            e.type,
            e.val,
            e.norm,
            0.94 + Math.random() * 0.05,
            e.page,
            e.loc,
            JSON.stringify({ model: 'OIL-NLP-v2', category: 'geological_drilling' })
          ]
        );
        totalInserted += res.rowCount;
      } catch (err) {
        console.error('Insert error:', err.message);
      }
    }
  }
  console.log(`Successfully inserted ${totalInserted} entities across documents!`);
  await client.end();
}

main();
