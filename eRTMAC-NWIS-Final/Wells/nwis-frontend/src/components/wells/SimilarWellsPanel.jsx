import React from 'react';
import { Target, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SimilarWellsPanel({ wells }) {
  const navigate = useNavigate();

  if (!wells || wells.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        No similar wells found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {wells.map(well => (
        <div key={well.id} style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>{well.name}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-background)', padding: '4px 8px', borderRadius: '4px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Overall Match:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                {Math.round((well.similarity_score || 0) * 100)}%
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Similarity Breakdown</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { label: 'Geographic', value: well.factors?.geographic },
                { label: 'Formation', value: well.factors?.formation },
                { label: 'Depth', value: well.factors?.depth },
                { label: 'Trajectory', value: well.factors?.trajectory },
                { label: 'Parameters', value: well.factors?.parameters },
                { label: 'Events', value: well.factors?.events },
                { label: 'Completeness', value: well.factors?.completeness }
              ].map((factor, i) => factor.value !== undefined && (
                <div key={i} style={{ background: 'var(--color-background)', padding: '6px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{factor.label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    {Math.round(factor.value * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-sm btn-ghost" 
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => navigate(`/wells/${well.backend_well_id || well.id || well.well_id}`)}
            >
              View Well Details
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
