// =============================================================================
// NWIS Backend — Depth & Stratigraphic Alignment Utilities
// =============================================================================

const db = require('../config/database');

/**
 * Align measured depth (MD) to stratigraphic formation top and compute TVD.
 *
 * @param {string|object} well - well UUID or well object
 * @param {number} md - measured depth in meters
 * @returns {Promise<{ formation_id: string|null, formation_name: string|null, top_depth: number|null, bottom_depth: number|null, depth_below_top: number|null, tvd: number }>}
 */
async function alignDepth(well, md) {
  const wellId = typeof well === 'object' && well !== null ? well.id : well;
  const depth = parseFloat(md) || 0;

  // 1. Fetch well formations
  const formRes = await db.query(
    `SELECT wf.formation_id, wf.top_depth, wf.bottom_depth, f.name AS formation_name
     FROM well_formations wf
     LEFT JOIN formations f ON wf.formation_id = f.id
     WHERE wf.well_id = $1
     ORDER BY wf.top_depth ASC`,
    [wellId]
  );

  let matchedFormation = null;
  for (const f of formRes.rows) {
    const top = parseFloat(f.top_depth);
    const bottom = f.bottom_depth ? parseFloat(f.bottom_depth) : Infinity;
    if (depth >= top && depth <= bottom) {
      matchedFormation = f;
      break;
    }
  }

  // Fallback: if depth is beyond the last top
  if (!matchedFormation && formRes.rows.length > 0) {
    const last = formRes.rows[formRes.rows.length - 1];
    if (depth >= parseFloat(last.top_depth)) {
      matchedFormation = last;
    }
  }

  let formation_id = null;
  let formation_name = null;
  let top_depth = null;
  let bottom_depth = null;
  let depth_below_top = null;

  if (matchedFormation) {
    formation_id = matchedFormation.formation_id;
    formation_name = matchedFormation.formation_name;
    top_depth = parseFloat(matchedFormation.top_depth);
    bottom_depth = matchedFormation.bottom_depth ? parseFloat(matchedFormation.bottom_depth) : null;
    depth_below_top = Math.round((depth - top_depth) * 10) / 10;
  }

  // 2. Trajectory interpolation for TVD
  const trajRes = await db.query(
    `SELECT measured_depth, tvd, inclination, azimuth
     FROM well_trajectories
     WHERE well_id = $1
     ORDER BY measured_depth ASC`,
    [wellId]
  );

  let tvd = depth; // default to MD (vertical)
  const stations = trajRes.rows.map((s) => ({
    md: parseFloat(s.measured_depth),
    tvd: parseFloat(s.tvd),
    inc: parseFloat(s.inclination || 0),
  }));

  if (stations.length > 0) {
    if (depth <= stations[0].md) {
      const ratio = stations[0].md > 0 ? stations[0].tvd / stations[0].md : 1.0;
      tvd = depth * ratio;
    } else if (depth >= stations[stations.length - 1].md) {
      const last = stations[stations.length - 1];
      const incRad = (last.inc * Math.PI) / 180;
      tvd = last.tvd + (depth - last.md) * Math.cos(incRad);
    } else {
      for (let i = 0; i < stations.length - 1; i++) {
        const s1 = stations[i];
        const s2 = stations[i + 1];
        if (depth >= s1.md && depth <= s2.md) {
          const frac = (depth - s1.md) / (s2.md - s1.md);
          tvd = s1.tvd + frac * (s2.tvd - s1.tvd);
          break;
        }
      }
    }
  }

  return {
    formation_id,
    formation_name,
    top_depth,
    bottom_depth,
    depth_below_top,
    tvd: Math.round(tvd * 10) / 10,
  };
}

module.exports = {
  alignDepth,
};
