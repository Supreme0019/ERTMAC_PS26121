import React from 'react';
import { Target, Layers, ArrowDown } from 'lucide-react';

export default function ActiveWellContextBar({ wellName, depth, formation, status }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      padding: '0 24px',
      height: '48px',
      backgroundColor: '#FDFBF7',
      borderBottom: '1px solid var(--color-border)',
      width: '100%',
      position: 'sticky',
      top: '64px',
      zIndex: 20,
      flexShrink: 0,
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Target size={20} className="text-primary" />
        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{wellName || 'Unknown Well'}</span>
      </div>

      <div style={{ width: '1px', height: '24px', background: 'var(--color-border)' }}></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ArrowDown size={16} className="text-secondary" />
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Depth:</span>
        <span style={{ fontWeight: 600 }}>{depth ? `${depth} m` : '---'}</span>
      </div>

      <div style={{ width: '1px', height: '24px', background: 'var(--color-border)' }}></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layers size={16} className="text-secondary" />
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Formation:</span>
        <span style={{ fontWeight: 600 }}>{formation || '---'}</span>
      </div>

      <div style={{ flex: 1 }}></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Status:</span>
        <span className={`badge ${status === 'Active' || status === 'LIVE' ? 'badge-success' : 'badge-warning'}`}>
          {status || 'Unknown'}
        </span>
      </div>
    </div>
  );
}
