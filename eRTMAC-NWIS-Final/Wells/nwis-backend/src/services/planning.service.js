// =============================================================================
// NWIS Backend — Well Planning & Pre-Spud Hazard Assessment Service
// =============================================================================

const db = require('../config/database');
const { haversineDistance } = require('../utils/distance');

// DGH Recognized Blocks & Petroleum Mining Leases in Assam-Arakan Basin (Category I)
const DGH_BLOCKS = [
  {
    id: 'block-lkw-pml',
    name: 'Lakwa-Lakhmani PML',
    operator: 'Oil India Limited / ONGC',
    state: 'Assam',
    district: 'Sivasagar & Charaideo',
    basin: 'Assam-Arakan Basin (Category I)',
    lease_type: 'Petroleum Mining Lease (PML)',
    coordinates: [
      [26.74, 94.17],
      [26.82, 94.17],
      [26.82, 94.26],
      [26.74, 94.26],
      [26.74, 94.17]
    ],
    centroid: { lat: 26.78, lon: 94.21 }
  },
  {
    id: 'block-rdl-pml',
    name: 'Rudrasagar PML',
    operator: 'ONGC',
    state: 'Assam',
    district: 'Sivasagar',
    basin: 'Assam-Arakan Basin (Category I)',
    lease_type: 'Petroleum Mining Lease (PML)',
    coordinates: [
      [26.79, 94.16],
      [26.85, 94.16],
      [26.85, 94.22],
      [26.79, 94.22],
      [26.79, 94.16]
    ],
    centroid: { lat: 26.81, lon: 94.19 }
  },
  {
    id: 'block-gel-pml',
    name: 'Geleki PML',
    operator: 'ONGC',
    state: 'Assam',
    district: 'Sivasagar',
    basin: 'Assam-Arakan Basin (Category I)',
    lease_type: 'Petroleum Mining Lease (PML)',
    coordinates: [
      [26.70, 94.13],
      [26.77, 94.13],
      [26.77, 94.20],
      [26.70, 94.20],
      [26.70, 94.13]
    ],
    centroid: { lat: 26.75, lon: 94.17 }
  },
  {
    id: 'block-nhk-pml',
    name: 'Naharkatiya-Deohal-Bhogpara PML',
    operator: 'Oil India Limited',
    state: 'Assam',
    district: 'Dibrugarh',
    basin: 'Assam-Arakan Basin (Category I)',
    lease_type: 'Petroleum Mining Lease (PML)',
    coordinates: [
      [27.20, 95.25],
      [27.35, 95.25],
      [27.35, 95.45],
      [27.20, 95.45],
      [27.20, 95.25]
    ],
    centroid: { lat: 27.28, lon: 95.34 }
  },
  {
    id: 'block-dgb-pml',
    name: 'Digboi PML',
    operator: 'Oil India Limited',
    state: 'Assam',
    district: 'Tinsukia',
    basin: 'Assam-Arakan Basin (Category I)',
    lease_type: 'Petroleum Mining Lease (PML)',
    coordinates: [
      [27.32, 95.55],
      [27.46, 95.55],
      [27.46, 95.72],
      [27.32, 95.72],
      [27.32, 95.55]
    ],
    centroid: { lat: 27.39, lon: 95.62 }
  },
  {
    id: 'block-oalp-aa-2022',
    name: 'OALP Block AA-ONHP-2022/1',
    operator: 'Oil India Limited (Bid Winner)',
    state: 'Assam',
    district: 'Upper Assam Frontier',
    basin: 'Assam-Arakan Basin (Category I)',
    lease_type: 'Open Acreage Exploration License',
    coordinates: [
      [26.65, 94.00],
      [27.50, 94.00],
      [27.50, 95.80],
      [26.65, 95.80],
      [26.65, 94.00]
    ],
    centroid: { lat: 27.05, lon: 94.90 }
  }
];

/**
 * Determine DGH concession block for a coordinate
 */
function resolveDghBlock(lat, lon) {
  // Check exact bounding boxes first
  for (const block of DGH_BLOCKS) {
    if (block.id === 'block-oalp-aa-2022') continue; // Check specific PMLs first
    const lats = block.coordinates.map(c => c[0]);
    const lons = block.coordinates.map(c => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      return block;
    }
  }

  // Fallback to nearest centroid
  let nearest = DGH_BLOCKS[0];
  let minD = Infinity;
  for (const block of DGH_BLOCKS) {
    const d = haversineDistance(lat, lon, block.centroid.lat, block.centroid.lon);
    if (d < minD) {
      minD = d;
      nearest = block;
    }
  }
  return { ...nearest, distance_to_center_km: Number(minD.toFixed(1)) };
}

