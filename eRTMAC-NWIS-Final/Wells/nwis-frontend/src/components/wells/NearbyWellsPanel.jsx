import React from 'react';
import { MapPin, Target, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NearbyWellsPanel({ wells }) {
  const navigate = useNavigate();

  if (!wells || wells.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        No nearby wells found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {wells.map(well => (
        <div key={well.id} style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text)' }}>{well.name}</h4>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={14} />
              {well.distance_km?.toFixed(2)} km
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: 'var(--color-background)', padding: '8px', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Formation Match</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: well.formation_match ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {well.formation_match ? 'YES' : 'NO'}
              </div>
            </div>
            <div style={{ background: 'var(--color-background)', padding: '8px', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Depth Overlap</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>
                {Math.round(well.depth_overlap_percent || 0)}%
              </div>
            </div>
          </div>

          <button 
            className="btn btn-sm btn-ghost" 
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate(`/wells/${well.id}`)}
          >
            View Well Details
          </button>
        </div>
      ))}
    </div>
  );
}
