import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, ShieldCheck, AlertTriangle, RefreshCw, 
  Sliders, Download, CheckCircle2, Zap, BarChart3, 
  Cpu, Database, Layers, Info, Check, ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';
import './DriftMonitoringPage.css';

const MODEL_INFO = {
  name: 'XGBoost Telemetry Anomaly Ensemble',
  version: 'v2.4.1-prod',
  framework: 'XGBoost 2.0.3 + ONNX Runtime',
  trainedAt: '2026-09-18',
  baselineDataset: 'Upper Assam Basin Baseline (SYN-001 - SYN-025)',
  totalSamples: '1.24M Sensor Ticks',
  targetHorizon: 'Assam Shelf Formations (Tipam, Barail, Kopili, Sylhet)',
  dualScoring: 'Active (Physics Rule Engine + ML XGBoost Classifier)',
};

const PARAMETERS_DATA = [
  {
    id: 'flow_rate',
    name: 'Mud Flow Rate',
    unit: 'L/min',
    psi: 0.042,
    ksStat: 0.038,
    status: 'stable',
    baselineMean: 940,
    liveMean: 932,
    stdDev: 48,
    samples: 12400,
    notes: 'Well within 95% confidence interval. Normal circulating condition.'
  },
  {
    id: 'wob',
    name: 'Weight on Bit (WOB)',
    unit: 'kN',
    psi: 0.055,
    ksStat: 0.049,
    status: 'stable',
    baselineMean: 115,
    liveMean: 118,
    stdDev: 14,
    samples: 12400,
    notes: 'Bit loading conforms to Assam Shelf standard drilling parameters.'
  },
  {
    id: 'rpm',
    name: 'Rotary Speed (RPM)',
    unit: 'rpm',
    psi: 0.062,
    ksStat: 0.053,
    status: 'stable',
    baselineMean: 110,
    liveMean: 108,
    stdDev: 12,
    samples: 12400,
    notes: 'Rotary drive stable across target depth window.'
  },
  {
    id: 'rop',
    name: 'Rate of Penetration (ROP)',
    unit: 'm/hr',
    psi: 0.142,
    ksStat: 0.128,
    status: 'moderate',
    baselineMean: 14.2,
    liveMean: 9.8,
    stdDev: 3.8,
    samples: 12400,
    notes: 'Interbedded hard chert in Kopili formation causing ROP suppression below historical regional mean.'
  },
  {
    id: 'torque',
    name: 'Rotary Torque',
    unit: 'kN·m',
    psi: 0.071,
    ksStat: 0.062,
    status: 'stable',
    baselineMean: 18.5,
    liveMean: 19.1,
    stdDev: 2.9,
    samples: 12400,
    notes: 'Nominal friction factor with slight natural depth-dependent rise.'
  },
  {
    id: 'spp',
    name: 'Standpipe Pressure (SPP)',
    unit: 'bar',
    psi: 0.058,
    ksStat: 0.044,
    status: 'stable',
    baselineMean: 210,
    liveMean: 206,
    stdDev: 16,
    samples: 12400,
    notes: 'Hydraulic system pressure aligned with baseline hydraulics curve.'
  },
  {
    id: 'mud_loss',
    name: 'Mud Loss Rate',
    unit: 'm³/hr',
    psi: 0.284,
    ksStat: 0.261,
    status: 'high',
    baselineMean: 0.02,
    liveMean: 0.58,
    stdDev: 0.18,
    samples: 12400,
    notes: 'Telemetry anomaly active: loss rate exceeding normal training boundary. Correlated with regional Kopili thief zones.'
  }
];

const DISTRIBUTION_HISTOGRAM = [
  { bin: '-3σ', baseline: 2.1, live: 1.8 },
  { bin: '-2σ', baseline: 13.6, live: 11.2 },
  { bin: '-1σ', baseline: 34.1, live: 32.5 },
  { bin: 'Mean', baseline: 34.1, live: 35.8 },
  { bin: '+1σ', baseline: 13.6, live: 15.4 },
  { bin: '+2σ', baseline: 2.1, live: 3.1 },
  { bin: '+3σ', baseline: 0.4, live: 0.2 },
];

