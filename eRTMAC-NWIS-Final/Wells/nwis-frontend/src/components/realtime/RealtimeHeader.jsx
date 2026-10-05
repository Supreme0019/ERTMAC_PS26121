import React from 'react';
import { MapPin, Target } from 'lucide-react';

export default function RealtimeHeader({ wellName, connected, mode, depth, formation }) {
  const isReplay = mode && mode.toUpperCase() === 'REPLAY';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text)' }}>{wellName || 'Unknown Well'}</h2>
        
        {isReplay && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b' }}>
            REPLAY
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
          <Target size={16} />
          <span>Depth:</span>
          <strong style={{ color: 'var(--color-text)', fontSize: '1.1rem' }}>{depth ? `${depth}m` : '--'}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
          <MapPin size={16} />
          <span>Formation:</span>
          <strong style={{ color: 'var(--color-text)', fontSize: '1.1rem' }}>{formation || '--'}</strong>
        </div>
      </div>
    </div>
  );
}
