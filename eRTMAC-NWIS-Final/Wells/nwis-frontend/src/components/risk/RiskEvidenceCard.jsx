import React from 'react';
import { FileText, MapPin, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RiskEvidenceCard({ evidence }) {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <FileText size={14} color="var(--color-primary)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', textTransform: 'capitalize' }}>
            {evidence.event_type ? evidence.event_type.replace(/_/g, ' ') : 'Event'}
          </span>
          {evidence.severity && (
            <span style={{ 
              fontSize: '0.7rem', 
              padding: '2px 6px', 
              borderRadius: '12px', 
              background: evidence.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: evidence.severity === 'high' ? '#ef4444' : '#f59e0b',
              textTransform: 'uppercase'
            }}>
              {evidence.severity}
            </span>
          )}
        </div>
        {evidence.well_id && (
          <button 
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
            onClick={() => navigate(`/wells/${evidence.well_id}`)}
          >
            Open Event <ExternalLink size={12} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Database size={12} /> Well: {evidence.well_name || evidence.well_id || 'Unknown'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MapPin size={12} /> Depth: {evidence.depth_m}m
        </span>
      </div>
      
      {evidence.description && (
        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          {evidence.description}
        </p>
      )}
    </div>
  );
}

// Quick placeholder for Database icon if not imported properly above
const Database = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
  </svg>
);
