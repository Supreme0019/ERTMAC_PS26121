import React from 'react';

export default function LiveParameterStrip({ state, qualityFlags = [] }) {
  if (!state) {
    return (
      <div style={{ padding: '16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '24px', overflowX: 'auto' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Waiting for live parameter data...</div>
      </div>
    );
  }

  const channelQuality = state.channelQuality || {};
  const additional = state.additional_parameters || {};

  const parameters = [
    { key: 'wob', label: 'Weight on Bit', value: state.wob, unit: 'kN' },
    { key: 'rop', label: 'ROP', value: state.rop, unit: 'm/hr' },
    { key: 'rpm', label: 'RPM', value: state.rpm, unit: 'rpm' },
    { key: 'torque', label: 'Torque', value: state.torque, unit: 'kN·m' },
    { key: 'standpipe_pressure', label: 'Standpipe Press', value: state.standpipe_pressure ?? state.spp ?? state.pressure, unit: 'bar' },
    { key: 'mud_flow_rate', label: 'Flow Rate', value: state.mud_flow_rate ?? state.flow_rate ?? state.mud_flow, unit: 'L/min' },
    { key: 'mud_loss', label: 'Mud Loss', value: state.mud_loss ?? additional.mud_loss, unit: 'm³/hr' },
    { key: 'mud_weight', label: 'Mud Weight', value: state.mud_weight, unit: 'sg' },
  ];

  if (additional.flow_out_pct !== undefined) {
    parameters.push({ key: 'flow_out', label: 'Flow Out', value: additional.flow_out_pct, unit: '%' });
  }
  if (additional.pit_volume_delta !== undefined) {
    parameters.push({ key: 'pit_delta', label: 'Pit Delta', value: additional.pit_volume_delta, unit: 'm³' });
  }
  if (additional.total_gas_pct !== undefined) {
    parameters.push({ key: 'total_gas', label: 'Total Gas', value: additional.total_gas_pct, unit: '%' });
  }

  return (
    <div 
      style={{ 
        padding: '14px 24px', 
        background: 'var(--color-surface)', 
        borderBottom: '1px solid var(--color-border)', 
        display: 'flex', 
        gap: '14px', 
        overflowX: 'auto', 
        alignItems: 'center' 
      }}
    >
      {/* Telemetry Indicator Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '10px', flexShrink: 0 }}>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-heading, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Live Telemetry
        </div>
        <div style={{ display: 'flex', alignItems: 'center', height: '14px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        </div>
      </div>
      
      {/* Parameter Cards with Dynamic Anomaly Highlights */}
      {parameters.map((p, i) => {
        const val = Number(p.value);
        const isMudLossAnomaly = p.key === 'mud_loss' && val > 0.5;
        const isTorqueAnomaly = p.key === 'torque' && val >= 24.0;
        const isPressureAnomaly = p.key === 'standpipe_pressure' && val > 0 && val < 2880;
        const isRopAnomaly = p.key === 'rop' && val > 0 && val < 15.0 && Number(state.wob) > 13;
        const hasAnomaly = isMudLossAnomaly || isTorqueAnomaly || isPressureAnomaly || isRopAnomaly;

        const anomalyLabel = isMudLossAnomaly ? '🚨 MUD LOSS' : isTorqueAnomaly ? '⚠️ HIGH TORQUE' : isPressureAnomaly ? '⚠️ SPP DROP' : isRopAnomaly ? '⚠️ TIGHT HOLE' : '🚨 ANOMALY';
        const anomalyColor = isMudLossAnomaly ? '#ef4444' : '#f59e0b';

        const qStatus = channelQuality[p.key] || 'good';
        const isSuspect = qStatus === 'suspect';
        const isBad = qStatus === 'bad' || hasAnomaly;

        return (
          <div 
            key={i} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              minWidth: '125px', 
              padding: '8px 14px',
              background: hasAnomaly ? (isMudLossAnomaly ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)') : 'var(--color-bg-card, #ffffff)',
              border: hasAnomaly ? `1.5px solid ${anomalyColor}` : '1px solid #000000',
              borderRadius: '6px',
              flexShrink: 0,
              gap: '6px',
              boxShadow: hasAnomaly ? `0 0 8px ${anomalyColor}40` : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: hasAnomaly ? anomalyColor : 'var(--color-text-secondary, #64748b)', fontWeight: 600 }}>
                {p.label}
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontWeight: 600,
                  background: hasAnomaly ? `${anomalyColor}25` : isBad ? 'rgba(239, 68, 68, 0.2)' : isSuspect ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                  color: hasAnomaly ? anomalyColor : isBad ? '#ef4444' : isSuspect ? '#f59e0b' : '#10b981',
                  whiteSpace: 'nowrap'
                }}
              >
                {hasAnomaly ? anomalyLabel : isBad ? '✖ BAD' : isSuspect ? '⚠ SUSPECT' : '● VALID'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
              <span 
                style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 700, 
                  color: hasAnomaly ? anomalyColor : isBad ? '#ef4444' : isSuspect ? '#f59e0b' : 'var(--color-text-heading, #0f172a)', 
                  fontFamily: 'var(--font-mono)' 
                }}
              >
                {p.value !== undefined && p.value !== null ? Number(p.value).toFixed(1) : '--'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary, #64748b)', fontWeight: 500 }}>
                {p.unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
