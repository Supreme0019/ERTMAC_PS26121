import React from 'react';
import './ParameterStrip.css';
import { formatDepth } from '../../utils/formatters';

const safeNum = (v, decimals = 1) => {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toFixed(decimals);
};

const safeRound = (v) => {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  return isNaN(n) ? String(v) : Math.round(n);
};

const PARAMS_CONFIG = [
  { key: 'depth', label: 'DEPTH', unit: 'm', format: (v) => safeNum(v, 2) },
  { key: 'wob', label: 'WOB', unit: 'klbs', format: (v) => safeNum(v, 1) },
  { key: 'rpm', label: 'RPM', unit: 'rpm', format: (v) => safeRound(v) },
  { key: 'torque', label: 'TORQUE', unit: 'kft-lb', format: (v) => safeNum(v, 1) },
  { key: 'rop', label: 'ROP', unit: 'm/hr', format: (v) => safeNum(v, 1) },
  { key: 'mud_weight', label: 'MUD WT', unit: 'ppg', format: (v) => safeNum(v, 2) },
  { key: 'spp', label: 'SPP', unit: 'psi', format: (v) => safeRound(v) },
  { key: 'flow_rate', label: 'FLOW', unit: 'gpm', format: (v) => safeRound(v) }
];

const ParameterStrip = ({ parameters = {}, trends = {} }) => {
  if (!parameters || Object.keys(parameters).length === 0) {
    return <div className="parameter-strip empty">No parameter data available</div>;
  }

  const getTrendIcon = (trend) => {
    if (!trend) return null;
    if (trend === 'increasing' || trend > 0) return <span className="trend up">↑</span>;
    if (trend === 'decreasing' || trend < 0) return <span className="trend down">↓</span>;
    return <span className="trend stable">-</span>;
  };

  return (
    <div className="parameter-strip">
      {PARAMS_CONFIG.map(config => {
        let val = parameters[config.key];
        if (val === undefined || val === null) {
          if (config.key === 'spp') val = parameters.standpipe_pressure ?? parameters.pressure;
          else if (config.key === 'flow_rate') val = parameters.mud_flow_rate ?? parameters.mud_flow;
          else if (config.key === 'mud_weight') val = parameters.mud_density ?? parameters.mud_wt;
        }
        if (val === undefined || val === null) return null;
        
        return (
          <div key={config.key} className="parameter-card">
            <div className="parameter-label">{config.label}</div>
            <div className="parameter-value-container">
              <span className="parameter-value">{config.format(val)}</span>
              <span className="parameter-unit">{config.unit}</span>
            </div>
            {trends[config.key] && (
              <div className="parameter-trend">
                {getTrendIcon(trends[config.key])}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ParameterStrip;
