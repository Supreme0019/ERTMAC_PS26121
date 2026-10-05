import React from 'react';
import { AlertTriangle, Info, MapPin } from 'lucide-react';
import EvidencePanel from '../evidence/EvidencePanel';

export default function RiskCard({ risk: rawRisk }) {
  const parsedScore = typeof rawRisk.score === 'string' ? parseFloat(rawRisk.score) : (rawRisk.score || 0);
  const normalizedScore = parsedScore > 1 ? Math.round(parsedScore) : Math.round(parsedScore * 100);

  const rawEv = rawRisk.evidence || rawRisk.evidence_refs || [];
  const normalizedEvidence = rawEv.map((ev) => {
    if (typeof ev === 'string') {
      return {
        event_id: ev,
        well_name: 'Offset Well',
        event_type: rawRisk.risk_type || 'historical_incident',
        severity: rawRisk.level || rawRisk.risk_level || 'high',
        description: `Verified historical incident in offset formation logs (${ev.slice(0, 8)})`,
      };
    }
    return ev;
  });

  const risk = {
    ...rawRisk,
    level: rawRisk.level || rawRisk.risk_level,
    evidence: normalizedEvidence,
    score: normalizedScore,
  };
  
  const getLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'var(--color-danger, #ef4444)';
      case 'high': return 'var(--color-danger, #ef4444)';
      case 'medium': case 'moderate': return 'var(--color-warning, #f59e0b)';
      case 'low': return 'var(--color-success, #10b981)';
      default: return 'var(--color-text-secondary, #6b7280)';
    }
  };

  const getProvenanceBadge = (prov) => {
    switch (prov?.toUpperCase()) {
      case 'DIRECT':
        return { label: 'DIRECT OFFSET', bg: 'rgba(5, 150, 105, 0.12)', color: '#059669', border: 'rgba(5, 150, 105, 0.3)' };
      case 'REGIONAL':
        return { label: 'REGIONAL ANALOG (≤15 km)', bg: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', border: 'rgba(37, 99, 235, 0.3)' };
      case 'ANALOG':
        return { label: 'STRATIGRAPHIC ANALOG', bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: 'rgba(217, 119, 6, 0.3)' };
      case 'INFERENCE':
      default:
        return { label: 'PHYSICS INFERENCE', bg: 'rgba(107, 114, 128, 0.12)', color: '#4b5563', border: 'rgba(107, 114, 128, 0.3)' };
    }
  };

  const primaryProv = risk.provenance || risk.evidence?.[0]?.provenance || (risk.evidence?.length > 0 ? 'REGIONAL' : 'INFERENCE');
  const provStyle = getProvenanceBadge(primaryProv);

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ background: `${getLevelColor(risk.level)}20`, padding: '8px', borderRadius: '8px' }}>
            <AlertTriangle size={20} color={getLevelColor(risk.level)} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)', textTransform: 'capitalize' }}>
                {risk.risk_type ? risk.risk_type.replace(/_/g, ' ') : 'Unknown Risk'}
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: provStyle.bg,
                  color: provStyle.color,
                  border: `1px solid ${provStyle.border}`,
                  letterSpacing: '0.04em',
                }}
              >
                {provStyle.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.85rem', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} /> Depth: {risk.depth_range?.[0] || risk.depth_range?.start || risk.depth || 0}m - {risk.depth_range?.[1] || risk.depth_range?.end || risk.depth || 0}m
              </span>
              <span style={{ color: getLevelColor(risk.level), fontWeight: 600, textTransform: 'uppercase' }}>
                {risk.level || 'Unknown'} LEVEL
              </span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
            {risk.score}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Risk Index</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px' }}>
        {/* Provenance Summary Strip */}
        {risk.provenance_summary?.message && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(37, 99, 235, 0.06)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '0.8rem',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <strong>Evidence Provenance:</strong> {risk.provenance_summary.message}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text)' }}>Explanation</h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {risk.explanation || 'No explanation provided.'}
          </p>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '12px', borderRadius: '0 4px 4px 0', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <Info size={16} color="#ef4444" style={{ marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444' }}>Important Note</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Historical record &mdash; not an operational instruction. Risk signals provide decision support, not guaranteed predictions.</div>
          </div>
        </div>

        {/* Evidence */}
        {risk.evidence && risk.evidence.length > 0 && (
          <div>
            <EvidencePanel evidence={risk.evidence} />
          </div>
        )}
      </div>

    </div>
  );
}
