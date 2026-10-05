// =============================================================================
// NWIS Backend — Seed Extra Drilling Events (15 events across all 10 wells)
// Idempotent: uses ON CONFLICT(id) DO UPDATE
// Formation IDs confirmed from DB:
//   f1000000-...000000000001 = Tipam Sandstone
//   f1000000-...000000000002 = Girujan Clay
//   f1000000-...000000000003 = Barail Group
//   f1000000-...000000000004 = Kopili Formation
//   f1000000-...000000000005 = Sylhet Limestone
//   f1000000-...000000000006 = Naga Thrust Zone (structural)
// Well IDs confirmed from DB:
//   b1000000-...000000000001 = NWIS-DEMO-01
//   b1000000-...000000000002 = LKW-A-102
//   b1000000-...000000000003 = LKW-B-201
//   b1000000-...000000000004 = LKW-C-305
//   b1000000-...000000000005 = RDL-A-401
//   b1000000-...000000000006 = RDL-B-502
//   b1000000-...000000000007 = GEL-A-110
//   b1000000-...000000000008 = GEL-B-115
//   b1000000-...000000000009 = DGB-A-201
//   b1000000-...000000000010 = NHK-A-101
// =============================================================================

const { sql } = require('./src/config/database');

const F_TIPAM   = 'f1000000-0000-0000-0000-000000000001';
const F_GIRUJAN = 'f1000000-0000-0000-0000-000000000002';
const F_BARAIL  = 'f1000000-0000-0000-0000-000000000003';
const F_KOPILI  = 'f1000000-0000-0000-0000-000000000004';
const F_SYLHET  = 'f1000000-0000-0000-0000-000000000005';

const W_DEMO    = 'b1000000-0000-0000-0000-000000000001'; // NWIS-DEMO-01
const W_LKWA    = 'b1000000-0000-0000-0000-000000000002'; // LKW-A-102
const W_LKWB    = 'b1000000-0000-0000-0000-000000000003'; // LKW-B-201
const W_LKWC    = 'b1000000-0000-0000-0000-000000000004'; // LKW-C-305
const W_RDLA    = 'b1000000-0000-0000-0000-000000000005'; // RDL-A-401
const W_RDLB    = 'b1000000-0000-0000-0000-000000000006'; // RDL-B-502
const W_GELA    = 'b1000000-0000-0000-0000-000000000007'; // GEL-A-110
const W_GELB    = 'b1000000-0000-0000-0000-000000000008'; // GEL-B-115
const W_DGB     = 'b1000000-0000-0000-0000-000000000009'; // DGB-A-201
const W_NHK     = 'b1000000-0000-0000-0000-000000000010'; // NHK-A-101

