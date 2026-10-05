// =============================================================================
// NWIS Backend — Drilling Unit Conversion Utilities
// =============================================================================

const CONVERSIONS = {
  // Force: klbf <-> kN
  klbf_to_kN: (val) => val * 4.44822,
  kN_to_klbf: (val) => val / 4.44822,

  // Density: ppg <-> sg (g/cm3)
  ppg_to_sg: (val) => val * 0.119826,
  sg_to_ppg: (val) => val / 0.119826,

  // Pressure: psi <-> bar
  psi_to_bar: (val) => val * 0.0689476,
  bar_to_psi: (val) => val / 0.0689476,

  // Volumetric Flow: gpm <-> L/min
  gpm_to_Lmin: (val) => val * 3.78541,
  Lmin_to_gpm: (val) => val / 3.78541,

  // Length / Depth: ft <-> m
  ft_to_m: (val) => val * 0.3048,
  m_to_ft: (val) => val / 0.3048,

  // Speed: ft/hr <-> m/hr
  fph_to_mhr: (val) => val * 0.3048,
  mhr_to_fph: (val) => val / 0.3048,

  // Torque: lbf*ft <-> kN*m
  lbfft_to_kNm: (val) => (val * 1.355818) / 1000,
  kNm_to_lbfft: (val) => (val * 1000) / 1.355818,
};

function convert(value, fromUnit, toUnit) {
  const num = parseFloat(value);
  if (isNaN(num)) return null;

  const f = fromUnit?.trim().toLowerCase();
  const t = toUnit?.trim().toLowerCase();

  if (!f || !t || f === t) return num;

  if (f === 'klbf' && t === 'kn') return CONVERSIONS.klbf_to_kN(num);
  if (f === 'kn' && t === 'klbf') return CONVERSIONS.kN_to_klbf(num);

  if (f === 'ppg' && (t === 'sg' || t === 'g/cm3')) return CONVERSIONS.ppg_to_sg(num);
  if ((f === 'sg' || f === 'g/cm3') && t === 'ppg') return CONVERSIONS.sg_to_ppg(num);

  if (f === 'psi' && t === 'bar') return CONVERSIONS.psi_to_bar(num);
  if (f === 'bar' && t === 'psi') return CONVERSIONS.bar_to_psi(num);

  if ((f === 'gpm' || f === 'gal/min') && (t === 'l/min' || t === 'lmin')) return CONVERSIONS.gpm_to_Lmin(num);
  if ((f === 'l/min' || f === 'lmin') && (t === 'gpm' || t === 'gal/min')) return CONVERSIONS.Lmin_to_gpm(num);

  if (f === 'ft' && t === 'm') return CONVERSIONS.ft_to_m(num);
  if (f === 'm' && t === 'ft') return CONVERSIONS.m_to_ft(num);

  if ((f === 'ft/h' || f === 'ft/hr' || f === 'fph') && (t === 'm/h' || t === 'm/hr')) return CONVERSIONS.fph_to_mhr(num);
  if ((f === 'm/h' || f === 'm/hr') && (t === 'ft/h' || t === 'ft/hr' || t === 'fph')) return CONVERSIONS.mhr_to_fph(num);

  if ((f === 'lbf.ft' || f === 'lbf*ft' || f === 'klbf*ft') && (t === 'kn.m' || t === 'kn*m' || t === 'knm')) {
    return f.startsWith('k') ? (num * 1.355818) : CONVERSIONS.lbfft_to_kNm(num);
  }

  return num;
}

module.exports = {
  convert,
  klbfToKn: CONVERSIONS.klbf_to_kN,
  knToKlbf: CONVERSIONS.kN_to_klbf,
  ppgToSg: CONVERSIONS.ppg_to_sg,
  sgToPpg: CONVERSIONS.sg_to_ppg,
  psiToBar: CONVERSIONS.psi_to_bar,
  barToPsi: CONVERSIONS.bar_to_psi,
  gpmToLmin: CONVERSIONS.gpm_to_Lmin,
  lminToGpm: CONVERSIONS.Lmin_to_gpm,
  ftToM: CONVERSIONS.ft_to_m,
  mToFt: CONVERSIONS.m_to_ft,
};
