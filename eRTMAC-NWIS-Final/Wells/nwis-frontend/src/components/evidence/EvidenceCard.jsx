import React from 'react';
import SourceDocumentLink from './SourceDocumentLink';

/**
 * Reusable Evidence / Diagnostic Card Component
 * Used by BOTH "Correlated Offset Evidence" (standard HIGH alerts)
 * AND "Telemetry Diagnostics & Mitigations" (CRITICAL/Live Anomaly alerts).
 *
 * Canonical palette — DO NOT change to #FFFFFF or #FFFCF7:
 *   background : #FFF8ED  — warm off-white, cohesive with peach/orange alert parents
 *   border     : #F0DCC0  — warm tan (normal) | #FCA5A5 — rose (isCritical)
 *   shadow     : 0 1px 2px rgba(0,0,0,0.04)
 */
export default function EvidenceCard({ evidence, isCritical = false }) {
  if (!evidence) return null;

  const severityUpper = evidence.severity ? String(evidence.severity).toUpperCase() : '';
  const showSeverity = severityUpper &&
    severityUpper !== 'UNKNOWN' &&
    severityUpper !== 'UNDEFINED' &&
    severityUpper !== 'NULL';

  const isSevCritical = severityUpper === 'CRITICAL';
  const isSevHigh = severityUpper === 'HIGH';

  return (
    <div
      style={{
        backgroundColor: '#FFF8ED',
        border: `1px solid ${isCritical ? '#FCA5A5' : '#F0DCC0'}`,
        borderRadius: '6px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header row: well ID + severity badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#2563EB', fontWeight: 600, fontSize: '14px' }}>
          {evidence.well_name || (evidence.well_id ? `Well ${evidence.well_id.slice(0, 8)}` : 'Well')} at {evidence.depth}m
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {showSeverity && (
            <span
              style={{
                backgroundColor: isSevCritical ? '#DC2626' : isSevHigh ? '#D97706' : '#2563EB',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}
            >
              {severityUpper}
            </span>
          )}
          {evidence.page && (
            <span style={{ color: '#6B7280', fontSize: '13px', fontWeight: 500 }}>
              p. {evidence.page}
            </span>
          )}
        </div>
      </div>

      {/* Quote / description */}
      <div style={{ color: '#374151', fontStyle: 'italic', fontSize: '13px', lineHeight: 1.45, margin: '2px 0' }}>
        "{evidence.quote || evidence.description}"
      </div>

      {/* Mitigation */}
      {evidence.mitigation && (
        <div style={{ fontSize: '13px', lineHeight: 1.4, marginTop: '2px' }}>
          <strong style={{ color: '#047857', fontWeight: 600 }}>Mitigation: </strong>
          <span style={{ color: '#374151' }}>{evidence.mitigation}</span>
        </div>
      )}

      {/* Source document link */}
      {evidence.doc && (
        <div style={{ marginTop: '4px' }}>
          <SourceDocumentLink document={{ file_uri: evidence.doc, original_filename: evidence.doc, page: evidence.page }} />
        </div>
      )}
    </div>
  );
}