const EXTRA_EVENTS = [
  // GEL-A-110 (Geleki) — 2 Kopili events
  {
    id: 'e2000000-0000-0000-0000-000000000001',
    well_id: W_GELA,
    formation_id: F_KOPILI,
    depth: 3120,
    event_type: 'stuck_pipe',
    severity: 'high',
    description: 'Drillstring packing off in reactive Kopili shale at 3120m MD. Overpull of 180 kN recorded.',
    metadata: { depth_below_top: 70, cause: 'shale_swelling' },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000002',
    well_id: W_GELA,
    formation_id: F_KOPILI,
    depth: 3250,
    event_type: 'mud_loss',
    severity: 'medium',
    description: 'Seepage loss of 4.5 m3/hr while penetrating fractured Kopili siltstone at 3250m.',
    metadata: { depth_below_top: 200, volume_loss_m3: 18 },
  },
  // GEL-B-115 (Geleki) — 2 Barail events
  {
    id: 'e2000000-0000-0000-0000-000000000003',
    well_id: W_GELB,
    formation_id: F_BARAIL,
    depth: 2350,
    event_type: 'kick',
    severity: 'critical',
    description: 'Gas kick encountered in Barail coal sequence. Pit gain 2.8 m3, shut in SIDPP 24 bar.',
    metadata: { depth_below_top: 150, sidpp_bar: 24, pit_gain_m3: 2.8 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000004',
    well_id: W_GELB,
    formation_id: F_BARAIL,
    depth: 2490,
    event_type: 'tight_hole',
    severity: 'medium',
    description: 'Tight hole during wiper trip at 2490m in coal/sand transition zone. Reaming required.',
    metadata: { depth_below_top: 290, drag_kN: 95 },
  },
  // DGB-A-201 (Digboi) — 2 Tipam events
  {
    id: 'e2000000-0000-0000-0000-000000000005',
    well_id: W_DGB,
    formation_id: F_TIPAM,
    depth: 1420,
    event_type: 'lost_circulation',
    severity: 'high',
    description: 'Total loss of returns (35 m3) in coarse Tipam sandstone at 1420m. LCM pill pumped.',
    metadata: { depth_below_top: 40, lcm_bbl: 120 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000006',
    well_id: W_DGB,
    formation_id: F_TIPAM,
    depth: 1680,
    event_type: 'stuck_pipe',
    severity: 'medium',
    description: 'Mechanical keyseating while pulling out of hole at 1680m in inclined section.',
    metadata: { depth_below_top: 300, mechanism: 'keyseating' },
  },
  // NHK-A-101 (Naharkatiya) — 2 events
  {
    id: 'e2000000-0000-0000-0000-000000000007',
    well_id: W_NHK,
    formation_id: F_BARAIL,
    depth: 2650,
    event_type: 'mud_loss',
    severity: 'high',
    description: 'Partial fluid losses of 12 m3/hr into depleted Barail sandstone reservoir at 2650m.',
    metadata: { depth_below_top: 180, formation: 'Barail' },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000008',
    well_id: W_NHK,
    formation_id: F_KOPILI,
    depth: 2980,
    event_type: 'gas_cut',
    severity: 'medium',
    description: 'Connection gas peak of 4.2% and mud weight cut from 1.20 to 1.14 sg in Kopili transition.',
    metadata: { depth_below_top: 30, gas_pct: 4.2 },
  },
  // RDL-A-401 (Rudrasagar) — 2 Kopili events
  {
    id: 'e2000000-0000-0000-0000-000000000009',
    well_id: W_RDLA,
    formation_id: F_KOPILI,
    depth: 3310,
    event_type: 'wellbore_instability',
    severity: 'high',
    description: 'Cavings and tight hole in fissile Kopili claystone at 3310m. Mud weight raised to 1.25 sg.',
    metadata: { depth_below_top: 260, cavings_volume: 'large_splintery' },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000010',
    well_id: W_RDLA,
    formation_id: F_KOPILI,
    depth: 3380,
    event_type: 'kick',
    severity: 'critical',
    description: 'Well control incident: influx detected at Kopili/Sylhet boundary. 3.5 m3 pit gain.',
    metadata: { depth_below_top: 330, sidpp_bar: 31, sicp_bar: 38 },
  },
  // RDL-B-502 (Rudrasagar) — 1 Kopili event
  {
    id: 'e2000000-0000-0000-0000-000000000011',
    well_id: W_RDLB,
    formation_id: F_KOPILI,
    depth: 3040,
    event_type: 'stuck_pipe',
    severity: 'critical',
    description: 'Differential sticking in high permeability sand stringer within Kopili Formation.',
    metadata: { depth_below_top: 60, jar_time_min: 60 },
  },
  // LKW-B-201 (Lakwa) — 1 Kopili event
  {
    id: 'e2000000-0000-0000-0000-000000000012',
    well_id: W_LKWB,
    formation_id: F_KOPILI,
    depth: 2880,
    event_type: 'mud_loss',
    severity: 'high',
    description: 'Sudden loss of 22 m3 drilling fluid at 2880m across microfractured Kopili shale horizon.',
    metadata: { depth_below_top: 80, loss_m3: 22 },
  },
  // LKW-C-305 (Lakwa) — 2 Kopili events
  {
    id: 'e2000000-0000-0000-0000-000000000013',
    well_id: W_LKWC,
    formation_id: F_KOPILI,
    depth: 2820,
    event_type: 'stuck_pipe',
    severity: 'high',
    description: 'String packed off at 2820m during rotary drilling in swelling Kopili claystone.',
    metadata: { depth_below_top: 35, overpull_kN: 210 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000014',
    well_id: W_LKWC,
    formation_id: F_KOPILI,
    depth: 2865,
    event_type: 'well_control',
    severity: 'high',
    description: 'Gas surge and pit volume increase of 1.6 m3 at 2865m. Circulated through choke manifold.',
    metadata: { depth_below_top: 80, choke_psi: 320 },
  },
  // NWIS-DEMO-01 (Active Well) — 1 Barail event
  {
    id: 'e2000000-0000-0000-0000-000000000015',
    well_id: W_DEMO,
    formation_id: F_BARAIL,
    depth: 2680,
    event_type: 'tight_hole',
    severity: 'medium',
    description: 'Tight spot encountered on trip in hole at 2680m in lower Barail sands.',
    metadata: { depth_below_top: 280, drag_kN: 70 },
  },
  // Additional events across 10 wells to expand dataset to >40 events
  {
    id: 'e2000000-0000-0000-0000-000000000016',
    well_id: W_RDLB,
    formation_id: F_BARAIL,
    depth: 1950,
    event_type: 'tight_hole',
    severity: 'medium',
    description: 'Tight hole during tripping at 1950m in Barail coal sequence. 80 kN overpull recorded.',
    metadata: { depth_below_top: 550, overpull_kN: 80 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000017',
    well_id: W_RDLB,
    formation_id: F_KOPILI,
    depth: 2650,
    event_type: 'mud_loss',
    severity: 'high',
    description: 'Partial mud losses of 8 m3/hr into fractured Kopili transition zone at 2650m.',
    metadata: { depth_below_top: 450, loss_rate_m3_hr: 8 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000018',
    well_id: W_RDLB,
    formation_id: F_SYLHET,
    depth: 3080,
    event_type: 'kick',
    severity: 'critical',
    description: 'High pressure gas influx in Sylhet Limestone at 3080m. Shut-in drill pipe pressure 28 bar, pit gain 3.2 m3.',
    metadata: { depth_below_top: 80, sidpp_bar: 28, pit_gain_m3: 3.2 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000019',
    well_id: W_GELB,
    formation_id: F_KOPILI,
    depth: 2520,
    event_type: 'stuck_pipe',
    severity: 'high',
    description: 'Differential sticking across porous sand stringer in Kopili transition at 2520m.',
    metadata: { depth_below_top: 120, mechanism: 'differential_sticking' },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000020',
    well_id: W_GELB,
    formation_id: F_TIPAM,
    depth: 1150,
    event_type: 'lost_circulation',
    severity: 'high',
    description: 'Massive loss zone in upper Tipam sandstone at 1150m. Pumped 80 bbl LCM pill.',
    metadata: { depth_below_top: 360, loss_type: 'severe' },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000021',
    well_id: W_LKWC,
    formation_id: F_BARAIL,
    depth: 1980,
    event_type: 'tight_hole',
    severity: 'medium',
    description: 'Tight hole and high drag while pulling BHA at 1980m in interbedded coal-shale Barail formation.',
    metadata: { depth_below_top: 530, drag_kN: 110 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000022',
    well_id: W_LKWC,
    formation_id: F_KOPILI,
    depth: 2580,
    event_type: 'mud_loss',
    severity: 'high',
    description: 'Sudden loss of 15 m3 drilling fluid at 2580m in micro-fractured Kopili section.',
    metadata: { depth_below_top: 230, loss_volume_m3: 15 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000023',
    well_id: W_NHK,
    formation_id: F_TIPAM,
    depth: 1100,
    event_type: 'lost_circulation',
    severity: 'medium',
    description: 'Seepage loss of 6 m3/hr while drilling porous Tipam sandstone interval at 1100m.',
    metadata: { depth_below_top: 300, seepage_rate: 6 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000024',
    well_id: W_NHK,
    formation_id: F_BARAIL,
    depth: 1850,
    event_type: 'stuck_pipe',
    severity: 'critical',
    description: 'Pack-off and stuck pipe while back-reaming through sloughing Barail shales at 1850m.',
    metadata: { depth_below_top: 450, cause: 'sloughing_shale' },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000025',
    well_id: W_NHK,
    formation_id: F_KOPILI,
    depth: 2750,
    event_type: 'wellbore_instability',
    severity: 'high',
    description: 'Hole enlargement and splintery shale cavings at 2750m in lower Kopili. Required mud weight increase to 1.28 sg.',
    metadata: { depth_below_top: 550, cavings_type: 'splintery' },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000026',
    well_id: W_DGB,
    formation_id: F_TIPAM,
    depth: 950,
    event_type: 'tight_hole',
    severity: 'medium',
    description: 'Heavy reaming needed from 920m to 950m due to thick filter cake in unconsolidated Tipam sands.',
    metadata: { depth_below_top: 300, torque_increase_kNm: 12 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000027',
    well_id: W_GELA,
    formation_id: F_BARAIL,
    depth: 1850,
    event_type: 'tight_hole',
    severity: 'medium',
    description: 'High torque spikes and ledge hangup on stabilizer at 1850m in Barail sand/coal interface.',
    metadata: { depth_below_top: 400, torque_spike: 18 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000028',
    well_id: W_LKWA,
    formation_id: F_BARAIL,
    depth: 2100,
    event_type: 'gas_cut',
    severity: 'medium',
    description: 'Trip gas peak of 6.8% detected after round trip for bit change at 2100m in Barail sand.',
    metadata: { depth_below_top: 350, trip_gas_pct: 6.8 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000029',
    well_id: W_LKWB,
    formation_id: F_TIPAM,
    depth: 1050,
    event_type: 'lost_circulation',
    severity: 'high',
    description: 'Loss of returns of 22 m3 in depleted permeable Tipam sandstone at 1050m.',
    metadata: { depth_below_top: 290, loss_m3: 22 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000030',
    well_id: W_RDLA,
    formation_id: F_BARAIL,
    depth: 1750,
    event_type: 'tight_hole',
    severity: 'medium',
    description: 'Overpull of 120 kN while pulling through swelling coal seams in Barail Group at 1750m.',
    metadata: { depth_below_top: 370, overpull_kN: 120 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000031',
    well_id: W_DEMO,
    formation_id: F_KOPILI,
    depth: 2820,
    event_type: 'tight_hole',
    severity: 'medium',
    description: 'Tight hole and torque fluctuations observed while drilling into Kopili shale at 2820m.',
    metadata: { depth_below_top: 320, drag_kN: 85 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000032',
    well_id: W_DEMO,
    formation_id: F_KOPILI,
    depth: 2845,
    event_type: 'stuck_pipe',
    severity: 'critical',
    description: 'High overpull and mechanical sticking tendency in swelling Kopili formation at 2845m.',
    metadata: { depth_below_top: 345, overpull_kN: 195 },
  },
  {
    id: 'e2000000-0000-0000-0000-000000000033',
    well_id: W_DEMO,
    formation_id: F_KOPILI,
    depth: 2850,
    event_type: 'kick',
    severity: 'critical',
    description: 'Gas influx detected at 2850m with 1.8 m3 pit gain and 18 bar shut-in casing pressure.',
    metadata: { depth_below_top: 350, pit_gain_m3: 1.8, sicp_bar: 18 },
  },
];

async function seedExtraEvents() {
  console.log('Seeding 15 extra events across all 10 wells (idempotent)...');

  let inserted = 0;
  let updated = 0;

  for (const ev of EXTRA_EVENTS) {
    const result = await sql`
      INSERT INTO drilling_events (id, well_id, formation_id, depth, event_type, severity, description, confidence, metadata)
      VALUES (
        ${ev.id}::uuid,
        ${ev.well_id}::uuid,
        ${ev.formation_id}::uuid,
        ${ev.depth},
        ${ev.event_type},
        ${ev.severity},
        ${ev.description},
        0.95,
        ${JSON.stringify(ev.metadata || {})}::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        well_id      = EXCLUDED.well_id,
        formation_id = EXCLUDED.formation_id,
        depth        = EXCLUDED.depth,
        event_type   = EXCLUDED.event_type,
        severity     = EXCLUDED.severity,
        description  = EXCLUDED.description,
        metadata     = EXCLUDED.metadata
      RETURNING (xmax = 0) AS is_insert;
    `;
    if (result[0]?.is_insert) inserted++;
    else updated++;
  }

  console.log(`  Inserted: ${inserted}, Updated: ${updated}`);

  const total = await sql`SELECT COUNT(*) AS total FROM drilling_events`;
  const perWell = await sql`
    SELECT w.well_name, COUNT(de.id) AS event_count
    FROM wells w
    LEFT JOIN drilling_events de ON de.well_id = w.id
    GROUP BY w.well_name
    ORDER BY w.well_name
  `;

  console.log(`\n✅ Total drilling_events in DB: ${total[0].total}`);
  console.log('\nEvents per well:');
  perWell.forEach(r => console.log(`  ${r.well_name}: ${r.event_count}`));

  process.exit(0);
}

seedExtraEvents().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