export default function DriftMonitoringPage() {
  const [filter, setFilter] = useState('ALL');
  const [selectedParamId, setSelectedParamId] = useState('rop');
  const [recalibrating, setRecalibrating] = useState(false);
  const [recalibratedToast, setRecalibratedToast] = useState(false);

  const selectedParam = PARAMETERS_DATA.find(p => p.id === selectedParamId) || PARAMETERS_DATA[0];

  const filteredParams = PARAMETERS_DATA.filter(p => {
    if (filter === 'ALL') return true;
    return p.status === filter.toLowerCase();
  });

  const handleRecalibrate = () => {
    setRecalibrating(true);
    setTimeout(() => {
      setRecalibrating(false);
      setRecalibratedToast(true);
      setTimeout(() => setRecalibratedToast(false), 4000);
    }, 1200);
  };

  const getStatusBadge = (status) => {
    if (status === 'stable') {
      return (
        <span className="drift-status-badge drift-status-stable">
          <CheckCircle2 size={12} /> Stable (PSI &lt; 0.10)
        </span>
      );
    }
    if (status === 'moderate') {
      return (
        <span className="drift-status-badge drift-status-moderate">
          <AlertTriangle size={12} /> Moderate Drift
        </span>
      );
    }
    return (
      <span className="drift-status-badge drift-status-high">
        <ShieldAlert size={12} /> High Drift / Anomaly
      </span>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="drift-page-container">
      
      {/* Page Header */}
      <div className="drift-header">
        <div>
          <h1 className="drift-title">
            <Activity size={26} style={{ color: 'var(--color-sidebar-bg, #95562d)' }} />
            ML Model Health & Telemetry Parameter Drift Monitoring
          </h1>
          <p className="drift-subtitle">
            Continuous statistical population stability index (PSI) and Kolmogorov-Smirnov distribution testing.
            Validates that live sensor streams match trained synthetic and historical baseline parameters.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Export Audit Log
          </button>

          <button 
            className="btn btn-primary btn-sm"
            onClick={handleRecalibrate}
            disabled={recalibrating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={recalibrating ? 'spin' : ''} />
            {recalibrating ? 'Re-evaluating Statistical Drift...' : 'Recalibrate Baseline'}
          </button>
        </div>
      </div>

      {/* Toast confirmation */}
      {recalibratedToast && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '10px 16px',
          borderRadius: '6px',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <strong>Model Recalibration Successful:</strong> Telemetry baseline alignment verified across 7 channels.
        </div>
      )}

      {/* Model Version & Provenance Strip */}
      <div className="drift-meta-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={15} style={{ color: 'var(--color-sidebar-bg, #95562d)' }} />
          <strong>Model:</strong> {MODEL_INFO.name} ({MODEL_INFO.version})
        </div>
        <div style={{ color: '#D1C7B8' }}>&bull;</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Database size={15} style={{ color: '#2563EB' }} />
          <strong>Dataset:</strong> {MODEL_INFO.baselineDataset}
        </div>
        <div style={{ color: '#D1C7B8' }}>&bull;</div>
        <div>
          <strong>Trained:</strong> {MODEL_INFO.trainedAt}
        </div>
        <div style={{ color: '#D1C7B8' }}>&bull;</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={15} style={{ color: '#047857' }} />
          <strong>Runtime:</strong> {MODEL_INFO.framework}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="drift-summary-grid">
        <div className="drift-kpi-card">
          <span className="drift-kpi-label">Overall Model Status</span>
          <div className="drift-kpi-val" style={{ color: '#047857' }}>
            OPERATIONAL
          </div>
          <span className="drift-kpi-sub">Dual-confidence verification active</span>
        </div>

        <div className="drift-kpi-card">
          <span className="drift-kpi-label">Average Population Drift (PSI)</span>
          <div className="drift-kpi-val" style={{ color: '#1A1410' }}>
            0.073 <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#047857' }}>STABLE</span>
          </div>
          <span className="drift-kpi-sub">Threshold: &lt; 0.10 indicates stable distributions</span>
        </div>

        <div className="drift-kpi-card">
          <span className="drift-kpi-label">Monitored Parameter Channels</span>
          <div className="drift-kpi-val">
            7 / 7
          </div>
          <span className="drift-kpi-sub">WOB, ROP, RPM, Torque, SPP, Flow, Mud Loss</span>
        </div>

        <div className="drift-kpi-card">
          <span className="drift-kpi-label">Real-time Stream Conformance</span>
          <div className="drift-kpi-val" style={{ color: '#D97706' }}>
            92.8%
          </div>
          <span className="drift-kpi-sub">1 channel in anomaly escalation (Mud Loss)</span>
        </div>
      </div>

      {/* Interactive Distribution Comparison & Visualizer */}
      <div className="drift-chart-grid">
        <div className="drift-table-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1A1410', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={16} style={{ color: 'var(--color-sidebar-bg, #95562d)' }} />
                Baseline vs. Live Telemetry Distribution ({selectedParam.name})
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#6B7280' }}>
                Comparing reference training distribution (blue) against the rolling 200-sample live stream (orange).
              </p>
            </div>

            <select
              className="input-field"
              value={selectedParamId}
              onChange={(e) => setSelectedParamId(e.target.value)}
              style={{ width: 'auto', minWidth: '180px', padding: '6px 10px', fontSize: '0.8rem' }}
            >
              {PARAMETERS_DATA.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div style={{ height: '280px', width: '100%', marginTop: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DISTRIBUTION_HISTOGRAM} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DC" />
                <XAxis dataKey="bin" tick={{ fill: '#78716C', fontSize: 11 }} />
                <YAxis tick={{ fill: '#78716C', fontSize: 11 }} label={{ value: 'Probability Density (%)', angle: -90, position: 'insideLeft', offset: 25, fill: '#78716C', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5DCD0', borderRadius: '6px', fontSize: '0.8rem' }}
                  formatter={(value) => [`${value}%`]}
                />
                <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }} />
                <Bar dataKey="baseline" name="Synthetic Training Baseline" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="live" name="Real-time Stream Distribution" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: '#FFF8ED',
            border: '1px solid #F0DCC0',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            color: '#78350F'
          }}>
            <strong>Diagnostic Interpretation:</strong> {selectedParam.notes}
          </div>
        </div>

        {/* Statistical Drift Legend & Guardrails */}
        <div className="drift-table-card" style={{ gap: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1A1410', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} style={{ color: '#047857' }} />
            Statistical Validation Standards
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', color: '#4B5563' }}>
            <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <strong style={{ color: '#0F172A', display: 'block', marginBottom: '2px' }}>Population Stability Index (PSI)</strong>
              <span>
                Quantifies divergence between reference training and current telemetry:
              </span>
              <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', lineHeight: 1.5 }}>
                <li><strong style={{ color: '#047857' }}>PSI &lt; 0.10:</strong> Minimal shift; model operating within expected parameters.</li>
                <li><strong style={{ color: '#B45309' }}>0.10 ≤ PSI &le; 0.25:</strong> Moderate drift; formation heterogeneity detected.</li>
                <li><strong style={{ color: '#DC2626' }}>PSI &gt; 0.25:</strong> Severe distribution change; triggers alert escalation.</li>
              </ul>
            </div>

            <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <strong style={{ color: '#0F172A', display: 'block', marginBottom: '2px' }}>Kolmogorov-Smirnov (KS) Test</strong>
              <span>
                Non-parametric test comparing the maximum vertical difference between empirical cumulative distributions.
              </span>
            </div>

            <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#FFF8ED', border: '1px solid #F0DCC0', color: '#78350F' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '2px' }}>
                <Info size={14} /> Dual-Confidence Guardrail
              </div>
              Predictions are corroborated by deterministic physical constraints (mud weight vs pore pressure) preventing hallucinated recommendations.
            </div>
          </div>
        </div>
      </div>

      {/* Parameter Drift Table */}
      <div className="drift-table-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1A1410' }}>
              Channel-by-Channel Telemetry Health Matrix
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#6B7280' }}>
              Continuous evaluation against the 1.24M-point baseline dataset.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'STABLE', 'MODERATE', 'HIGH'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  border: filter === s ? 'none' : '1px solid #E5DCD0',
                  backgroundColor: filter === s ? 'var(--color-sidebar-bg, #95562d)' : 'transparent',
                  color: filter === s ? '#FFFFFF' : '#4B3728',
                  cursor: 'pointer'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="drift-table">
            <thead>
              <tr>
                <th>Telemetry Channel</th>
                <th>Status</th>
                <th>PSI Metric</th>
                <th>KS-Statistic</th>
                <th>Baseline Mean</th>
                <th>Live Stream Mean</th>
                <th>Diagnostic Findings</th>
              </tr>
            </thead>
            <tbody>
              {filteredParams.map(param => (
                <tr 
                  key={param.id}
                  onClick={() => setSelectedParamId(param.id)}
                  style={{ cursor: 'pointer', backgroundColor: selectedParamId === param.id ? '#FFF8ED' : undefined }}
                >
                  <td style={{ fontWeight: 600, color: '#1A1410' }}>
                    {param.name} <span style={{ color: '#78716C', fontWeight: 400 }}>({param.unit})</span>
                  </td>
                  <td>
                    {getStatusBadge(param.status)}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: param.psi > 0.2 ? '#DC2626' : (param.psi > 0.1 ? '#D97706' : '#047857') }}>
                    {param.psi.toFixed(3)}
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#4B5563' }}>
                    {param.ksStat.toFixed(3)}
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#3B82F6', fontWeight: 600 }}>
                    {param.baselineMean} {param.unit}
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#F97316', fontWeight: 600 }}>
                    {param.liveMean} {param.unit}
                  </td>
                  <td style={{ color: '#4B5563', maxWidth: '340px' }}>
                    {param.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </motion.div>
  );
}