const planningService = {
  /**
   * Return DGH Blocks GeoJSON / boundary list
   */
  async getBlocks() {
    return DGH_BLOCKS.map(block => ({
      ...block,
      disclaimer: 'Polygon boundary approximate and illustrative. Refer to official DGH/MoPNG records.'
    }));
  },

  /**
   * Evaluates proposed well coordinates and target depth
   */
  async evaluateLocation(params) {
    const {
      latitude,
      longitude,
      target_depth = 3200,
      radius_km = 25,
      well_type = 'development',
      target_formation = 'kopili'
    } = params;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const targetDepth = parseFloat(target_depth);
    const radius = parseFloat(radius_km);

    // 1. Resolve DGH Concession Block
    const blockInfo = resolveDghBlock(lat, lon);

    // 2. Fetch nearby wells via PostGIS spatial filter (lat/lon cast to geography)
    const wellsResult = await db.query(
      `SELECT id, well_name, field, status, latitude, longitude, current_depth, total_depth, spud_date,
         ST_Distance(
           ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography,
           ST_SetSRID(ST_MakePoint($2::float, $1::float), 4326)::geography
         ) / 1000 AS distance_km
       FROM wells
       WHERE ST_DWithin(
         ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography,
         ST_SetSRID(ST_MakePoint($2::float, $1::float), 4326)::geography,
         $3 * 1000
       )
       ORDER BY distance_km ASC`,
      [lat, lon, radius]
    );

    const nearbyWells = wellsResult.rows.map(w => ({
      ...w,
      distance_km: Number(parseFloat(w.distance_km).toFixed(2)),
      current_depth: parseFloat(w.current_depth || 0),
      total_depth: parseFloat(w.total_depth || 0)
    }));


    const wellIds = nearbyWells.map(w => w.id);

    // 3. Stratigraphy & Formation Top Prognosis using Offset Horizon Depths
    const formationsMasterResult = await db.query(
      `SELECT id, name, description, geological_attributes FROM formations`
    );
    const formationsMaster = formationsMasterResult.rows;

    let wellFormations = [];
    if (wellIds.length > 0) {
      const wfResult = await db.query(
        `SELECT wf.well_id, wf.formation_id, wf.top_depth, wf.bottom_depth, f.name as formation_name, f.geological_attributes
         FROM well_formations wf
         JOIN formations f ON f.id = wf.formation_id
         WHERE wf.well_id = ANY($1::uuid[])`,
        [wellIds]
      );
      wellFormations = wfResult.rows;
    }

    // Standard regional formation order for Upper Assam Shelf (shallowest to deepest):
    // Alluvium -> Girujan Clay -> Tipam Sandstone -> Barail Group -> Kopili Formation -> Sylhet Limestone
    const REGIONAL_ORDER = [
      { key: 'alluvium', name: 'Alluvium & Dihing Group', defaultTop: 0, defaultBase: 750, lithology: 'Unconsolidated gravel, sand, clay', age: 'Pleistocene-Recent' },
      { key: 'girujan', name: 'Girujan Clay', defaultTop: 750, defaultBase: 1400, lithology: 'Mottled plastic claystone and mudstone', age: 'Upper Miocene' },
      { key: 'tipam', name: 'Tipam Sandstone', defaultTop: 1400, defaultBase: 2100, lithology: 'Medium-to-coarse sandstone with thin siltstone', age: 'Upper Miocene' },
      { key: 'barail', name: 'Barail Group', defaultTop: 2100, defaultBase: 2800, lithology: 'Interbedded sandstone, shale, and coal seams', age: 'Oligocene' },
      { key: 'kopili', name: 'Kopili Formation', defaultTop: 2800, defaultBase: 3400, lithology: 'Splintery carbonaceous shale and thin marls', age: 'Eocene' },
      { key: 'sylhet', name: 'Sylhet Limestone', defaultTop: 3400, defaultBase: 4000, lithology: 'Fossiliferous limestone and calcareous sandstone', age: 'Eocene' }
    ];

    const stratigraphyForecast = [];
    let runningTop = 0;

    for (const stratum of REGIONAL_ORDER) {
      if (runningTop >= targetDepth) break;

      // Find matching formation data from offsets
      const matchingFormations = wellFormations.filter(wf => 
        wf.formation_name.toLowerCase().includes(stratum.key)
      );

      let predictedTop = stratum.defaultTop;
      let predictedBase = stratum.defaultBase;

      if (matchingFormations.length > 0) {
        // Inverse distance weighted average
        let topSum = 0;
        let baseSum = 0;
        let weightSum = 0;

        for (const mf of matchingFormations) {
          const well = nearbyWells.find(w => w.id === mf.well_id);
          const dist = well ? Math.max(well.distance_km, 0.2) : 5;
          const weight = 1 / (dist * dist);
          topSum += parseFloat(mf.top_depth || stratum.defaultTop) * weight;
          baseSum += parseFloat(mf.bottom_depth || stratum.defaultBase) * weight;
          weightSum += weight;
        }

        if (weightSum > 0) {
          predictedTop = Math.round(topSum / weightSum);
          predictedBase = Math.round(baseSum / weightSum);
        }
      }

      // Ensure continuity
      if (predictedTop < runningTop) predictedTop = runningTop;
      if (predictedBase <= predictedTop) predictedBase = predictedTop + 300;

      // Cap to target depth
      const finalBase = Math.min(predictedBase, targetDepth);

      // Compute P10/P50/P90 tops from offset well formations
      const topSamples = matchingFormations
        .map((mf) => parseFloat(mf.top_depth))
        .filter((td) => !isNaN(td))
        .sort((a, b) => a - b);

      const pFrac = (arr, f) => arr.length > 0 ? arr[Math.max(0, Math.min(arr.length - 1, Math.floor(f * arr.length)))] : null;
      const p10Top = topSamples.length > 0 ? pFrac(topSamples, 0.10) : predictedTop;
      const p50Top = topSamples.length > 0 ? pFrac(topSamples, 0.50) : predictedTop;
      const p90Top = topSamples.length > 0 ? pFrac(topSamples, 0.90) : predictedTop;

      stratigraphyForecast.push({
        formation: stratum.name,
        top_depth: predictedTop,
        bottom_depth: finalBase,
        thickness_m: finalBase - predictedTop,
        lithology: stratum.lithology,
        age: stratum.age,
        is_target: stratum.key === target_formation.toLowerCase(),
        offset_samples: matchingFormations.length,
        contributing_well_count: matchingFormations.length,
        p10_top_m: p10Top,
        p50_top_m: p50Top,
        p90_top_m: p90Top,
        provenance: matchingFormations.length > 0 ? 'REGIONAL' : 'INFERENCE',
      });

      runningTop = finalBase;
    }

    // 4. Multi-Well Depth-Wise Hazard Aggregation
    let rawEvents = [];
    if (wellIds.length > 0) {
      const eventsRes = await db.query(
        `SELECT e.id, e.well_id, w.well_name, e.depth, e.event_type, e.severity, e.description,
                f.name as formation_name,
                m.action as mitigation_action, m.outcome as mitigation_outcome
         FROM drilling_events e
         JOIN wells w ON w.id = e.well_id
         LEFT JOIN formations f ON f.id = e.formation_id
         LEFT JOIN mitigations m ON m.event_id = e.id
         WHERE e.well_id = ANY($1::uuid[])
         ORDER BY e.depth ASC`,
        [wellIds]
      );
      rawEvents = eventsRes.rows.map(ev => {
        const well = nearbyWells.find(w => w.id === ev.well_id);
        return {
          ...ev,
          depth: parseFloat(ev.depth),
          distance_km: well?.distance_km ?? null
        };
      });
    }

    // Define standard operational drilling intervals
    const INTERVALS = [
      {
        interval: '0 - 500 m',
        min: 0,
        max: 500,
        formation: 'Alluvium & Surface Hole',
        primary_concern: 'Loose sands, gravel caving, shallow aquifer isolation',
        standard_precaution: 'Spud with high-viscosity bentonite mud; control ROP to avoid cratering; run 20" conductor.'
      },
      {
        interval: '500 - 1,200 m',
        min: 500,
        max: 1200,
        formation: 'Tipam Sandstone',
        primary_concern: 'Permeable sand seepage losses, differential sticking risk during connections',
        standard_precaution: 'Maintain mud weight at 1.10–1.14 sg; pre-treat system with fine calcium carbonate LCM; minimize pipe static time.'
      },
      {
        interval: '1,200 - 1,800 m',
        min: 1200,
        max: 1800,
        formation: 'Girujan Clay',
        primary_concern: 'Reactive clay dispersion, bit balling, tight pull on trips, hole swelling',
        standard_precaution: 'Treat mud with 6–8% KCl and PHPA polymer encapsulator; carry out short wiper trips prior to POOH.'
      },
      {
        interval: '1,800 - 2,500 m',
        min: 1800,
        max: 2500,
        formation: 'Barail Group (Coal & Shales)',
        primary_concern: 'Coal seam spalling, wellbore instability, mud loss into depleted reservoir sands',
        standard_precaution: 'Maintain 1.15–1.18 sg mud weight; case off Girujan with 9-5/8" casing before penetrating reservoir pay.'
      },
      {
        interval: '2,500 - 3,200 m',
        min: 2500,
        max: 3200,
        formation: 'Kopili Formation',
        primary_concern: 'Abnormal pore pressure ramp, gas cut mud, severe lost circulation (>50 bbl/hr) and differential stuck pipe',
        standard_precaution: 'CRITICAL ZONE: Maintain 30 bbl heavy LCM pill on standby; verify BOP stack; run PWD tool to monitor ECD continuously.'
      },
      {
        interval: '3,200 m+',
        min: 3200,
        max: 5000,
        formation: 'Sylhet Limestone / Basement',
        primary_concern: 'Vugular cavernous fluid losses, high downhole temperatures, hard chert stringers',
        standard_precaution: 'Prepare crosslinked polymer pills; monitor torque fluctuations; run PDC bit with backup diamond inserts.'
      }
    ];

    const depthHazards = [];
    for (const seg of INTERVALS) {
      if (seg.min >= targetDepth) continue;

      // Filter events in this depth slice
      const matchingEvents = rawEvents.filter(e => e.depth >= seg.min && e.depth < seg.max);

      // Determine highest severity
      let maxSeverity = 'low';
      if (matchingEvents.some(e => e.severity === 'critical')) maxSeverity = 'critical';
      else if (matchingEvents.some(e => e.severity === 'high')) maxSeverity = 'high';
      else if (matchingEvents.some(e => e.severity === 'medium')) maxSeverity = 'medium';

      // Unique incident types
      const types = [...new Set(matchingEvents.map(e => e.event_type))];

      depthHazards.push({
        depth_interval: seg.interval,
        min_depth: seg.min,
        max_depth: Math.min(seg.max, targetDepth),
        formation: seg.formation,
        severity: matchingEvents.length > 0 ? maxSeverity : 'low',
        total_offset_incidents: matchingEvents.length,
        incident_types: types,
        primary_concern: seg.primary_concern,
        engineering_precaution: seg.standard_precaution,
        provenance: matchingEvents.length > 0 ? 'REGIONAL' : 'INFERENCE',
        recorded_events: matchingEvents.slice(0, 5).map(e => ({
          well_name: e.well_name,
          depth: e.depth,
          distance_km: e.distance_km,
          event_type: e.event_type,
          severity: e.severity,
          description: e.description,
          mitigation: e.mitigation_action,
          outcome: e.mitigation_outcome,
          provenance: 'REGIONAL',
        }))
      });
    }

    // 5. Engineering Mud Weight & Casing Recommendations
    const engineeringProgram = {
      recommended_mud_program: [
        { depth_range: '0 - 500 m', fluid_type: 'Bentonite / Spud Mud', recommended_density_sg: '1.06 - 1.10', viscosity_sec: '45 - 55', objective: 'Surface hole cleaning & aquifer seal', provenance: 'INFERENCE' },
        { depth_range: '500 - 1,800 m', fluid_type: 'KCl / Polymer Water-Based Mud', recommended_density_sg: '1.12 - 1.16', viscosity_sec: '40 - 45', objective: 'Inhibit Girujan shale swelling', provenance: 'INFERENCE' },
        { depth_range: '1,800 - 2,500 m', fluid_type: 'Low-Solids Non-Dispersed (LSND)', recommended_density_sg: '1.16 - 1.20', viscosity_sec: '42 - 48', objective: 'Stabilize Barail coal seams', provenance: 'INFERENCE' },
        { depth_range: '2,500 - 3,250 m', fluid_type: 'High-Performance Inhibited Mud (HPWBM)', recommended_density_sg: '1.22 - 1.26', viscosity_sec: '50 - 58', objective: 'Control Kopili overpressures', provenance: 'REGIONAL' }
      ],
      casing_seat_recommendations: [
        { string: 'Conductor', size_in: '20"', recommended_depth_m: 120, reason: 'Isolate shallow soil and unstable river gravel', provenance: 'INFERENCE' },
        { string: 'Surface Casing', size_in: '13-3/8"', recommended_depth_m: Math.min(850, Math.round(targetDepth * 0.28)), reason: 'Seal Tipam water sands and provide BOP foundation', provenance: 'INFERENCE' },
        { string: 'Intermediate Casing', size_in: '9-5/8"', recommended_depth_m: Math.min(2350, Math.round(targetDepth * 0.75)), reason: 'Case off Girujan swelling clay before Barail/Kopili pressure ramp', provenance: 'REGIONAL' },
        { string: 'Production Casing / Liner', size_in: '7"', recommended_depth_m: targetDepth, reason: 'Reservoir production completion', provenance: 'INFERENCE' }
      ],
      pre_spud_contingencies: [
        { item: 'LCM Pill Reserve', quantity: '150 bbl pre-mixed (Nut plug + Mica)', status: 'STANDARD REQUIREMENT', provenance: 'REGIONAL' },
        { item: 'Hydraulic Drilling Jar', placement: 'Above 2nd drill collar stand in BHA', status: 'RECOMMENDED', provenance: 'INFERENCE' },
        { item: 'BOP Annular & Pipe Rams', test_pressure: '5,000 psi hydrostatic', status: 'STANDARD REQUIREMENT', provenance: 'INFERENCE' },
        { item: 'PWD (Pressure While Drilling)', activation: 'Prior to penetrating 2,500 m depth', status: 'HIGH PRIORITY', provenance: 'REGIONAL' }
      ]
    };

    return {
      location: {
        latitude: lat,
        longitude: lon,
        target_depth: targetDepth,
        radius_km: radius,
        well_type,
        target_formation,
        basin: blockInfo.basin,
        block_name: blockInfo.name,
        lease_type: blockInfo.lease_type,
        operator: blockInfo.operator,
        state: blockInfo.state,
        district: blockInfo.district,
        nearest_center_km: blockInfo.distance_to_center_km ?? 0
      },
      offset_summary: {
        total_wells_in_radius: nearbyWells.length,
        closest_well: nearbyWells[0] || null,
        offset_wells: nearbyWells.slice(0, 8),
        total_historical_events_found: rawEvents.length
      },
      stratigraphy_prognosis: stratigraphyForecast,
      depth_hazards: depthHazards,
      engineering_program: engineeringProgram,
      evaluated_at: new Date().toISOString()
    };
  },

  /**
   * Compute P10/P50/P90 formation top statistics from nearby offset wells.
   */
  async getFormationTopStatistics(wellId, formationKey = 'kopili') {
    const well = await db.query('SELECT latitude, longitude FROM wells WHERE id = $1', [wellId]);
    if (!well.rows[0]) return null;
    const { latitude, longitude } = well.rows[0];

    const result = await db.query(`
      SELECT wf.top_depth, w.well_name
      FROM well_formations wf
      JOIN formations f ON wf.formation_id = f.id
      JOIN wells w ON wf.well_id = w.id
      WHERE LOWER(REPLACE(f.name, ' ', '_')) LIKE $1
        AND wf.well_id != $2
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(w.longitude::float, w.latitude::float), 4326)::geography,
          ST_SetSRID(ST_MakePoint($3::float, $4::float), 4326)::geography,
          25000
        )
      ORDER BY wf.top_depth ASC
    `, [`%${formationKey.toLowerCase()}%`, wellId, longitude, latitude]);

    const tops = result.rows.map((r) => parseFloat(r.top_depth));
    if (tops.length === 0) {
      return {
        formation: formationKey,
        contributing_wells: [],
        contributing_well_count: 0,
        p10_top_m: null,
        p50_top_m: null,
        p90_top_m: null,
        min_top_m: null,
        max_top_m: null,
        provenance: 'INFERENCE',
      };
    }

    const sorted = [...tops].sort((a, b) => a - b);
    const p = (arr, frac) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(frac * arr.length)))];

    return {
      formation: formationKey,
      contributing_wells: result.rows.map((r) => r.well_name),
      contributing_well_count: tops.length,
      p10_top_m: p(sorted, 0.10),
      p50_top_m: p(sorted, 0.50),
      p90_top_m: p(sorted, 0.90),
      min_top_m: sorted[0],
      max_top_m: sorted[sorted.length - 1],
      provenance: 'REGIONAL',
    };
  },
};

module.exports = planningService;
